/* ===== ARTICLES PAGE ===== */
const PER_PAGE = 6;

function getReads(slug) {
  return parseInt(localStorage.getItem('ae_reads_' + (slug || '')) || '0');
}

function pluralSources(n) {
  if (n === 1) return '1 источник';
  if (n >= 2 && n <= 4) return n + ' источника';
  return n + ' источников';
}

function articleCardHTML(a) {
  const mins = readingTime(a.content || a.summary || '');
  const reads = getReads(a.slug);
  const srcCount = (a.sources || []).length;
  const href = a.slug ? 'articles/' + a.slug + '.html' : '#';
  const onclick = a.slug ? '' : `openArticleModal(${a.id});return false;`;
  return `
  <div class="article-card">
    <div class="article-card-meta-row">
      <div class="article-category">${a.category || ''}</div>
      ${reads > 0 ? `<span class="article-reads-badge">${reads} прочт.</span>` : ''}
    </div>
    <h3>${a.title}</h3>
    <div class="article-date">
      ${formatDate(a.date)}
      <span class="article-reading-time">${mins} мин</span>
      ${srcCount > 0 ? `<span class="article-src-count">${pluralSources(srcCount)}</span>` : ''}
    </div>
    <div class="article-excerpt">${a.summary}</div>
    <a href="${href}" class="read-more" onclick="${onclick}">Читать далее →</a>
  </div>`;
}

let allArticlesData = [];
let _modalLastFocus = null;
let currentCat  = 'all';
let currentPage = 1;
let currentSort = 'date';

function _getFocusable(root) {
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);
}

function openArticleModal(id) {
  const a = allArticlesData.find(x => x.id === id);
  if (!a) return;
  _modalLastFocus = document.activeElement;
  document.getElementById('articleModalTitle').textContent = a.title;
  document.getElementById('articleModalMeta').innerHTML = `
    <span class="article-date" style="margin:0">${formatDate(a.date)}</span>
    ${a.category ? `<span class="cat-badge" style="background:rgba(10,31,68,0.08);color:var(--navy)">${a.category}</span>` : ''}
  `;
  const body = (a.content || a.summary).split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('');
  document.getElementById('articleModalBody').innerHTML = body;
  const modal = document.getElementById('articleModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const closeBtn = document.getElementById('articleModalClose');
    if (closeBtn) closeBtn.focus();
  });
}

function closeArticleModal() {
  const modal = document.getElementById('articleModal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  if (_modalLastFocus) { _modalLastFocus.focus(); _modalLastFocus = null; }
}

function sortArticles(arr) {
  const copy = [...arr];
  if (currentSort === 'sources') {
    return copy.sort((a, b) => (b.sources || []).length - (a.sources || []).length);
  }
  if (currentSort === 'reads') {
    return copy.sort((a, b) => getReads(b.slug) - getReads(a.slug));
  }
  // default: date desc
  return copy.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getFiltered() {
  const base = currentCat === 'all'
    ? allArticlesData
    : allArticlesData.filter(a => a.category === currentCat);
  return sortArticles(base);
}

function initCardScrollAnimation() {
  const cards = document.querySelectorAll('#allArticlesGrid .article-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.filter = 'drop-shadow(0 0 0 rgba(201,160,61,0))';
        entry.target.style.transform = 'scale(1)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  cards.forEach(card => observer.observe(card));

  const shifts = [-8, -4, 0, 4, 8];
  cards.forEach(card => {
    card.style.transform = `translateY(${shifts[Math.floor(Math.random() * shifts.length)]}px)`;
  });
}

function renderGrid(articles) {
  const grid = document.getElementById('allArticlesGrid');
  if (!articles.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-light)">Статьи не найдены</p>`;
    return;
  }
  const start = (currentPage - 1) * PER_PAGE;
  grid.innerHTML = articles.slice(start, start + PER_PAGE).map(articleCardHTML).join('');
  requestAnimationFrame(() => requestAnimationFrame(initCardScrollAnimation));
}

function renderPagination(total) {
  const pages = Math.ceil(total / PER_PAGE);
  const pag = document.getElementById('pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>›</button>`;
  pag.innerHTML = html;
}

function goPage(n) {
  const total = getFiltered().length;
  const pages = Math.ceil(total / PER_PAGE);
  if (n < 1 || n > pages) return;
  currentPage = n;
  const filtered = getFiltered();
  renderGrid(filtered);
  renderPagination(filtered.length);
  window.scrollTo({ top: document.getElementById('articlesPage').offsetTop - 80, behavior: 'smooth' });
}

function applyFilter(cat) {
  currentCat = cat;
  currentPage = 1;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  const filtered = getFiltered();
  renderGrid(filtered);
  renderPagination(filtered.length);
}

function applySort(sort) {
  currentSort = sort;
  currentPage = 1;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
  const filtered = getFiltered();
  renderGrid(filtered);
  renderPagination(filtered.length);
}

document.addEventListener('DOMContentLoaded', async () => {
  allArticlesData = await loadData(DATA_KEYS.articles, 'data/articles.json');
  applyFilter('all');

  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.cat));
  });

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => applySort(btn.dataset.sort));
  });

  document.getElementById('articleModalClose').addEventListener('click', closeArticleModal);
  document.getElementById('articleModal').addEventListener('click', e => {
    if (e.target === document.getElementById('articleModal')) closeArticleModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeArticleModal(); return; }
    const modal = document.getElementById('articleModal');
    if (e.key === 'Tab' && modal.classList.contains('open')) {
      const focusable = _getFocusable(modal);
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });
});
