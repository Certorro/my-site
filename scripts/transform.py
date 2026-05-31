#!/usr/bin/env python3
"""
transform.py — Extract shared header/footer/metrika into js/components.js
Run once: python3 scripts/transform.py
"""

import re
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS  = {'.git', 'context', 'admin', 'scripts', 'node_modules', '.claude'}
SKIP_FILES = {'home.html', 'yandex_26758dad9d3b9dfb.html'}


def collect_html(root):
    out = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith('.html') and f not in SKIP_FILES:
                out.append(os.path.join(dirpath, f))
    return sorted(out)


def depth(filepath, root):
    rel = os.path.relpath(filepath, root)
    return len(rel.split(os.sep)) - 1


def transform(content, R):
    # ── 1. Strip header comment lines ────────────────────────────────
    content = re.sub(r'<!-- =*\s*(?:PAGE\s+LOADER.*?)?HEADER.*? -->\s*\n', '', content)
    content = re.sub(r'<!-- =*\s*FOOTER\s*=* -->\s*\n', '', content)

    # ── 2. Replace <header id="header">...</header> ──────────────────
    placeholder = (
        '<div id="header-placeholder"></div>\n'
        '<script src="' + R + 'js/components.js"></script>'
    )
    content = re.sub(
        r'<header id="header">.*?</header>',
        placeholder,
        content,
        flags=re.DOTALL
    )

    # ── 3. Replace <footer>...</footer> ──────────────────────────────
    content = re.sub(
        r'<footer>.*?</footer>',
        '<div id="footer-placeholder"></div>',
        content,
        flags=re.DOTALL
    )

    # ── 4. Remove Yandex.Metrika block ────────────────────────────────
    content = re.sub(
        r'\s*<!-- Yandex\.Metrika counter -->.*?<!-- /Yandex\.Metrika counter -->',
        '',
        content,
        flags=re.DOTALL
    )

    # ── 5. Remove standalone footerYear-only <script> blocks ─────────
    content = re.sub(
        r'\n<script>[^\n<]*(?:footerYear|footer_year)[^\n<]*</script>',
        '',
        content
    )

    # ── 6. Remove footerYear line from combined scripts (index.html) ──
    content = re.sub(
        r"document\.getElementById\('footerYear'\)\.textContent\s*=\s*new Date\(\)\.getFullYear\(\);\s*\n\s*\n",
        '\n',
        content
    )

    # ── 7. Inject AE calls before </body> (if not already present) ────
    if 'AE.injectFooter' not in content and '</body>' in content:
        ae_call = '<script>AE.injectFooter(); AE.initMetrika();</script>\n'
        content = content.replace('</body>', ae_call + '</body>', 1)

    return content


def main():
    files = collect_html(ROOT)
    print(f'Found {len(files)} HTML files to transform.\n')

    for filepath in files:
        rel = os.path.relpath(filepath, ROOT)
        d = depth(filepath, ROOT)
        R = '../' * d

        with open(filepath, 'r', encoding='utf-8') as fh:
            original = fh.read()

        # Skip files that don't have a header to extract
        if '<header id="header">' not in original:
            print(f'  SKIP (no header): {rel}')
            continue

        result = transform(original, R)

        with open(filepath, 'w', encoding='utf-8') as fh:
            fh.write(result)

        print(f'  OK: {rel}')

    print('\nDone.')


if __name__ == '__main__':
    main()
