"""Telegram-бот: запускается в том же event loop, что и FastAPI."""
import os

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo, MenuButtonWebApp

BOT_TOKEN = os.environ.get("BOT_TOKEN")
WEB_APP_URL = os.environ.get("WEB_APP_URL")

dp = Dispatcher()


def web_app_keyboard(room_id: str = None) -> InlineKeyboardMarkup:
    url = WEB_APP_URL + ("?room=" + room_id if room_id else "")
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Присоединиться к видеозвонку", web_app=WebAppInfo(url=url))]
    ])


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    # /start или /start main или /start ROOM_ID — показываем кнопку с автоподключением к комнате
    parts = (message.text or "").split(maxsplit=1)
    args = (parts[1].strip() if len(parts) > 1 else "") or ""
    room_id = args if args else None
    if room_id:
        await message.answer(
            "Вас пригласили в видеозвонок. Нажмите кнопку ниже, чтобы присоединиться.",
            reply_markup=web_app_keyboard(room_id),
        )
    else:
        await message.answer(
            "Нажмите кнопку ниже, чтобы открыть приложение.",
            reply_markup=web_app_keyboard(),
        )


async def run_bot() -> None:
    """Запуск long-polling бота. Корутина выполняется до отмены задачи."""
    if not BOT_TOKEN:
        return
    bot = Bot(token=BOT_TOKEN)
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="Видеозвонок", web_app=WebAppInfo(url=WEB_APP_URL))
    )
    print(f"Bot started. Web App URL: {WEB_APP_URL}")
    await dp.start_polling(bot)
