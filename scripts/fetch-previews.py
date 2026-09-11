#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Собирает превью внешних ссылок: заголовок и миниатюру.

Зачем отдельным скриптом, а не внутри build.py: сборка обязана быть
офлайновой и воспроизводимой. Если бы build.py ходил в сеть, результат
зависел бы от доступности чужих сайтов, а повторный запуск перестал бы
быть идемпотентным. Поэтому здесь — сеть и кэш, а build.py только читает
готовый data/link-previews.json.

Запуск:  python3 scripts/fetch-previews.py            # только новые ссылки
         python3 scripts/fetch-previews.py --refresh  # перекачать всё

Миниатюры приводятся к единому размеру THUMB_W×THUMB_H кадрированием по
центру: в списке они стоят колонкой, и разнобой по высоте ломал бы строй.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data/link-previews.json"
THUMB_DIR = ROOT / "images/previews"

THUMB_W, THUMB_H = 240, 180          # отдаём @2x, в вёрстке показываем 120×90
TIMEOUT = 12
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

META_PATTERNS = {
    "image": (r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
              r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
              r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'),
    "title": (r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
              r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
              r'<title[^>]*>(.*?)</title>'),
    "site":  (r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)',),
}


def key_for(url):
    return hashlib.md5(url.encode("utf-8")).hexdigest()[:10]


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "*/*" if binary else "text/html,application/xhtml+xml",
        "Accept-Language": "ru,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read(8_000_000 if binary else 600_000)
    if binary:
        return raw
    charset = "utf-8"
    for enc in ("utf-8", "windows-1251"):
        try:
            text = raw.decode(enc)
            if "�" not in text[:4000]:
                charset = enc
                break
        except UnicodeDecodeError:
            continue
    return raw.decode(charset, errors="replace")


def first_match(html, patterns):
    for pat in patterns:
        m = re.search(pat, html, re.I | re.S)
        if m:
            value = re.sub(r"\s+", " ", m.group(1)).strip()
            if value:
                return unescape(value)
    return None


def unescape(value):
    import html as _html
    return _html.unescape(value)


def make_thumb(data, dest):
    """Пропорционально масштабирует, затем кадрирует по центру до THUMB_W×THUMB_H."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".img") as tmp:
        tmp.write(data)
        src = tmp.name
    try:
        probe = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", src],
                               capture_output=True, text=True, timeout=30)
        dims = dict(re.findall(r"(pixelWidth|pixelHeight):\s*(\d+)", probe.stdout))
        w, h = int(dims.get("pixelWidth", 0)), int(dims.get("pixelHeight", 0))
        if w < 40 or h < 40:
            return None

        scale = max(THUMB_W / w, THUMB_H / h)
        new_w, new_h = max(THUMB_W, round(w * scale)), max(THUMB_H, round(h * scale))

        dest.parent.mkdir(parents=True, exist_ok=True)
        steps = [
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "72",
             "--resampleHeightWidth", str(new_h), str(new_w), src, "--out", str(dest)],
            ["sips", "-c", str(THUMB_H), str(THUMB_W), str(dest)],
        ]
        for cmd in steps:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if res.returncode != 0:
                return None
        return dest.stat().st_size
    finally:
        Path(src).unlink(missing_ok=True)


def collect_sources():
    articles = json.loads((ROOT / "data/articles.json").read_text(encoding="utf-8"))
    seen, items = set(), []
    for a in articles:
        for s in (a.get("sources") or []):
            url = (s.get("url") or "").strip()
            if url and url not in seen:
                seen.add(url)
                items.append({"url": url, "outlet": s.get("outlet"), "given": s.get("title")})
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="перекачать даже то, что в кэше")
    args = ap.parse_args()

    if not shutil.which("sips"):
        sys.exit("sips не найден — миниатюры собрать нечем (нужен macOS).")

    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    items = collect_sources()
    print(f"Внешних ссылок: {len(items)}\n")

    ok = failed = skipped = 0
    for item in items:
        url = item["url"]
        host = urllib.parse.urlparse(url).netloc
        if not args.refresh and url in cache:
            skipped += 1
            continue

        entry = {"outlet": item["outlet"], "host": host,
                 "title": item["given"], "image": None,
                 "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
        try:
            page = fetch(url)
            entry["title"] = first_match(page, META_PATTERNS["title"]) or item["given"]
            entry["siteName"] = first_match(page, META_PATTERNS["site"]) or item["outlet"]
            img = first_match(page, META_PATTERNS["image"])
            if img:
                img = urllib.parse.urljoin(url, img)
                dest = THUMB_DIR / f"{key_for(url)}.jpg"
                size = make_thumb(fetch(img, binary=True), dest)
                if size:
                    entry["image"] = f"images/previews/{dest.name}"
                    entry["bytes"] = size
            print(f"  ✓ {host:<24} {'миниатюра' if entry['image'] else 'только заголовок'}")
            ok += 1
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "code", None) or type(exc).__name__
            print(f"  ✗ {host:<24} {reason}")
            failed += 1
            # Неудачу в кэш не кладём: иначе следующий запуск её пропустит и
            # ссылка навсегда останется без превью. Отказы часто временные —
            # тайм-аут, лимит запросов, — и повтор их вылечивает.
            continue
        cache[url] = entry

    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_img = sum(1 for v in cache.values() if v.get("image"))
    print(f"\nПолучено: {ok}   ошибок: {failed}   из кэша: {skipped}")
    print(f"В кэше всего: {len(cache)}, из них с миниатюрой: {with_img}")


if __name__ == "__main__":
    main()
