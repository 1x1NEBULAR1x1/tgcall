import asyncio
import os
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import dotenv
import httpx
import uvicorn

dotenv.load_dotenv()
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import validate_telegram_init_data, create_token, decode_token
from rooms import create_room, room_exists

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Один event loop: FastAPI + бот."""
    web_app_url = os.environ.get("WEB_APP_URL", "")
    print(f"WEB_APP_URL={web_app_url or '(not set)'}")
    print(f"BOT_TOKEN={'***' if BOT_TOKEN else '(not set)'}")
    print(f"dist exists={Path(__file__).parent.joinpath('dist').exists()}")
    bot_task = None
    if BOT_TOKEN:
        from telegram_bot import run_bot
        bot_task = asyncio.create_task(run_bot())
    yield
    if bot_task is not None:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Conference API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Auth ----------
class AuthRequest(BaseModel):
    initData: str


@app.post("/auth")
def auth(req: AuthRequest):
    """Авторизация по initData из Telegram WebApp. Возвращает JWT и данные пользователя."""
    data = validate_telegram_init_data(req.initData)
    if not data or data.get("user_id") is None:
        raise HTTPException(status_code=401, detail="Invalid initData")
    token = create_token(data)
    bot_username = os.environ.get("BOT_USERNAME", "")
    return {
        "token": token,
        "user": {
            "id": data["user_id"],
            "first_name": data.get("first_name", ""),
            "username": data.get("username", ""),
        },
        "bot_username": bot_username,
    }


class CreateRoomRequest(BaseModel):
    token: str


# ---------- Rooms ----------
@app.post("/rooms")
def create_room_endpoint(req: CreateRoomRequest):
    """Создать комнату. Требуется токен авторизации."""
    token = req.token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    claims = decode_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid token")
    room_id = create_room(creator_id=claims["user_id"])
    return {"room_id": room_id}


@app.get("/rooms/{room_id}")
def get_room_endpoint(room_id: str):
    if not room_exists(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room_id": room_id, "exists": True}


# ---------- Аватар пользователя из Telegram ----------
async def _fetch_telegram_avatar(user_id: int):
    """Скачивает фото профиля user_id из Telegram. Возвращает (bytes,) или None."""
    if not BOT_TOKEN:
        return None
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getUserProfilePhotos",
            params={"user_id": user_id, "limit": 1},
        )
        data = r.json()
        if not data.get("ok") or not data.get("result", {}).get("photos"):
            return None
        photos = data["result"]["photos"]
        file_id = photos[0][-1]["file_id"]
        r2 = await client.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getFile",
            params={"file_id": file_id},
        )
        fp_data = r2.json()
        if not fp_data.get("ok"):
            return None
        file_path = fp_data["result"]["file_path"]
        r3 = await client.get(f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}")
        return r3.content


def _require_token(authorization: str = Header(None, alias="Authorization")):
    auth = (authorization or "").strip()
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = auth[7:].strip()
    claims = decode_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid token")
    return claims


@app.get("/avatar/{user_id:int}")
async def get_avatar_peer(user_id: int, authorization: str = Header(None, alias="Authorization")):
    """Фото профиля собеседника по user_id (Telegram). Authorization: Bearer <token>."""
    _require_token(authorization)
    content = await _fetch_telegram_avatar(user_id)
    if content is None:
        raise HTTPException(status_code=404, detail="No profile photo")
    return Response(content=content, media_type="image/jpeg")


@app.get("/avatar")
async def get_avatar_self(authorization: str = Header(None, alias="Authorization")):
    """Фото профиля текущего пользователя. Authorization: Bearer <token>."""
    claims = _require_token(authorization)
    content = await _fetch_telegram_avatar(claims.get("user_id"))
    if content is None:
        raise HTTPException(status_code=404, detail="No profile photo")
    return Response(content=content, media_type="image/jpeg")


# ---------- WebSocket signaling для WebRTC ----------
# Подключения в комнате: peer_id (uuid) -> { ws, user_id, first_name }
class ConnectionManager:
    def __init__(self):
        self._rooms: dict[str, dict[str, dict]] = {}  # room_id -> { peer_id -> { ws, user_id, first_name, video_enabled } }

    def add(self, room_id: str, peer_id: str, ws: WebSocket, user_id: int, first_name: str):
        if room_id not in self._rooms:
            self._rooms[room_id] = {}
        self._rooms[room_id][peer_id] = {"ws": ws, "user_id": user_id, "first_name": first_name or "Участник", "video_enabled": True, "audio_enabled": True}

    def remove(self, room_id: str, peer_id: str):
        if room_id in self._rooms:
            self._rooms[room_id].pop(peer_id, None)
            if not self._rooms[room_id]:
                del self._rooms[room_id]

    def set_video_enabled(self, room_id: str, peer_id: str, enabled: bool):
        peers = self._rooms.get(room_id, {})
        if peer_id in peers:
            peers[peer_id]["video_enabled"] = enabled

    def set_audio_enabled(self, room_id: str, peer_id: str, enabled: bool):
        peers = self._rooms.get(room_id, {})
        if peer_id in peers:
            peers[peer_id]["audio_enabled"] = enabled

    def get_peers(self, room_id: str):
        return dict(self._rooms.get(room_id, {}))

    async def send_to_peer(self, room_id: str, peer_id: str, message: dict):
        peers = self._rooms.get(room_id, {})
        if peer_id in peers:
            try:
                await peers[peer_id]["ws"].send_json(message)
            except Exception:
                pass

    async def broadcast_to_others(self, room_id: str, exclude_peer_id: str, message: dict):
        for pid, data in self._rooms.get(room_id, {}).items():
            if pid == exclude_peer_id:
                continue
            try:
                await data["ws"].send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/conference")
async def conference_ws(websocket: WebSocket):
    await websocket.accept()
    room_id = websocket.query_params.get("room_id") or ""
    token = websocket.query_params.get("token") or ""
    if not room_id or not token:
        await websocket.close(code=4000)
        return
    if not room_exists(room_id):
        await websocket.close(code=4004)
        return
    claims = decode_token(token)
    if not claims:
        await websocket.close(code=4001)
        return
    peer_id = uuid.uuid4().hex[:12]
    manager.add(
        room_id,
        peer_id,
        websocket,
        user_id=claims["user_id"],
        first_name=claims.get("first_name", ""),
    )
    peers_info = [
        {"peer_id": pid, "user_id": p["user_id"], "first_name": p["first_name"], "video_enabled": p.get("video_enabled", True), "audio_enabled": p.get("audio_enabled", True)}
        for pid, p in manager.get_peers(room_id).items()
        if pid != peer_id
    ]
    await websocket.send_json({
        "type": "you_joined",
        "peer_id": peer_id,
        "peers": peers_info,
    })
    await manager.broadcast_to_others(room_id, peer_id, {
        "type": "peer_joined",
        "peer_id": peer_id,
        "user_id": claims["user_id"],
        "first_name": claims.get("first_name", ""),
        "video_enabled": True,
        "audio_enabled": True,
    })
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            to_peer = data.get("to_peer_id")
            if msg_type == "video_status":
                enabled = bool(data.get("enabled", True))
                manager.set_video_enabled(room_id, peer_id, enabled)
                await manager.broadcast_to_others(room_id, peer_id, {
                    "type": "video_status",
                    "peer_id": peer_id,
                    "enabled": enabled,
                })
            elif msg_type == "audio_status":
                enabled = bool(data.get("enabled", True))
                manager.set_audio_enabled(room_id, peer_id, enabled)
                await manager.broadcast_to_others(room_id, peer_id, {
                    "type": "audio_status",
                    "peer_id": peer_id,
                    "enabled": enabled,
                })
            elif to_peer and msg_type in ("offer", "answer", "ice"):
                await manager.send_to_peer(room_id, to_peer, {
                    "type": msg_type,
                    "from_peer_id": peer_id,
                    "payload": data.get("payload"),
                })
    except WebSocketDisconnect:
        pass
    finally:
        manager.remove(room_id, peer_id)
        await manager.broadcast_to_others(room_id, peer_id, {"type": "peer_left", "peer_id": peer_id})


# ---------- Health & Static ----------
@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Dev: прокси на Vite (localhost:5173) ----------
VITE_DEV_ORIGIN = "http://127.0.0.1:5173"


async def proxy_to_vite(path: str) -> tuple[bytes, str | None, int]:
    """Запрос к Vite dev server. Возвращает (body, media_type, status_code)."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{VITE_DEV_ORIGIN}{path}"
        try:
            r = await client.get(url)
        except Exception:
            return (b"Vite dev server unavailable (is npm run dev running on 5173?)", "text/plain", 503)
        content = r.content
        media = r.headers.get("content-type", "").split(";")[0].strip() or None
        if r.status_code == 200 and path == "/" and (media or "").startswith("text/html"):
            # Подменить в HTML пути: "/src/ -> "/dev/src/, "/@vite/ -> "/dev/@vite/
            try:
                text = content.decode("utf-8")
                text = re.sub(r'(href|src)=(["\'])/(?!dev/)([^"\']*)', r'\1=\2/dev/\3', text)
                content = text.encode("utf-8")
            except Exception:
                pass
        return (content, media, r.status_code)


@app.get("/dev")
@app.get("/dev/")
@app.get("/dev/{rest:path}")
async def dev_proxy(rest: str = ""):
    """Отдаёт фронт с Vite dev server для тестов на localhost (без отдельного порта 5173 снаружи)."""
    path = "/" + rest if rest else "/"
    body, media_type, status = await proxy_to_vite(path)
    return Response(content=body, status_code=status, media_type=media_type)


dist_dir = Path(__file__).parent / "dist"
if dist_dir.exists():
    assets = dist_dir / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    def index():
        index_file = dist_dir / "index.html"
        if not index_file.exists():
            return HTMLResponse(content="React app not built. Run: cd frontend && npm run build", status_code=404)
        return FileResponse(index_file, media_type="text/html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
