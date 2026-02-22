# Деплой на сервер

## 1. Сборка и запуск

```bash
cd /home/tgcall
docker compose build --no-cache
docker compose up -d
```

## 2. Настройка .env

Создайте `backend/.env` на сервере:

```
BOT_TOKEN=ваш_токен_от_BotFather
JWT_SECRET=случайная_строка_для_JWT
WEB_APP_URL=https://ваш-домен-или-ngrok/
BOT_USERNAME=username_вашего_бота
```

**Важно:** `WEB_APP_URL` должен быть **HTTPS** — Telegram не принимает HTTP для Web App (кроме localhost).

Если у вас только IP (http://123.45.67.89:8080):
- Используйте **ngrok** на сервере: `ngrok http 8080` → получите https-URL
- Или настройте домен + Nginx + Let's Encrypt

## 3. Проверка

- Сайт: http://сервер:8080
- health: http://сервер:8080/health
- Логи: `docker compose logs -f`
