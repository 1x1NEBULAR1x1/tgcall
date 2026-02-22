FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py telegram_bot.py rooms.py auth.py ./

# Статика фронта: соберите и скопируйте в backend перед сборкой образа:
#   cd frontend && npm run build && cp -r dist ../backend/
# Затем раскомментируйте следующую строку:
# COPY dist/ ./dist/

EXPOSE 8080

CMD ["python", "main.py"]
