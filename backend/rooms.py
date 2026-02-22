"""Управление комнатами конференций (in-memory)."""
import uuid
import time

# Общая комната для всех — всегда существует
GLOBAL_ROOM_ID = "main"

# room_id -> { "created_at": float, "creator_id": int }
_rooms: dict[str, dict] = {}


def create_room(creator_id: int) -> str:
    room_id = uuid.uuid4().hex[:10]
    _rooms[room_id] = {"created_at": time.time(), "creator_id": creator_id}
    return room_id


def room_exists(room_id: str) -> bool:
    return room_id == GLOBAL_ROOM_ID or room_id in _rooms


def get_room(room_id: str) -> dict | None:
    return _rooms.get(room_id)
