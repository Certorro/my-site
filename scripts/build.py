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

import hashlib
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


def load_previews():
    """Кэш превью внешних ссылок. Его может не быть — сборка обязана работать.

    Наполняется отдельно: python3 scripts/fetch-previews.py
    """
    path = ROOT / "data/link-previews.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as fh:
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

# ----------------------------------------------------------------------
# Связка «статья ↔ адвокат»
#
# Отношение хранится в одном месте — полем lawyers у статьи в
# data/articles.json. Обратный список у адвоката намеренно не заводится:
# две копии одного отношения неизбежно разойдутся. Оба направления —
# тег на статье и блок публикаций в профиле — выводятся отсюда, поэтому
# согласованы по построению, а не по дисциплине редактора.
# ----------------------------------------------------------------------

def short_name(full):
    """«Скрипилев Евгений Владимирович» → «Скрипилев Е. В.» — для тега."""
    parts = (full or "").split()
    if len(parts) >= 3:
        return f"{parts[0]} {parts[1][0]}. {parts[2][0]}."
    return full or ""


def article_lawyers(a, by_slug):
    """Пары (адвокат, роль) для статьи. Неизвестные slug молча отбрасываются."""
    pairs = []
    for link in (a.get("lawyers") or []):
        lawyer = by_slug.get(link.get("slug"))
        if lawyer:
            pairs.append((lawyer, link.get("role") or ""))
    return pairs


def lawyer_articles(slug, articles):
    """Публикации адвоката, свежие сверху."""
    items = [
        a for a in articles
        if any(x.get("slug") == slug for x in (a.get("lawyers") or []))
    ]
    return sorted(items, key=lambda a: a.get("date") or "", reverse=True)


def role_in(a, slug):
    for link in (a.get("lawyers") or []):
        if link.get("slug") == slug:
            return link.get("role") or ""
    return ""


TAG_ICON = (
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true">'
    '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>'
    '<circle cx="12" cy="7" r="4"/></svg>'
)


def lawyer_tag(lawyer, role, r):
    """Тег со сквозной ссылкой из статьи в личное дело адвоката."""
    href = f'{r}team/{esc(lawyer.get("slug"))}.html'
    label = f'{role} — перейти к адвокату' if role else "Перейти к адвокату"
    return (
        f'<a class="article-lawyer-tag" href="{href}" title="{esc(label)}">'
        f'{TAG_ICON}<span>{esc(short_name(lawyer.get("name")))}</span></a>'
    )


def article_card(a, r="", by_slug=None):
    """Карточка статьи для articles.html и главной."""
    mins = reading_time(a.get("content") or a.get("summary") or "")
    src_count = len(a.get("sources") or [])
    slug = a.get("slug")
    href = f"{r}articles/{esc(slug)}.html" if slug else f"{r}articles.html"
    src_html = (
        f'<span class="article-src-count">{plural_sources(src_count)}</span>'
        if src_count else ""
    )
    tags = "".join(
        lawyer_tag(lawyer, role, r)
        for lawyer, role in article_lawyers(a, by_slug or {})
    )
    return f"""      <div class="article-card">
        <div class="article-card-meta-row">
          <div class="article-category">{esc(a.get('category'))}</div>
          {tags}
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


def insert_block(page_html, name, content, anchor_pattern):
    """
    Как replace_block, но при первой сборке якорь не заменяется, а блок
    встаёт перед ним. Нужно там, где в разметке нет плейсхолдера и его
    некуда поставить, не трогая авторскую вёрстку страницы.
    """
    start, end = f"<!-- AE:{name}:START -->", f"<!-- AE:{name}:END -->"
    block = f"{start}\n{content}\n{end}"

    marked = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if marked.search(page_html):
        return marked.sub(lambda _m: block, page_html, count=1)

    if not content:
        return page_html

    match = re.compile(anchor_pattern, re.S).search(page_html)
    if not match:
        return page_html
    return page_html[: match.start()] + block + "\n\n    " + page_html[match.start():]


def render_article_lawyers(a, by_slug, r):
    """Блок «Адвокат по делу» на странице статьи — подпись под материалом."""
    pairs = article_lawyers(a, by_slug)
    if not pairs:
        return ""

    cards = []
    for lawyer, role in pairs:
        href = f'{r}team/{esc(lawyer.get("slug"))}.html'
        reg = lawyer.get("regNumber")
        palata = lawyer.get("palata")
        meta = " · ".join(x for x in (f"рег. № {esc(reg)}" if reg else "",
                                      esc(palata) if palata else "") if x)
        cards.append(
            f'''        <div class="case-lawyer">
          <a class="case-lawyer-photo" href="{href}" tabindex="-1" aria-hidden="true">
            {lawyer_photo(lawyer, r, CARD_PLACEHOLDER)}
          </a>
          <div class="case-lawyer-body">
            <div class="case-lawyer-role">{esc(role) or "Адвокат коллегии"}</div>
            <h4><a href="{href}">{esc(lawyer.get("name"))}</a></h4>
            <div class="case-lawyer-meta">{meta}</div>
            <a class="case-lawyer-more" href="{href}">Другие дела адвоката →</a>
          </div>
        </div>'''
        )

    return f'''    <div class="case-lawyers">
      <h4 class="case-lawyers-title">Адвокат по делу</h4>
{chr(10).join(cards)}
    </div>'''


def render_lawyer_articles(slug, articles, r):
    """Блок публикаций в личном деле адвоката — обратное направление связки."""
    items = lawyer_articles(slug, articles)
    if not items:
        return ""

    rows = []
    for a in items:
        href = f'{r}articles/{esc(a.get("slug"))}.html'
        role = role_in(a, slug)
        src_count = len(a.get("sources") or [])
        src_html = (f'<span class="lawyer-article-src">{plural_sources(src_count)}</span>'
                    if src_count else "")
        rows.append(
            f'''          <li class="lawyer-article-item">
            <a class="lawyer-article-link" href="{href}">
              <span class="lawyer-article-role">{esc(role)}</span>
              <span class="lawyer-article-title">{esc(a.get("title"))}</span>
              <span class="lawyer-article-meta">{format_date_ru(a.get("date"))}'''
            f'''<span class="lawyer-article-cat">{esc(a.get("category"))}</span>{src_html}</span>
            </a>
          </li>'''
        )

    word = "публикация" if len(items) == 1 else (
        "публикации" if 2 <= len(items) <= 4 else "публикаций")
    return f'''    <div class="lawyer-articles">
      <div class="lawyer-articles-head">
        <span class="section-label">Дела в публикациях</span>
        <h3>Материалы о делах адвоката</h3>
        <p class="lawyer-articles-count">{len(items)} {word} — дела, в которых адвокат принимал участие</p>
      </div>
      <ul class="lawyer-article-list">
{chr(10).join(rows)}
      </ul>
    </div>'''


def source_thumb(preview, r):
    """Миниатюра единого размера. Если её нет — плашка с буквой издания."""
    image = (preview or {}).get("image")
    if image:
        return (f'<img class="source-thumb" src="{r}{esc(image)}" alt="" '
                'width="120" height="90" loading="lazy" decoding="async">')
    letter = esc(((preview or {}).get("outlet") or "?")[:1].upper())
    return f'<span class="source-thumb source-thumb--blank">{letter}</span>'


def render_sources(a, previews, r):
    """
    Список источников: заголовок и миниатюра подтягиваются с чужого сайта.
    Габариты миниатюр одинаковые — в колонке разнобой по высоте ломал бы строй.
    """
    sources = a.get("sources") or []
    if not sources:
        return ""

    items = []
    for s in sources:
        url = s.get("url") or ""
        preview = previews.get(url) or {}
        title = s.get("title") or preview.get("title")
        outlet = s.get("outlet") or preview.get("siteName") or preview.get("host") or ""
        # Часть изданий закрыта для сборщика превью (403, геоблок), и заголовка
        # взять неоткуда. Подставлять URL вместо названия смысла нет — издание
        # уже подписано строкой выше; строку заголовка просто не рисуем.
        title_html = f'<span class="source-title">{esc(title)}</span>' if title else ""
        items.append(
            f'''        <li class="source-item">
          <a class="source-link" href="{esc(url)}" target="_blank" rel="noopener noreferrer">
            {source_thumb({**preview, "outlet": outlet}, r)}
            <span class="source-body">
              <span class="source-outlet">{esc(outlet)}</span>
              {title_html}
            </span>
            <svg class="source-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>
        </li>'''
        )

    return f'''    <div class="article-sources">
      <h4>Источники</h4>
      <ul class="source-list">
{chr(10).join(items)}
      </ul>
    </div>'''


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
# Фото на персональной странице
# ----------------------------------------------------------------------
#
# Кружок с фото был вписан в каждую страницу руками, тремя разными
# способами, и у троих адвокатов фотографии не было вовсе — стояла
# заглушка, хотя снимок лежал в data/lawyers.json. Теперь блок
# проставляет сборка из данных, одинаково для всех.

PROFILE_PHOTO_WRAPPED = re.compile(
    r'<div style="flex-shrink:0">\s*<div style="width:120px;height:120px;.*?</div>\s*</div>',
    re.S,
)
PROFILE_PHOTO_BARE = re.compile(
    r'<div style="width:120px;height:120px;.*?</div>', re.S
)

PROFILE_PLACEHOLDER = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 '
    '21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
)


def render_profile_photo(lawyer, r):
    photo = lawyer.get("photo")
    if photo:
        src = photo if photo.startswith(("http://", "https://", "/")) else f"{r}{photo}"
        inner = (
            f'<img src="{esc(src)}" alt="{esc(lawyer.get("name"))}" '
            'width="120" height="120" loading="eager">'
        )
    else:
        inner = PROFILE_PLACEHOLDER
    cutout = " profile-photo--cutout" if lawyer.get("photoCutout") else ""
    return f'<div class="profile-photo{cutout}">{inner}</div>'


def set_profile_photo(page, lawyer, r):
    start, end = "<!-- AE:PROFILE_PHOTO:START -->", "<!-- AE:PROFILE_PHOTO:END -->"
    block = f"{start}\n      {render_profile_photo(lawyer, r)}\n      {end}"

    marked = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if marked.search(page):
        return marked.sub(lambda _m: block, page, count=1)

    for pattern in (PROFILE_PHOTO_WRAPPED, PROFILE_PHOTO_BARE):
        if pattern.search(page):
            return pattern.sub(lambda _m: block, page, count=1)
    return page



# ----------------------------------------------------------------------
# Версии статики
# ----------------------------------------------------------------------
#
# У css/style.css и js/*.js нет версии в имени, а GitHub Pages отдаёт их с
# cache-control: max-age=600. После публикации посетитель ещё какое-то время
# видит старые стили, а открытая вкладка — заметно дольше. Поэтому к ссылкам
# добавляется ?v=<хеш содержимого>.
#
# Именно хеш, а не метка времени: версия меняется только когда файл реально
# изменился, поэтому сборка остаётся идемпотентной и не переписывает все
# страницы при каждом запуске.

VERSIONED_ASSETS = ("css/style.css", "fonts/fonts.css",
                    "js/script.js", "js/components.js", "js/articles.js")


def asset_hash(rel_path):
    """Короткий хеш содержимого файла; пусто, если файла нет."""
    path = ROOT / rel_path
    if not path.exists():
        return ""
    return hashlib.md5(path.read_bytes()).hexdigest()[:10]


def stamp_assets(page, versions):
    """Проставляет ?v=<хеш> ссылкам на стили и скрипты, заменяя прежний."""
    for rel, ver in versions.items():
        if not ver:
            continue
        name = re.escape(rel)
        page = re.sub(
            r'((?:href|src)=")((?:\.\./)*)' + name + r'(?:\?v=[^"]*)?(")',
            lambda m: f'{m.group(1)}{m.group(2)}{rel}?v={ver}{m.group(3)}',
            page,
        )
    return page


# ----------------------------------------------------------------------
# Сборка страниц
# ----------------------------------------------------------------------

def iter_pages():
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT)
        if set(rel.parts) & EXCLUDE_DIRS:
            continue
        # Любой служебный каталог, а не только перечисленные. Списком было
        # не поймать .claude/worktrees: сборка заходила в рабочую копию репозитория
        # внутри него, перебирала второй экземпляр сайта и дописывала его
        # страницы в sitemap.xml — 64 URL вместо 32, половина из них
        # несуществующие. Для поисковой выдачи это прямой вред.
        if any(part.startswith(".") for part in rel.parts[:-1]):
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


def set_article_person_schema(page, a, by_slug):
    """
    Добавляет адвоката в разметку статьи как mentions, а не author.

    Author оставлен за коллегией сознательно: текст написан ей, а адвокат
    участвовал в описанном деле. Указать его автором было бы недостоверным
    утверждением в структурных данных — поисковики такое наказывают, а не
    вознаграждают. Mentions описывает связь честно и так же машиночитаемо.
    """
    pairs = article_lawyers(a, by_slug)
    if not pairs:
        return page

    persons = []
    for lawyer, _role in pairs:
        fields = [
            '"@type": "Person"',
            f'"name": {json.dumps(lawyer.get("name"), ensure_ascii=False)}',
            f'"url": "{SITE}/team/{lawyer.get("slug")}.html"',
        ]
        if lawyer.get("position"):
            fields.append(f'"jobTitle": {json.dumps(lawyer["position"], ensure_ascii=False)}')
        if lawyer.get("regNumber"):
            fields.append(f'"identifier": {json.dumps(lawyer["regNumber"], ensure_ascii=False)}')
        fields.append(f'"affiliation": {{"@id": "{SITE}/#organization"}}')
        persons.append("{" + ", ".join(fields) + "}")

    block = ",\n        " + f'"mentions": [{", ".join(persons)}]'
    # Шаблон захватывает и уже вставленный блок — пересборка не плодит копии.
    pattern = re.compile(r'(?:,\s*"mentions": \[.*?\])?,\s*"inLanguage": "ru"', re.S)
    return pattern.sub(lambda _m: block + ',\n        "inLanguage": "ru"', page, count=1)


def set_person_subject_of(page, slug, articles):
    """Обратная сторона связки в разметке: какие материалы относятся к адвокату."""
    items = lawyer_articles(slug, articles)
    if not items:
        return page
    refs = ", ".join(
        '{"@type": "Article", "headline": %s, "url": "%s/articles/%s.html"}'
        % (json.dumps(a.get("title"), ensure_ascii=False), SITE, a.get("slug"))
        for a in items
    )
    block = ',\n      ' + f'"subjectOf": [{refs}]'
    pattern = re.compile(r'(?:,\s*"subjectOf": \[.*?\])?,\s*"worksFor"', re.S)
    if not pattern.search(page):
        return page
    return pattern.sub(lambda _m: block + ',\n      "worksFor"', page, count=1)


def build_pages(settings, lawyers, articles, year, versions, previews):
    phone = settings.get("phone", "+7 (916) 928-65-05")
    by_slug = {l.get("slug"): l for l in lawyers}
    by_article_slug = {a.get("slug"): a for a in articles}
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

        # Личное дело адвоката: фото, блок публикаций и обратная связка в схеме
        if rel.parts[0] == "team" and len(rel.parts) > 1:
            slug = rel.name[:-5]
            lawyer = by_slug.get(slug)
            if lawyer:
                page = set_profile_photo(page, lawyer, r)
                page = insert_block(
                    page, "LAWYER_ARTICLES",
                    render_lawyer_articles(slug, articles, r),
                    r'<div style="margin-top:48px;padding-top:32px',
                )
                page = set_person_subject_of(page, slug, articles)

        # Страница статьи: источники с превью и подпись «Адвокат по делу»
        if rel.parts[0] == "articles" and len(rel.parts) > 1:
            article = by_article_slug.get(rel.name[:-5])
            if article:
                page = replace_block(
                    page, "SOURCES", render_sources(article, previews, r),
                    r'<div class="article-sources">.*?</div>',
                )
                # Якорь берём после сборки источников: иначе блок адвоката
                # попал бы внутрь маркеров SOURCES и стёрся бы при пересборке.
                anchor = (r'<!-- AE:SOURCES:START -->'
                          if "<!-- AE:SOURCES:START -->" in page
                          else r'<div style="margin-top:48px;padding-top:32px')
                page = insert_block(
                    page, "ARTICLE_LAWYERS",
                    render_article_lawyers(article, by_slug, r), anchor,
                )
                page = set_article_person_schema(page, article, by_slug)

        # Пререндер сеток
        if rel.name == "index.html" and depth == 0:
            page = prerender_grid(
                page, "TEAM_GRID", "teamGrid",
                "\n".join(lawyer_card(l, r) for l in lawyers),
            )
            page = prerender_grid(
                page, "ARTICLES_GRID", "articlesGrid",
                "\n".join(article_card(a, r, by_slug) for a in articles[:3]),
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
                "\n".join(article_card(a, r, by_slug) for a in articles),
            )

        # ?v=<хеш> у стилей и скриптов — чтобы браузер не держал старую версию
        page = stamp_assets(page, versions)

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

def data_version():
    """Хеш данных: версия меняется только когда данные действительно менялись."""
    h = hashlib.md5()
    for rel in ("data/settings.json", "data/lawyers.json", "data/articles.json"):
        h.update((ROOT / rel).read_bytes())
    return h.hexdigest()[:10]


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
    previews = load_previews()
    year = datetime.now().year
    stamp = data_version()

    # Версию данных пишем ДО подсчёта хешей: она меняет js/script.js,
    # а значит и его собственную версию.
    stamped = stamp_data_version(stamp)
    versions = {rel: asset_hash(rel) for rel in VERSIONED_ASSETS}

    pages = build_pages(settings, lawyers, articles, year, versions, previews)
    urls = build_sitemap()

    print(f"Страниц обновлено:      {pages}")
    print(f"URL в sitemap.xml:      {urls}")
    print(f"Статей в data:          {len(articles)}")
    print(f"Адвокатов в data:       {len(lawyers)}")
    print(f"Версия данных:          {stamp} {'(записана)' if stamped else '(без изменений)'}")
    print("Версии статики:")
    for rel, ver in versions.items():
        print(f"  {rel:<22} {ver or '— файла нет'}")


if __name__ == "__main__":
    main()
