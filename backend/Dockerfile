# Сборка из корня проекта: docker build -f backend/Dockerfile .
# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend ./
ENV VITE_API_URL=
RUN npm run build

# Stage 2: backend + frontend dist
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/main.py backend/telegram_bot.py backend/rooms.py backend/auth.py ./
COPY --from=frontend /app/dist ./dist

EXPOSE 8080
CMD ["python", "main.py"]
