"""Валидация Telegram WebApp initData и выдача JWT."""
import hmac
import hashlib
import json
import os
from urllib.parse import parse_qs, unquote

import jwt

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
JWT_SECRET = os.environ.get("JWT_SECRET", BOT_TOKEN or "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_SECONDS = 7 * 24 * 3600  # 7 дней


def validate_telegram_init_data(init_data: str) -> dict | None:
    """Проверяет подпись initData от Telegram WebApp. Возвращает dict с данными или None."""
    if not init_data or not BOT_TOKEN:
        return None
    parsed = parse_qs(init_data, keep_blank_values=True)
    hash_val = parsed.get("hash", [None])[0]
    if not hash_val:
        return None
    data_check_parts = []
    for key in sorted(parsed.keys()):
        if key == "hash":
            continue
        value = parsed[key][0]
        data_check_parts.append(f"{key}={unquote(value)}")
    data_check_string = "\n".join(data_check_parts)
    secret_key = hmac.new(
        b"WebAppData",
        BOT_TOKEN.encode(),
        hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()
    if expected_hash != hash_val:
        return None
    user_str = parsed.get("user", [None])[0]
    if user_str:
        try:
            user = json.loads(unquote(user_str))
        except (json.JSONDecodeError, TypeError):
            user = {}
    else:
        user = {}
    return {
        "user_id": user.get("id"),
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "username": user.get("username", ""),
    }


def create_token(payload: dict) -> str:
    """Создаёт JWT с user_id и exp."""
    return jwt.encode(
        {
            "user_id": payload["user_id"],
            "first_name": payload.get("first_name", ""),
            "username": payload.get("username", ""),
            "exp": __import__("time").time() + JWT_EXPIRES_SECONDS,
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict | None:
    """Декодирует и проверяет JWT. Возвращает payload или None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None
