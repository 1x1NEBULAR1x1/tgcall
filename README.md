# Telegram Mini App — селфи с фронтальной камеры

Мини-приложение в Telegram: съёмка с фронтальной камеры и сохранение фото на сервере.

## Состав

- **backend** — FastAPI: приём и сохранение фото (`/upload`, `/photos`)
- **bot** — aiogram: кнопка меню открывает Mini App
- **frontend** — React (Vite): камера, захват кадра, отправка на API

## Настройка

### 1. Бот в Telegram

1. Создай бота через [@BotFather](https://t.me/BotFather), получи токен.
2. Укажи домен для Mini App: BotFather → твой бот → Bot Settings → Menu Button → Configure menu button → введи URL (должен быть **HTTPS** в продакшене).

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Фото сохраняются в `backend/uploads/`.

### 3. Frontend (React)

Нужен HTTPS для работы в Telegram (кроме локального теста). Укажи URL API:

```bash
cd frontend
npm install
# Локально с туннелем (ngrok и т.п.):
VITE_API_URL=https://your-api-url.com npm run dev
# или для продакшена задай VITE_API_URL в .env и собери:
npm run build
```

Раздай собранный `frontend/dist` через любой хостинг (Vercel, Netlify, свой сервер с HTTPS).

### 4. Бот (Python)

```bash
cd bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export BOT_TOKEN=твой_токен_от_BotFather
export WEB_APP_URL=https://твой-фронт-url.com
python bot.py
```

`WEB_APP_URL` — полный HTTPS-адрес твоего Mini App (тот же, что в Menu Button).

## Локальный тест

- Запусти backend на `http://localhost:8000`.
- Запусти frontend с `VITE_API_URL=http://localhost:8000`, открой в браузере — камера и загрузка будут работать.
- В Telegram Mini App нужен HTTPS; для теста можно использовать [ngrok](https://ngrok.com) или аналог для backend и frontend.

## API

- `GET /health` — проверка работы.
- `POST /upload` — загрузка фото (multipart, поле `file`).
- `GET /photos` — список имён сохранённых файлов.
