#!/bin/bash
# Выгрузка данных Яндекс Вебмастера по al-e.net в папку webmaster-export.
# Токен читается из secrets/yandex.txt и нигде не выводится.
set -euo pipefail
cd "$(dirname "$0")"
SECRETS="${YANDEX_TOKEN_FILE:-../../../secrets/yandex.txt}"
TOKEN="$(tr -d ' \n\r' < "$SECRETS")"
USER_ID=99435745
HOST="https:al-e.net:443"
BASE="https://api.webmaster.yandex.net/v4/user/$USER_ID/hosts/$HOST"
OUT="${WEBMASTER_OUT:-../../../webmaster-export}"
mkdir -p "$OUT"
FROM="$(date -u -v-90d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -d '90 days ago' +%Y-%m-%dT00:00:00Z)"
TO="$(date -u +%Y-%m-%dT00:00:00Z)"
get () {
  curl -sS -m 30 -H "Authorization: OAuth $TOKEN" "$BASE$2" -o "$OUT/$1.json" -w "$1: %{http_code}\n"
}
get info ""
get summary "/summary"
get diagnostics "/diagnostics"
get sitemaps "/sitemaps"
get user_sitemaps "/user-added-sitemaps"
get indexing "/indexing/history?date_from=$FROM&date_to=$TO"
get in_search "/search-urls/in-search/history?date_from=$FROM&date_to=$TO"
get queries "/search-queries/popular?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&query_indicator=AVG_CLICK_POSITION&limit=100"
get recrawl_quota "/recrawl/quota"
get important_urls "/important-urls"
get broken_links "/links/internal/broken/samples?limit=100"
echo "Готово. Файлы в папке $OUT — напишите Claude «выгрузил»."
