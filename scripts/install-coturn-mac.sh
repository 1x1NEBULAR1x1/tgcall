#!/bin/bash
# Установка coturn на Mac из исходников (git)
# Требуется: Homebrew, sudo

set -e

echo "=== Установка зависимостей ==="
brew install libevent

echo "=== Клонирование coturn ==="
COTURN_DIR="/tmp/coturn"
if [ ! -d "$COTURN_DIR" ]; then
  git clone https://github.com/coturn/coturn.git "$COTURN_DIR"
fi
cd "$COTURN_DIR"
git pull 2>/dev/null || true

echo "=== Конфигурация (без MySQL) ==="
# Ограничиваем PATH, чтобы configure не нашёл mysql из XAMPP
PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin" ./configure

echo "=== Сборка ==="
make -j4

echo "=== Установка (потребуется пароль sudo) ==="
sudo make install

echo "=== Coturn установлен ==="
which turnserver && turnserver --version 2>/dev/null || echo "turnserver готов"
echo ""
echo "Создайте конфиг: sudo cp /usr/local/etc/turnserver.conf.default /usr/local/etc/turnserver.conf"
echo "Отредактируйте: sudo nano /usr/local/etc/turnserver.conf"
echo "Запуск: turnserver -c /usr/local/etc/turnserver.conf"
