#!/usr/bin/env bash
# 📁 Файл: SnackEnglish-app/backend/scripts/deploy.sh
#
# Безпечне оновлення SnackEnglish на сервері (репозиторій склоновано вручну).
# Запуск із кореня проєкту на сервері:
#   bash backend/scripts/deploy.sh
#
# Що робить:
#   1. Перевіряє backend/.env (обов'язкові змінні, немає тестового входу)
#   2. Бекап бази (якщо встановлено mongodump)
#   3. git pull (лише якщо на сервері немає ручних змін)
#   4. Збирає фронтенд і бекенд у ТИМЧАСОВІ папки — поки збірка не пройшла, бот працює як раніше
#   5. Підміняє зібране й перезапускає бекенд (pm2)
#   6. Перевіряє /health; не відповідає — автоматично повертає попередню версію
#
# Налаштування (необов'язково): PM2_NAME=snack-english-backend BRANCH=main bash backend/scripts/deploy.sh

set -euo pipefail

PM2_NAME="${PM2_NAME:-snack-english-backend}"
BRANCH="${BRANCH:-main}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
ENV_FILE="$BACKEND/.env"

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m⚠️  %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m⛔ %s\033[0m\n' "$1"; exit 1; }

# Значення змінної з backend/.env (без лапок і \r). Немає змінної — порожній рядок.
# "|| true" обов'язкове: без нього grep без збігів (set -o pipefail) мовчки зупиняв скрипт
env_value() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

cd "$ROOT"

# ---------- 1. .env ----------
say "1/6 Перевірка backend/.env"
[ -f "$ENV_FILE" ] || fail "Немає $ENV_FILE"
for name in BOT_TOKEN MONGODB_URI VITE_APP_URL VITE_ADMIN_ID; do
  [ -n "$(env_value "$name")" ] || fail "У backend/.env немає $name"
done
[ "$(env_value ALLOW_DEV_AUTH)" = "true" ] && fail "ALLOW_DEV_AUTH=true на сервері — будь-хто зможе увійти під будь-яким акаунтом. Прибери цей рядок."
[ "$(env_value NODE_ENV)" = "production" ] || warn "NODE_ENV не production — додай NODE_ENV=production у backend/.env"
[ -n "$(env_value GROQ_API_KEY)$(env_value OPENAI_API_KEY)" ] || warn "Немає GROQ_API_KEY / OPENAI_API_KEY — розпізнавання голосу не працюватиме"
[ -n "$(env_value OPENAI_API_KEY)" ] || warn "Немає OPENAI_API_KEY — озвучка уроків буде голосом телефона"
case "$(env_value VITE_APP_URL)" in https://*) ;; *) fail "VITE_APP_URL має починатися з https://";; esac
PORT="$(env_value PORT)"; PORT="${PORT:-3000}"
echo "OK"

# ---------- 2. Бекап ----------
say "2/6 Бекап бази"
if command -v mongodump >/dev/null 2>&1; then
  BACKUP_DIR="$HOME/backups/snack-$(date +%F-%H%M%S)"
  mongodump --uri="$(env_value MONGODB_URI)" --out="$BACKUP_DIR" --quiet
  echo "Бекап: $BACKUP_DIR"
else
  warn "mongodump не встановлено — бекап пропущено (встанови MongoDB Database Tools)"
fi

# ---------- 3. Код ----------
say "3/6 Оновлення коду ($BRANCH)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "На сервері є ручні зміни в коді (вище). Збережи їх або скасуй: git stash — і запусти знову."
fi
PREV="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW="$(git rev-parse HEAD)"
echo "Було: ${PREV:0:8}  Стало: ${NEW:0:8}"

# Відкат коду, якщо збірка не вдалась (зібране й запущене не чіпаємо)
rollback_code() {
  warn "Повертаю код на ${PREV:0:8}"
  git reset --hard "$PREV" >/dev/null
  rm -rf "$ROOT/dist-new" "$BACKEND/dist-new"
}

# ---------- 4. Збірка в тимчасові папки ----------
say "4/6 Збірка"
needs_install() { # $1 — папка з package-lock.json
  [ ! -d "$1/node_modules" ] || ! git diff --quiet "$PREV" "$NEW" -- "$1/package-lock.json" 2>/dev/null
}
# Кожен крок перевіряється явно: усередині "|| …" bash не зупиняється на помилці сам
build_all() {
  if needs_install "$ROOT"; then (cd "$ROOT" && npm ci) || return 1; fi
  if needs_install "$BACKEND"; then (cd "$BACKEND" && npm ci) || return 1; fi
  (cd "$ROOT" && npx tsc -b && npx vite build --outDir dist-new --emptyOutDir) || return 1
  (cd "$BACKEND" && npx tsc --outDir dist-new) || return 1
  [ -f "$ROOT/dist-new/index.html" ] || return 1
}
if ! build_all; then
  rollback_code
  fail "Збірка не вдалась — бот працює на попередній версії, нічого не змінено."
fi
echo "Зібрано"

# ---------- 5. Підміна й перезапуск ----------
say "5/6 Підміна й перезапуск"
swap_in() { # $1 — папка, де лежать dist і dist-new
  rm -rf "$1/dist-old"
  if [ -d "$1/dist" ]; then mv "$1/dist" "$1/dist-old"; fi
  mv "$1/dist-new" "$1/dist"
}
swap_back() {
  for dir in "$ROOT" "$BACKEND"; do
    if [ -d "$dir/dist-old" ]; then rm -rf "$dir/dist"; mv "$dir/dist-old" "$dir/dist"; fi
  done
}
swap_in "$ROOT"
swap_in "$BACKEND"

restart_backend() {
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env
  else
    # Перший запуск через pm2: робоча папка — backend (там .env, uploads, ../dist)
    (cd "$BACKEND" && pm2 start npm --name "$PM2_NAME" -- run start)
  fi
  pm2 save >/dev/null
}
restart_backend

# ---------- 6. Перевірка ----------
say "6/6 Перевірка сервера"
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; then healthy=true; break; fi
  sleep 1
done

if [ "$healthy" != true ]; then
  warn "Сервер не відповідає на /health — повертаю попередню версію"
  pm2 logs "$PM2_NAME" --lines 30 --nostream || true
  swap_back
  git reset --hard "$PREV" >/dev/null
  restart_backend
  fail "Оновлення скасовано, працює попередня версія (${PREV:0:8}). Логи — вище."
fi

printf '\n\033[1;32m✅ Оновлено до %s. Сервер відповідає.\033[0m\n' "${NEW:0:8}"
echo "Попередня збірка лежить у dist-old (для ручного відкату)."