#!/bin/bash
# Запуск coturn из собранных исходников (без make install)
# Конфиг: coturn/turnserver.conf

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COTURN_BIN="/tmp/coturn/bin/turnserver"
CONFIG="$PROJECT_DIR/coturn/turnserver.conf"

if [ ! -f "$COTURN_BIN" ]; then
  echo "Coturn не собран. Выполните: ./scripts/install-coturn-mac.sh"
  exit 1
fi

if [ ! -f "$CONFIG" ]; then
  echo "Конфиг не найден: $CONFIG"
  exit 1
fi

echo "Запуск coturn: $COTURN_BIN -c $CONFIG"
"$COTURN_BIN" -c "$CONFIG"
