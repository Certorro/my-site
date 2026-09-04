#!/usr/bin/env bash
# Проверка обработчика заявок перед мержем этапа 0.
#
# Отвечает на один вопрос: развёрнута ли новая версия Apps Script и можно ли
# вливать PR с новым клиентом. Ничего не записывает — используется health-check
# doGet, поэтому тестовых заявок в рабочей таблице не появляется.
#
# Запуск:  bash scripts/check-endpoint.sh

set -u

URL="https://script.google.com/macros/s/AKfycbwVMOdlCCm25uNf74ihEEQsZ3ARaGEnSF0thVSKkFxpOtYvd5j60bj4jc8Qwu2146JV/exec"

echo "Проверяю обработчик заявок…"
echo

BODY=$(curl -sL --max-time 25 "$URL" 2>/dev/null)
CORS=$(curl -sIL --max-time 25 -H "Origin: https://al-e.net" "$URL" 2>/dev/null \
       | grep -i "access-control-allow-origin" | tail -1)

if printf '%s' "$BODY" | grep -q '"service":"alter-ego-leads"'; then
  echo "  [OK]  Новая версия скрипта развёрнута."
  echo "        Ответ: $(printf '%s' "$BODY" | head -c 120)"
  echo
  if [ -n "$CORS" ]; then
    echo "  [OK]  Ответ читается из браузера: $CORS"
    echo
    echo "  ГОТОВО — можно вливать PR этапа 0:"
    echo "      gh pr merge 3 --merge --repo Certorro/my-site"
  else
    echo "  [!]   Заголовок Access-Control-Allow-Origin не виден."
    echo "        Скрипт развёрнут, но браузер может не прочитать ответ."
    echo "        НЕ мержите PR: сайт покажет ошибку при успешной отправке."
    echo "        Проверьте, что развёртывание открыто для «Все» (Anyone)."
  fi

elif printf '%s' "$BODY" | grep -q "doGet"; then
  echo "  [—]   Развёрнута ПРЕЖНЯЯ версия скрипта (функции doGet в ней нет)."
  echo
  echo "        Сайт сейчас работает штатно, заявки принимаются."
  echo "        Но PR этапа 0 мержить НЕЛЬЗЯ: новый клиент ждёт ответ в JSON,"
  echo "        которого прежний скрипт не отдаёт, и все отправки покажут ошибку."
  echo
  echo "        Что сделать: вставить scripts/apps-script.gs в редактор Apps Script,"
  echo "        выполнить функцию doGet один раз (выдать разрешения),"
  echo "        затем обновить СУЩЕСТВУЮЩЕЕ развёртывание новой версией."

else
  echo "  [?]   Неожиданный ответ — обработчик недоступен или изменился URL."
  echo "        Первые 200 символов ответа:"
  printf '%s\n' "$BODY" | head -c 200
  echo
fi
