#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Альтер-Эго — сборка статики перед публикацией.

Владелец разметки шапки, подвала и сеток карточек — этот скрипт.
Раньше шапку и подвал вставлял js/components.js прямо в браузере, а списки
статей и команды подгружались fetch'ем в пустые контейнеры. Из-за этого без
выполнения JS на страницах не оставалось ни одной ссылки навигации, а сетки
были пусты: для краулеров ИИ-систем, которые JS в основном не исполняют,
сайт выглядел набором несвязанных страниц.

Что делает скрипт:
  1. Вставляет шапку и подвал в HTML всех страниц;
  2. Пререндерит сетки статей и команды из data/*.json;
  3. Подставляет реквизиты из settings.json (ИНН, ОГРН, реестр);
  4. Добавляет og:image;
  5. Генерирует sitemap.xml из файлов на диске;
  6. Обновляет версию данных в js/script.js (вместо ?v=Date.now()).

Повторный запуск идемпотентен: блоки помечены маркерами AE:*:START/END и при
следующей сборке заменяются целиком.

Запуск:  python3 scripts/build.py
"""

import html
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://al-e.net"

# Каталоги и файлы, которые не публикуются и не собираются.
EXCLUDE_DIRS = {"admin", "context", "fonts", "scripts", "node_modules", ".git"}
EXCLUDE_FILES = {"home.html"}  # редирект-заглушка на index.html

OG_IMAGE = f"{SITE}/images/og-cover.jpg"


# ----------------------------------------------------------------------
# Данные
# ----------------------------------------------------------------------

def load_json(rel):
    with open(ROOT / rel, encoding="utf-8") as fh:
        return json.load(fh)


def esc(value):
    """Экранирование текста (в т.ч. кавычек — значения попадают и в атрибуты)."""
    return html.escape("" if value is None else str(value), quote=True)


MONTHS_RU = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
    7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября",
    12: "декабря",
}


def format_date_ru(value):
    """2024-11-15 -> «15 ноября 2024 г.» (как toLocaleDateString('ru-RU'))."""
    try:
        d = datetime.fromisoformat(str(value)[:10])
    except ValueError:
        return esc(value)
    return f"{d.day} {MONTHS_RU[d.month]} {d.year} г."


def reading_time(text):
    words = len((text or "").split())
    return max(1, round(words / 200))


def plural_sources(n):
    if n == 1:
        return "1 источник"
    if 2 <= n <= 4:
        return f"{n} источника"
    return f"{n} источников"


# ----------------------------------------------------------------------
# Вставка блоков по маркерам
# ----------------------------------------------------------------------

def replace_block(page_html, name, content, placeholder_pattern):
    """
    Заменяет содержимое между <!-- AE:NAME:START --> и <!-- AE:NAME:END -->.
    При первой сборке маркеров ещё нет — тогда заменяется плейсхолдер.
    """
    start, end = f"<!-- AE:{name}:START -->", f"<!-- AE:{name}:END -->"
    block = f"{start}\n{content}\n{end}"

    marked = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if marked.search(page_html):
        # lambda — чтобы \1, \g<> и обратные слэши в разметке не интерпретировались
        return marked.sub(lambda _m: block, page_html, count=1)

    if placeholder_pattern is None:
        return page_html

    placeholder = re.compile(placeholder_pattern, re.S)
    if placeholder.search(page_html):
        return placeholder.sub(lambda _m: block, page_html, count=1)

    return page_html


def set_element_text(page_html, element_id, text):
    """Подставляет текст внутрь элемента с заданным id (для реквизитов)."""
    pattern = re.compile(
        r'(<(\w+)\b[^>]*\bid="' + re.escape(element_id) + r'"[^>]*>)(.*?)(</\2>)',
        re.S,
    )
    return pattern.sub(lambda m: m.group(1) + esc(text) + m.group(4), page_html, count=1)


# ----------------------------------------------------------------------
# Шапка и подвал — единственное определение разметки
# ----------------------------------------------------------------------

PHONE_HREF = "tel:+79169286505"

NAV_ITEMS = [
    ("index.html", "Главная"),
    ("about.html", "О нас"),
    ("services.html", "Услуги"),
    ("team.html", "Партнёры"),
    ("articles.html", "Статьи"),
]


def phone_icon(size):
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 '
        '01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 '
        '19.79 0 01.07 1.18 2 2 0 012.07-.01h3a2 2 0 012 1.72c.127.96.361 '
        '1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.41-.41a2 2 0 '
        '012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>'
    )


def render_header(r, active, phone_text):
    links = []
    for href, label in NAV_ITEMS:
        cls = ' class="nav-active"' if href == active else ""
        links.append(f'        <a href="{r}{href}"{cls}>{label}</a>')
    nav = "\n".join(links)
    cta_cls = "nav-cta nav-active" if active == "contact.html" else "nav-cta"
    return f"""<header id="header">
  <div class="container header-inner">
    <a href="{r}index.html" class="logo">
      <img src="{r}logo.png" alt="" class="logo-mark" aria-hidden="true" width="68" height="68">
      <div class="logo-text">
        <span class="logo-name">Альтер-Эго</span>
        <span class="logo-sub">Адвокатская коллегия</span>
      </div>
    </a>
    <nav class="nav-links" id="navLinks" aria-label="Основная навигация">
{nav}
      <a href="{r}contact.html" class="{cta_cls}">Связаться</a>
      <a href="{PHONE_HREF}" class="nav-phone-drawer">{phone_icon(15)}{esc(phone_text)}</a>
    </nav>
    <a href="{PHONE_HREF}" class="header-phone" aria-label="Позвонить: {esc(phone_text)}">{phone_icon(18)}<span class="header-phone-text">{esc(phone_text)}</span></a>
    <button class="burger" id="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="navLinks">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>"""


FOOTER_NAV = [
    ("about.html", "О коллегии"),
    ("services.html", "Услуги"),
    ("team.html", "Партнёры"),
    ("articles.html", "Публикации"),
    ("contact.html", "Контакты"),
]

FOOTER_PRACTICE = [
    ("services.html", "Уголовные дела"),
    ("services.html", "Арбитраж"),
    ("services.html", "Семейное право"),
    ("services.html", "Недвижимость"),
    ("privacy.html", "Политика конфиденциальности"),
]


def render_footer(r, settings, year):
    def li(items):
        return "\n".join(
            f'          <li><a href="{r}{href}">{label}</a></li>' for href, label in items
        )

    return f"""<footer>
  <div class="container">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="logo">
          <span class="logo-name">Альтер-Эго</span>
          <span class="logo-sub">Адвокатская коллегия</span>
        </div>
        <p style="margin-top:16px">Профессиональная юридическая помощь. Действуем на основании ФЗ-63 «Об адвокатской деятельности и адвокатуре в РФ».</p>
      </div>
      <div class="footer-nav">
        <h4>Навигация</h4>
        <ul>
{li(FOOTER_NAV)}
        </ul>
      </div>
      <div class="footer-nav">
        <h4>Практика</h4>
        <ul>
{li(FOOTER_PRACTICE)}
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      <div class="footer-legal-grid" id="footerLegalGrid">
        <div class="legal-item"><strong>Полное наименование</strong><span id="legalFullName">{esc(settings.get('fullName'))}</span></div>
        <div class="legal-item"><strong>ИНН / ОГРН</strong><span id="legalINN">{esc(settings.get('inn'))}</span> / <span id="legalOGRN">{esc(settings.get('ogrn'))}</span></div>
        <div class="legal-item"><strong>Реестр адвокатских образований</strong><span id="legalReestry">{esc(settings.get('reestryNumber'))}</span></div>
        <div class="legal-item"><strong>Адрес</strong><span id="factAddress">{esc(settings.get('address'))}</span></div>
        <div class="legal-item"><strong>Адвокатская палата</strong><span id="advokatPalata">{esc(settings.get('advokatPalata'))}</span></div>
      </div>
      <div class="footer-bottom">
        <div>
          <div>© <span id="footerYear">{year}</span> Адвокатская коллегия Альтер-Эго. Все права защищены.</div>
          <div class="footer-disclaimer" style="margin-top:6px">Информация на сайте носит общеознакомительный характер и не является юридической консультацией или публичной офертой.</div>
        </div>
        <div class="footer-bottom-right">
          <span class="age-mark">0+</span>
          <button class="cookie-manage-btn" id="cookieManageBtn" type="button">Управление cookie</button>
        </div>
      </div>
    </div>
  </div>
</footer>"""


# ----------------------------------------------------------------------
# Карточки
# ----------------------------------------------------------------------

def article_card(a, r=""):
    """Карточка статьи для articles.html и главной."""
    mins = reading_time(a.get("content") or a.get("summary") or "")
    src_count = len(a.get("sources") or [])
    slug = a.get("slug")
    href = f"{r}articles/{esc(slug)}.html" if slug else f"{r}articles.html"
    src_html = (
        f'<span class="article-src-count">{plural_sources(src_count)}</span>'
        if src_count else ""
    )
    return f"""      <div class="article-card">
        <div class="article-card-meta-row">
          <div class="article-category">{esc(a.get('category'))}</div>
        </div>
        <h3><a href="{href}">{esc(a.get('title'))}</a></h3>
        <div class="article-date">
          {format_date_ru(a.get('date'))}
          <span class="article-reading-time">{mins} мин</span>
          {src_html}
        </div>
        <div class="article-excerpt">{esc(a.get('summary'))}</div>
        <a href="{href}" class="read-more">Читать далее →</a>
      </div>"""


def lawyer_photo(l, r, placeholder_svg):
    photo = l.get("photo")
    if not photo:
        return placeholder_svg
    # В lawyers.json пути записаны от корня сайта.
    src = photo if photo.startswith(("http://", "https://", "/")) else f"{r}{photo}"
    return (
        f'<img src="{esc(src)}" alt="{esc(l.get("name"))}" loading="lazy" '
        'width="400" height="500">'
    )


CARD_PLACEHOLDER = (
    '<div class="lawyer-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" '
    'stroke="currentColor" stroke-width="1.2" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 '
    '4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>'
)

FULL_PLACEHOLDER = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 '
    '21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
)


def lawyer_card(l, r=""):
    """Карточка адвоката для тёмной секции на главной."""
    slug = l.get("slug")
    name = esc(l.get("name"))
    name_html = f'<a href="{r}team/{esc(slug)}.html" style="color:inherit;text-decoration:none">{name}</a>' if slug else name
    bio = (
        f'<p style="color:rgba(255,255,255,0.48);font-size:0.82rem;margin-top:10px;line-height:1.6">{esc(l.get("bio"))}</p>'
        if l.get("bio") else ""
    )
    reg = f'<div class="lawyer-reg">Рег. № {esc(l.get("regNumber"))}</div>' if l.get("regNumber") else ""
    palata = f'<div class="lawyer-palata">{esc(l.get("palata"))}</div>' if l.get("palata") else ""
    return f"""      <div class="lawyer-card fade-up">
        <div class="lawyer-photo{' lawyer-photo--cutout' if l.get('photoCutout') else ''}">{lawyer_photo(l, r, CARD_PLACEHOLDER)}</div>
        <div class="lawyer-info">
          <h3>{name_html}</h3>
          <div class="lawyer-spec">{esc(l.get('specialization') or l.get('position'))}</div>
          <div class="lawyer-exp">{esc(l.get('experience'))}</div>
          {bio}
          {reg}
          {palata}
        </div>
      </div>"""


def lawyer_full_card(l, r=""):
    """Развёрнутая карточка для team.html."""
    slug = l.get("slug")
    name = esc(l.get("name"))
    name_html = f'<a href="{r}team/{esc(slug)}.html" style="color:inherit;text-decoration:none">{name}</a>' if slug else name
    bio = f'<p class="lawyer-full-bio">{esc(l.get("bio"))}</p>' if l.get("bio") else ""
    meta = []
    if l.get("experience"):
        meta.append(f'<span><strong>Опыт:</strong> {esc(l.get("experience"))}</span>')
    if l.get("regNumber"):
        meta.append(f'<span><strong>Рег. №</strong> {esc(l.get("regNumber"))}</span>')
    if l.get("palata"):
        meta.append(f'<span><strong>Палата:</strong> {esc(l.get("palata"))}</span>')
    return f"""      <div class="lawyer-full-card fade-up">
        <div class="lawyer-full-photo{' lawyer-full-photo--cutout' if l.get('photoCutout') else ''}">{lawyer_photo(l, r, FULL_PLACEHOLDER)}</div>
        <div class="lawyer-full-info">
          <h3>{name_html}</h3>
          <div class="lawyer-full-spec">{esc(l.get('specialization') or l.get('position'))}</div>
          {bio}
          <div class="lawyer-full-meta">
            {''.join(meta)}
          </div>
        </div>
      </div>"""


# ----------------------------------------------------------------------
# Сборка страниц
# ----------------------------------------------------------------------

def iter_pages():
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT)
        if set(rel.parts) & EXCLUDE_DIRS:
            continue
        if rel.name in EXCLUDE_FILES or rel.name.startswith("yandex_"):
            continue
        yield path, rel


def active_page_for(rel):
    """Какой пункт меню подсвечивать."""
    if rel.parts[0] == "articles":
        return "articles.html" if len(rel.parts) > 1 else rel.name
    if rel.parts[0] == "team":
        return "team.html" if len(rel.parts) > 1 else rel.name
    return rel.name


def og_tags(rel):
    url = SITE + "/" + ("" if rel.name == "index.html" and len(rel.parts) == 1 else str(rel).replace("\\", "/"))
    return f"""  <meta property="og:image" content="{OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Адвокатская коллегия «Альтер-Эго», Москва">
  <meta name="twitter:image" content="{OG_IMAGE}">
  <meta property="og:url" content="{url}">"""


def build_pages(settings, lawyers, articles, year):
    phone = settings.get("phone", "+7 (916) 928-65-05")
    count = 0

    for path, rel in iter_pages():
        page = path.read_text(encoding="utf-8")
        original = page
        depth = len(rel.parts) - 1
        r = "../" * depth

        page = replace_block(
            page, "HEADER",
            render_header(r, active_page_for(rel), phone),
            r'<div id="header-placeholder"></div>',
        )
        page = replace_block(
            page, "FOOTER",
            render_footer(r, settings, year),
            r'<div id="footer-placeholder"></div>',
        )

        # og:image — вставляется один раз перед </head>
        if "<!-- AE:OG:START -->" in page:
            page = replace_block(page, "OG", og_tags(rel), None)
        else:
            page = page.replace(
                "</head>",
                f"<!-- AE:OG:START -->\n{og_tags(rel)}\n<!-- AE:OG:END -->\n</head>",
                1,
            )

        # Реквизиты вместо [ИНН] / [ОГРН] / [Номер в реестре] на about.html
        page = fill_legal_outside_footer(page, settings)

        # Пререндер сеток
        if rel.name == "index.html" and depth == 0:
            page = prerender_grid(
                page, "TEAM_GRID", "teamGrid",
                "\n".join(lawyer_card(l, r) for l in lawyers),
            )
            page = prerender_grid(
                page, "ARTICLES_GRID", "articlesGrid",
                "\n".join(article_card(a, r) for a in articles[:3]),
            )
        elif rel.name == "team.html" and depth == 0:
            page = prerender_grid(
                page, "TEAM_FULL_GRID", "teamFullGrid", render_team_full(lawyers, r)
            )
        elif rel.name == "articles.html" and depth == 0:
            # Все статьи целиком: критерий этапа — 19 ссылок в HTML без JS.
            # Пагинация (PER_PAGE) включается только после клика по фильтру.
            page = prerender_grid(
                page, "ALL_ARTICLES_GRID", "allArticlesGrid",
                "\n".join(article_card(a, r) for a in articles),
            )

        if page != original:
            path.write_text(page, encoding="utf-8")
            count += 1

    return count


def fill_legal_outside_footer(page, settings):
    """
    Реквизиты на about.html лежат вне подвала и без JS показывали [ИНН]/[ОГРН].
    Подвал собран выше уже с значениями, повторная подстановка его не меняет.
    """
    marker = "<!-- AE:FOOTER:START -->"
    head, sep, rest = page.partition(marker)  # partition — чтобы не потерять хвост
    tail = sep + rest

    for element_id, key in (
        ("legalFullName", "fullName"),
        ("legalINN", "inn"),
        ("legalOGRN", "ogrn"),
        ("legalReestry", "reestryNumber"),
        ("factAddress", "address"),
        ("advokatPalata", "advokatPalata"),
    ):
        if settings.get(key):
            head = set_element_text(head, element_id, settings[key])

    return head + tail


def render_team_full(lawyers, r):
    advocates = [l for l in lawyers if l.get("position") != "Партнёр"]
    partners = [l for l in lawyers if l.get("position") == "Партнёр"]
    parts = [lawyer_full_card(l, r) for l in advocates]
    if partners:
        parts.append(
            '      <div class="team-section-divider">'
            '<span class="section-label">Партнёры</span>'
            "<h3>Партнёры коллегии</h3></div>"
        )
        parts.extend(lawyer_full_card(l, r) for l in partners)
    return "\n".join(parts)


def prerender_grid(page, marker, element_id, content):
    """
    Кладёт готовую разметку внутрь контейнера сетки и помечает его
    data-prerendered="true" — по этому флагу JS не перерисовывает её при загрузке.
    """
    start, end = f"<!-- AE:{marker}:START -->", f"<!-- AE:{marker}:END -->"
    inner = f"{start}\n{content}\n{end}"

    # Повторная сборка: заменяем строго между маркерами. Ориентироваться на
    # первый </div> нельзя — внутри уже лежат вложенные карточки, и нежадное
    # совпадение обрывалось на первой из них, дописывая сетку к самой себе.
    marked = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if marked.search(page):
        return marked.sub(lambda _m: inner, page, count=1)

    # Первая сборка: внутри только пробелы и комментарий-заглушка
    # («Заполняется из script.js»). Вложенную разметку шаблон намеренно
    # не захватывает — иначе сетка снова начнёт дописываться к самой себе.
    pattern = re.compile(
        r'(<div\b[^>]*\bid="' + re.escape(element_id) + r'"[^>]*>)'
        r'((?:\s|<!--.*?-->)*)'
        r'(</div>)',
        re.S,
    )
    match = pattern.search(page)
    if not match:
        return page

    open_tag = match.group(1)
    if "data-prerendered" not in open_tag:
        open_tag = open_tag[:-1] + ' data-prerendered="true">'

    return page[: match.start()] + f"{open_tag}\n{inner}\n    </div>" + page[match.end():]


# ----------------------------------------------------------------------
# sitemap.xml
# ----------------------------------------------------------------------

PRIORITIES = {
    "index.html": ("1.0", "weekly"),
    "services.html": ("0.9", "monthly"),
    "team.html": ("0.8", "monthly"),
    "articles.html": ("0.8", "weekly"),
    "about.html": ("0.7", "monthly"),
    "contact.html": ("0.7", "monthly"),
    "privacy.html": ("0.3", "yearly"),
}


def build_sitemap():
    entries = []
    for path, rel in iter_pages():
        rel_str = str(rel).replace("\\", "/")
        loc = SITE + "/" + ("" if rel_str == "index.html" else rel_str)
        lastmod = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d")

        if rel.parts[0] == "articles" and len(rel.parts) > 1:
            priority, freq = "0.6", "yearly"
        elif rel.parts[0] == "team" and len(rel.parts) > 1:
            priority, freq = "0.6", "yearly"
        else:
            priority, freq = PRIORITIES.get(rel.name, ("0.5", "monthly"))

        entries.append((loc, lastmod, freq, priority))

    entries.sort(key=lambda e: (-float(e[3]), e[0]))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod, freq, priority in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")

    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(entries)


# ----------------------------------------------------------------------
# Версия данных вместо ?v=Date.now()
# ----------------------------------------------------------------------

def stamp_data_version(stamp):
    path = ROOT / "js" / "script.js"
    source = path.read_text(encoding="utf-8")
    updated = re.sub(
        r"const DATA_VERSION = '[^']*';",
        lambda _m: f"const DATA_VERSION = '{stamp}';",
        source,
        count=1,
    )
    if updated != source:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


# ----------------------------------------------------------------------

def main():
    settings = load_json("data/settings.json")
    lawyers = load_json("data/lawyers.json")
    articles = load_json("data/articles.json")
    year = datetime.now().year
    stamp = datetime.now().strftime("%Y%m%d%H%M")

    pages = build_pages(settings, lawyers, articles, year)
    urls = build_sitemap()
    stamped = stamp_data_version(stamp)

    print(f"Страниц обновлено:      {pages}")
    print(f"URL в sitemap.xml:      {urls}")
    print(f"Статей в data:          {len(articles)}")
    print(f"Адвокатов в data:       {len(lawyers)}")
    print(f"Версия данных:          {stamp} {'(записана)' if stamped else '(без изменений)'}")


if __name__ == "__main__":
    main()
