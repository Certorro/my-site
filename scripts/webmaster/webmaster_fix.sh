#!/bin/bash
# Исправления в Яндекс Вебмастере для al-e.net:
#  1) удаляет ошибочный sitemap «http://sitemap.xml», добавленный вручную;
#  2) добавляет https://al-e.net/sitemap.xml;
#  3) отправляет все страницы из живого sitemap на переобход (квота 150 в день).
# Токен читается из secrets/yandex.txt и нигде не выводится.
set -uo pipefail
cd "$(dirname "$0")"
SECRETS="${YANDEX_TOKEN_FILE:-../../../secrets/yandex.txt}"
TOKEN="$(tr -d ' \n\r' < "$SECRETS")"
BASE="https://api.webmaster.yandex.net/v4/user/99435745/hosts/https:al-e.net:443"
OUT="${WEBMASTER_OUT:-../../../webmaster-export}"; mkdir -p "$OUT"
LOG="$OUT/fix-log.txt"; : > "$LOG"
api () { # method path [json] — до 4 попыток при 5xx и обрыве связи
  local code="" i
  for i in 1 2 3 4; do
    if [ $# -ge 3 ]; then
      code=$(curl -sS -m 60 -X "$1" -H "Authorization: OAuth $TOKEN" -H "Content-Type: application/json" -d "$3" "$BASE$2" -o /tmp/wm_resp.$$ -w "%{http_code}" 2>/dev/null)
    else
      code=$(curl -sS -m 60 -X "$1" -H "Authorization: OAuth $TOKEN" "$BASE$2" -o /tmp/wm_resp.$$ -w "%{http_code}" 2>/dev/null)
    fi
    case "$code" in 5*|000) sleep $((i*10));; *) break;; esac
  done
  echo "  HTTP $code (попыток: $i) $(head -c 200 /tmp/wm_resp.$$ 2>/dev/null)"
  rm -f /tmp/wm_resp.$$
}
echo "1) Удаляю ошибочный sitemap" | tee -a "$LOG"
api DELETE "/user-added-sitemaps/3e8bcb20-f257-3409-b01f-b35c42dbd48d" >> "$LOG" 2>&1
echo "2) Добавляю https://al-e.net/sitemap.xml" | tee -a "$LOG"
api POST "/user-added-sitemaps" '{"url":"https://al-e.net/sitemap.xml"}' >> "$LOG" 2>&1
echo "3) Отправляю страницы на переобход" | tee -a "$LOG"
URLS="$(curl -sS -m 30 https://al-e.net/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed -e 's#<loc>##' -e 's#</loc>##')"
N=0
for u in $URLS; do
  printf '%s' "$u" >> "$LOG"
  R=$(api POST "/recrawl/queue" "{\"url\":\"$u\"}"); echo "$R" >> "$LOG"; echo "$u$R"
  N=$((N+1)); sleep 0.3
done
echo "Отправлено страниц: $N" | tee -a "$LOG"
api GET "/recrawl/quota" >> "$LOG" 2>&1
echo "Готово. Журнал: $LOG — напишите Claude «готово»."
