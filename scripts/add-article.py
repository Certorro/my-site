#!/usr/bin/env python3
"""
add-article.py — extensible article generator for al-e.net

Usage:
  python3 scripts/add-article.py

Edit ARTICLES list at the bottom with your new article data,
then run. The script adds HTML pages to articles/ and updates
data/articles.json automatically.

Fields per article:
  id          — next integer after max existing id
  slug        — URL slug, e.g. "ugolovnoe-delo-2025"
  title       — full article title (for <h1> and meta)
  category    — rubric label, e.g. "Уголовное право"
  date        — ISO date "YYYY-MM-DD"
  dateRu      — human-readable Russian date, e.g. "15 июня 2025 г."
  summary     — 1-2 sentence lead, shown in listings and meta description
  content     — full text, paragraphs separated by blank lines
  photo       — local image path (leave "" if none)
  externalImage — absolute URL to a remote image (leave "" if none)
  sources     — list of {"url":..., "outlet":..., "title":...}
"""

import json
from pathlib import Path

BASE = Path(__file__).parent.parent
ART_DIR = BASE / "articles"
DATA_FILE = BASE / "data" / "articles.json"


def nl2p(text):
    paras = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
    return '\n'.join(f'      <p>{p}</p>' for p in paras)


def sources_html(sources):
    items = ''.join(
        f'<li><a href="{s["url"]}" target="_blank" rel="noopener noreferrer">'
        f'{s["outlet"]}</a> — {s["title"]}</li>\n'
        for s in sources
    )
    return (
        '    <div class="article-sources">\n'
        '      <h4>Источники</h4>\n'
        '      <ul>\n'
        f'{items}'
        '      </ul>\n'
        '    </div>'
    )


def image_html(url, alt=""):
    if not url:
        return ""
    return (
        '    <div class="article-hero-img" style="margin:0 0 32px;text-align:center">\n'
        f'      <img src="{url}" alt="{alt}" '
        'style="max-width:100%;max-height:420px;object-fit:cover;display:block;margin:0 auto" '
        'loading="lazy" referrerpolicy="no-referrer">\n'
        '    </div>'
    )


def build_html(a):
    pub_date = a['date'] + 'T00:00:00+03:00'
    img_block = image_html(a.get('externalImage', ''), a['title'])
    body_block = nl2p(a['content'])
    src_block = sources_html(a['sources'])
    mins = max(1, round(len(a['content'].split()) / 200))

    return f'''<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{a['title']} | Адвокатская коллегия «Альтер-Эго»</title>
  <meta name="description" content="{a['summary'][:160]}">
  <link rel="canonical" href="https://al-e.net/articles/{a['slug']}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://al-e.net/articles/{a['slug']}.html">
  <meta property="og:title" content="{a['title']}">
  <meta property="og:description" content="{a['summary'][:200]}">
  <meta property="og:site_name" content="Адвокатская коллегия Альтер-Эго">
  <meta property="og:locale" content="ru_RU">
  <meta property="article:published_time" content="{pub_date}">
  <meta property="article:section" content="{a['category']}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{a['title']}">
  <meta name="twitter:description" content="{a['summary'][:200]}">
  <link rel="stylesheet" href="../fonts/fonts.css">
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "Article",
        "headline": "{a['title']}",
        "description": "{a['summary'][:200]}",
        "datePublished": "{pub_date}",
        "dateModified": "{pub_date}",
        "author": {{"@id": "https://al-e.net/#organization"}},
        "publisher": {{"@id": "https://al-e.net/#organization"}},
        "mainEntityOfPage": "https://al-e.net/articles/{a['slug']}.html",
        "articleSection": "{a['category']}",
        "inLanguage": "ru"
      }},
      {{
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{"@type": "ListItem", "position": 1, "name": "Главная", "item": "https://al-e.net/"}},
          {{"@type": "ListItem", "position": 2, "name": "Публикации", "item": "https://al-e.net/articles.html"}},
          {{"@type": "ListItem", "position": 3, "name": "{a['title']}", "item": "https://al-e.net/articles/{a['slug']}.html"}}
        ]
      }}
    ]
  }}
  </script>
</head>
<body>
<a href="#main-content" class="skip-link">Перейти к содержимому</a>

<div id="header-placeholder"></div>
<script src="../js/components.js"></script>
<main id="main-content">

<!-- BREADCRUMBS -->
<div class="breadcrumbs-bar">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Путь">
      <a href="../index.html">Главная</a>
      <span class="bc-sep">›</span>
      <a href="../articles.html">Публикации</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">{a['category']}</span>
    </nav>
  </div>
</div>

<!-- ARTICLE HERO -->
<section class="page-hero">
  <div class="hero-base" style="opacity:.8"></div>
  <div class="grid-bg"></div>
  <div class="grid-shimmer"></div>
  <div class="container page-hero-content">
    <span class="hero-badge" style="position:relative;z-index:2;margin-bottom:16px">{a['category']}</span>
    <h1 style="max-width:840px">{a['title']}</h1>
    <p style="position:relative;z-index:2">{a['dateRu']} · {mins} мин чтения · <span style="opacity:.7">Перепубликация с указанием источника</span></p>
  </div>
</section>

<!-- ARTICLE BODY -->
<article class="section section-alt" style="position:relative;overflow:hidden">
  <div class="grid-bg grid-bg-light" style="opacity:.35"></div>
  <div class="container" style="position:relative;z-index:1;max-width:800px">
    <div class="article-full-body">
      <p class="article-lead"><em>{a['summary']}</em></p>
{img_block}
{body_block}
    </div>

{src_block}

    <div style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <a href="../articles.html" class="btn btn-navy" style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Все публикации
      </a>
      <a href="../contact.html" class="btn btn-gold">Задать вопрос адвокату</a>
    </div>
  </div>
</article>

<!-- CTA BAND -->
<section class="cta-band" style="position:relative;overflow:hidden">
  <div class="grid-bg" style="opacity:.4"></div>
  <div class="container" style="position:relative;z-index:1">
    <h2>Нужна юридическая помощь?</h2>
    <p>Запишитесь на консультацию — адвокат разберёт вашу ситуацию и предложит варианты действий.</p>
    <div>
      <a href="../contact.html" class="btn btn-gold">Записаться на консультацию</a>
      <a href="tel:+79169286505" class="btn btn-outline" style="margin-left:12px">Позвонить</a>
    </div>
  </div>
</section>

</main>
<div id="footer-placeholder"></div>

<script src="../js/script.js"></script>
<script>AE.injectFooter(); AE.initMetrika();</script>
</body>
</html>'''


def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        existing = json.load(f)

    existing_slugs = {a['slug'] for a in existing}
    next_id = max(a['id'] for a in existing) + 1

    new_articles = [a for a in ARTICLES if a['slug'] not in existing_slugs]
    if not new_articles:
        print("No new articles to add — all slugs already exist in articles.json")
        return

    for i, a in enumerate(new_articles):
        if 'id' not in a:
            a['id'] = next_id + i
        html = build_html(a)
        path = ART_DIR / f"{a['slug']}.html"
        path.write_text(html, encoding='utf-8')
        print(f"  ✓ articles/{path.name}")

        entry = {
            "id": a['id'],
            "title": a['title'],
            "category": a['category'],
            "date": a['date'],
            "summary": a['summary'],
            "content": a['content'],
            "photo": a.get('photo', ''),
            "externalImage": a.get('externalImage', ''),
            "sourceUrl": a['sources'][0]['url'] if a['sources'] else '',
            "sources": a['sources'],
            "slug": a['slug'],
        }
        existing.append(entry)

    existing.sort(key=lambda x: x['date'], reverse=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\nDone: {len(new_articles)} added, articles.json now has {len(existing)} entries")


# ── ADD NEW ARTICLES HERE ────────────────────────────────────────────────────
# Copy the template below, fill in fields, add to this list, then run:
#   python3 scripts/add-article.py

ARTICLES = [
    # {
    #     "slug": "primer-stati-2025",
    #     "title": "Заголовок статьи",
    #     "category": "Уголовное право",
    #     "date": "2025-06-15",
    #     "dateRu": "15 июня 2025 г.",
    #     "summary": "Краткое описание в 1-2 предложения.",
    #     "content": """Первый абзац.
    #
    # Второй абзац (пустая строка между параграфами).""",
    #     "photo": "",
    #     "externalImage": "",
    #     "sources": [
    #         {"url": "https://example.com/article", "outlet": "Коммерсантъ", "title": "Заголовок источника"},
    #     ],
    # },
]

if __name__ == '__main__':
    main()
