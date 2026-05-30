/* ===== CONSTANTS ===== */
const ADMIN_PASSWORD = 'admin123';
const DATA_KEYS = {
  lawyers: 'certorro_lawyers',
  articles: 'certorro_articles',
  settings: 'certorro_settings',
};
const JSON_PATHS = {
  lawyers: '../data/lawyers.json',
  articles: '../data/articles.json',
  settings: '../data/settings.json',
};

/* ===== STATE ===== */
let lawyers = [];
let articles = [];
let settings = {};

/* ===== HELPERS ===== */
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function formatDate(dateStr) {
  try { return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return dateStr; }
}

function generateId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

function saveToStorage(key, data) {
  localStorage.setItem(DATA_KEYS[key], JSON.stringify(data));
}

async function loadFromStorage(key) {
  const cached = localStorage.getItem(DATA_KEYS[key]);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }
  try {
    const res = await fetch(JSON_PATHS[key]);
    const data = await res.json();
    localStorage.setItem(DATA_KEYS[key], JSON.stringify(data));
    return data;
  } catch(e) {
    return key === 'settings' ? {} : [];
  }
}

/* ===== TRANSLITERATE (ru→lat for slug generation) ===== */
function transliterate(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return str.toLowerCase().split('')
    .map(c => map[c] !== undefined ? map[c] : (/[a-z0-9]/.test(c) ? c : ' '))
    .join('').trim().replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 60);
}

/* ===== DOWNLOAD HTML FILE ===== */
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ===== AUTH ===== */
function checkAuth() {
  return sessionStorage.getItem('certorro_admin') === '1';
}

document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const pw = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('certorro_admin', '1');
    showPanel();
  } else {
    errEl.style.display = 'block';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
});

function doLogout() {
  sessionStorage.removeItem('certorro_admin');
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('logoutBtnMobile').addEventListener('click', doLogout);

function showPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
  initAdmin();
}

/* ===== INIT ===== */
async function initAdmin() {
  lawyers = await loadFromStorage('lawyers');
  articles = await loadFromStorage('articles');
  settings = await loadFromStorage('settings');
  renderLawyersTable();
  renderArticlesTable();
  fillSettingsForm();
  initTabs();
  updateFab('lawyers');
}

/* ===== TABS ===== */
const TAB_TITLES = { lawyers: 'Управление адвокатами', articles: 'Управление статьями', settings: 'Общие настройки' };

function initTabs() {
  document.querySelectorAll('.admin-nav-item:not(.admin-nav-mobile-only)').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tabId));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tabId));
  document.getElementById('tabTitle').textContent = TAB_TITLES[tabId] || tabId;
  updateFab(tabId);
}

function updateFab(tabId) {
  const fab = document.getElementById('adminFab');
  if (!fab) return;
  if (tabId === 'settings') {
    fab.classList.add('fab-hidden');
  } else {
    fab.classList.remove('fab-hidden');
  }
}

function handleFabClick() {
  const activeSection = document.querySelector('.admin-section.active');
  if (!activeSection) return;
  if (activeSection.id === 'tab-lawyers') openLawyerModal();
  else if (activeSection.id === 'tab-articles') openArticleModal();
}

/* ===== LAWYERS TABLE ===== */
function renderLawyersTable() {
  const tbody = document.getElementById('lawyersTableBody');
  if (!lawyers.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><p>Адвокаты не добавлены</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = lawyers.map(l => `
    <tr>
      <td data-mobile="avatar">
        <div class="admin-avatar">
          ${l.photo ? `<img src="${l.photo}" alt="">` : '👤'}
        </div>
      </td>
      <td data-mobile="main">
        <strong>${l.name}</strong>
        ${l.position ? `<br><span style="font-size:0.78rem;color:var(--text-light)">${l.position}</span>` : ''}
      </td>
      <td data-mobile="sub"><span class="tag tag-blue">${l.specialization || '—'}</span></td>
      <td data-mobile="hide" style="font-size:0.85rem;color:var(--text-light)">${l.experience || '—'}</td>
      <td data-mobile="hide" style="font-size:0.78rem;color:var(--text-light)">${l.regNumber || '—'}</td>
      <td data-mobile="actions">
        <button class="btn-sm btn-edit" onclick="openLawyerModal(${l.id})">✏️ Изменить</button>
        <button class="btn-sm btn-delete" onclick="confirmDelete('lawyer', ${l.id})" style="margin-top:4px">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ===== LAWYER MODAL ===== */
function openLawyerModal(id = null) {
  const modal = document.getElementById('lawyerModal');
  const title = document.getElementById('lawyerModalTitle');
  const preview = document.getElementById('lawyer-photo-preview');
  preview.innerHTML = '';

  if (id) {
    const l = lawyers.find(x => x.id === id);
    if (!l) return;
    title.textContent = 'Редактировать адвоката';
    document.getElementById('lawyer-id').value = l.id;
    document.getElementById('lawyer-name').value = l.name || '';
    document.getElementById('lawyer-position').value = l.position || '';
    document.getElementById('lawyer-regNumber').value = l.regNumber || '';
    document.getElementById('lawyer-specialization').value = l.specialization || '';
    document.getElementById('lawyer-experience').value = l.experience || '';
    document.getElementById('lawyer-bio').value = l.bio || '';
    document.getElementById('lawyer-photo').value = l.photo || '';
    document.getElementById('lawyer-palata').value = l.palata || '';
    if (l.photo) preview.innerHTML = `<img src="${l.photo}" style="max-width:120px;max-height:120px;border-radius:4px;object-fit:cover">`;
  } else {
    title.textContent = 'Добавить адвоката';
    document.getElementById('lawyer-id').value = '';
    document.getElementById('lawyer-name').value = '';
    document.getElementById('lawyer-position').value = 'Адвокат';
    document.getElementById('lawyer-regNumber').value = '';
    document.getElementById('lawyer-specialization').value = '';
    document.getElementById('lawyer-experience').value = '';
    document.getElementById('lawyer-bio').value = '';
    document.getElementById('lawyer-photo').value = '';
    document.getElementById('lawyer-palata').value = '';
  }
  modal.classList.add('open');
}

function closeLawyerModal() { document.getElementById('lawyerModal').classList.remove('open'); }

function handleLawyerPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('lawyer-photo').value = e.target.result;
    document.getElementById('lawyer-photo-preview').innerHTML =
      `<img src="${e.target.result}" style="max-width:120px;max-height:120px;border-radius:4px;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}

function saveLawyer() {
  const name = document.getElementById('lawyer-name').value.trim();
  const spec = document.getElementById('lawyer-specialization').value.trim();
  if (!name || !spec) { toast('Заполните обязательные поля (ФИО, специализация)', 'error'); return; }

  const id = document.getElementById('lawyer-id').value;
  const data = {
    id: id ? parseInt(id) : generateId(lawyers),
    name,
    position: document.getElementById('lawyer-position').value.trim(),
    regNumber: document.getElementById('lawyer-regNumber').value.trim(),
    specialization: spec,
    experience: document.getElementById('lawyer-experience').value.trim(),
    bio: document.getElementById('lawyer-bio').value.trim(),
    photo: document.getElementById('lawyer-photo').value.trim(),
    palata: document.getElementById('lawyer-palata').value.trim(),
    slug: id
      ? (lawyers.find(x => x.id === parseInt(id))?.slug || transliterate(name))
      : transliterate(name),
  };

  if (id) {
    const idx = lawyers.findIndex(x => x.id === parseInt(id));
    if (idx !== -1) lawyers[idx] = data;
  } else {
    lawyers.push(data);
  }

  saveToStorage('lawyers', lawyers);
  const lawyerHtml = generateLawyerHTML(data);
  downloadFile(data.slug + '.html', lawyerHtml);
  renderLawyersTable();
  closeLawyerModal();
  toast(id
    ? 'Данные адвоката обновлены. HTML-страница скачана → поместите в папку team/ и выполните git push'
    : 'Адвокат добавлен. HTML-страница скачана → поместите в папку team/ и выполните git push');
}

/* ===== ARTICLES TABLE ===== */
function renderArticlesTable() {
  const tbody = document.getElementById('articlesTableBody');
  if (!articles.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📝</div><p>Статьи не добавлены</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = articles.map(a => `
    <tr>
      <td data-mobile="main">
        <strong style="display:block;max-width:260px">${a.title}</strong>
      </td>
      <td data-mobile="sub" style="white-space:nowrap">
        ${a.category ? `<span class="tag tag-blue" style="font-size:0.7rem">${a.category}</span>` : '<span style="color:var(--text-light);font-size:0.78rem">—</span>'}
      </td>
      <td data-mobile="sub" style="white-space:nowrap;font-size:0.82rem;color:var(--text-light)">${formatDate(a.date)}</td>
      <td data-mobile="hide" style="font-size:0.82rem;color:var(--text-light);max-width:200px">
        ${(a.summary || '').substring(0, 80)}${(a.summary || '').length > 80 ? '…' : ''}
      </td>
      <td data-mobile="actions">
        <button class="btn-sm btn-edit" onclick="openArticleModal(${a.id})">✏️ Изменить</button>
        <button class="btn-sm btn-delete" onclick="confirmDelete('article', ${a.id})" style="margin-top:4px">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ===== ARTICLE MODAL ===== */
function openArticleModal(id = null) {
  const modal = document.getElementById('articleModal');
  const title = document.getElementById('articleModalTitle');

  if (id) {
    const a = articles.find(x => x.id === id);
    if (!a) return;
    title.textContent = 'Редактировать статью';
    document.getElementById('article-id').value = a.id;
    document.getElementById('article-title').value = a.title || '';
    document.getElementById('article-category').value = a.category || '';
    document.getElementById('article-date').value = a.date || '';
    document.getElementById('article-photo').value = a.photo || '';
    document.getElementById('article-summary').value = a.summary || '';
    document.getElementById('article-content').value = a.content || '';
  } else {
    title.textContent = 'Добавить статью';
    document.getElementById('article-id').value = '';
    document.getElementById('article-title').value = '';
    document.getElementById('article-category').value = '';
    document.getElementById('article-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('article-photo').value = '';
    document.getElementById('article-summary').value = '';
    document.getElementById('article-content').value = '';
  }
  modal.classList.add('open');
}

function closeArticleModal() { document.getElementById('articleModal').classList.remove('open'); }

function saveArticle() {
  const title = document.getElementById('article-title').value.trim();
  const summary = document.getElementById('article-summary').value.trim();
  if (!title || !summary) { toast('Заполните заголовок и краткое описание', 'error'); return; }

  const id = document.getElementById('article-id').value;
  const slug = (id && articles.find(x => x.id === parseInt(id))?.slug) || transliterate(title);
  const data = {
    id: id ? parseInt(id) : generateId(articles),
    title,
    category: document.getElementById('article-category').value.trim(),
    date: document.getElementById('article-date').value || new Date().toISOString().split('T')[0],
    photo: document.getElementById('article-photo').value.trim(),
    summary,
    content: document.getElementById('article-content').value.trim(),
    slug,
  };

  if (id) {
    const idx = articles.findIndex(x => x.id === parseInt(id));
    if (idx !== -1) articles[idx] = data;
  } else {
    articles.unshift(data);
  }

  saveToStorage('articles', articles);
  const articleHtml = generateArticleHTML(data);
  downloadFile(data.slug + '.html', articleHtml);
  renderArticlesTable();
  closeArticleModal();
  toast(id
    ? 'Статья обновлена. HTML-страница скачана → поместите в папку articles/ и выполните git push'
    : 'Статья добавлена. HTML-страница скачана → поместите в папку articles/ и выполните git push');
}

/* ===== SETTINGS ===== */
function fillSettingsForm() {
  document.getElementById('set-siteName').value     = settings.siteName || '';
  document.getElementById('set-heroSubtitle').value = settings.heroSubtitle || '';
  document.getElementById('set-phone').value        = settings.phone || '';
  document.getElementById('set-email').value        = settings.email || '';
  document.getElementById('set-address').value      = settings.address || '';
  document.getElementById('set-about').value        = settings.about || '';
  document.getElementById('set-inn').value          = settings.inn || '';
  document.getElementById('set-ogrn').value         = settings.ogrn || '';
  document.getElementById('set-reestry').value      = settings.reestryNumber || '';
  document.getElementById('set-palata').value       = settings.advokatPalata || '';
  document.getElementById('set-legalAddress').value = settings.legalAddress || '';
  document.getElementById('set-fullName').value     = settings.fullName || '';
  document.getElementById('set-telegram').value     = settings.social?.telegram || '';
  document.getElementById('set-whatsapp').value     = settings.social?.whatsapp || '';
  document.getElementById('set-vk').value           = settings.social?.vk || '';
}

function saveSettings() {
  settings = {
    siteName:      document.getElementById('set-siteName').value.trim(),
    heroSubtitle:  document.getElementById('set-heroSubtitle').value.trim(),
    phone:         document.getElementById('set-phone').value.trim(),
    email:         document.getElementById('set-email').value.trim(),
    address:       document.getElementById('set-address').value.trim(),
    about:         document.getElementById('set-about').value.trim(),
    inn:           document.getElementById('set-inn').value.trim(),
    ogrn:          document.getElementById('set-ogrn').value.trim(),
    reestryNumber: document.getElementById('set-reestry').value.trim(),
    advokatPalata: document.getElementById('set-palata').value.trim(),
    legalAddress:  document.getElementById('set-legalAddress').value.trim(),
    fullName:      document.getElementById('set-fullName').value.trim(),
    social: {
      telegram: document.getElementById('set-telegram').value.trim(),
      whatsapp: document.getElementById('set-whatsapp').value.trim(),
      vk:       document.getElementById('set-vk').value.trim(),
    },
  };
  saveToStorage('settings', settings);
  toast('Настройки сохранены. Обновите главную страницу для применения.');
}

/* ===== DELETE / CONFIRM ===== */
let pendingDelete = null;

function confirmDelete(type, id) {
  const names = { lawyer: 'этого адвоката', article: 'эту статью' };
  document.getElementById('confirmText').textContent = `Вы уверены, что хотите удалить ${names[type]}? Это действие нельзя отменить.`;
  pendingDelete = { type, id };
  document.getElementById('confirmModal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('open');
  pendingDelete = null;
}

document.getElementById('confirmOkBtn').addEventListener('click', () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  if (type === 'lawyer') {
    lawyers = lawyers.filter(x => x.id !== id);
    saveToStorage('lawyers', lawyers);
    renderLawyersTable();
    toast('Адвокат удалён');
  } else if (type === 'article') {
    articles = articles.filter(x => x.id !== id);
    saveToStorage('articles', articles);
    renderArticlesTable();
    toast('Статья удалена');
  }
  closeConfirm();
});

/* ===== EXPORT / IMPORT ===== */
function exportData() {
  const data = {
    lawyers,
    articles,
    settings,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'certorro-data-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Данные экспортированы');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.lawyers) { lawyers = data.lawyers; saveToStorage('lawyers', lawyers); renderLawyersTable(); }
      if (data.articles) { articles = data.articles; saveToStorage('articles', articles); renderArticlesTable(); }
      if (data.settings) { settings = data.settings; saveToStorage('settings', settings); fillSettingsForm(); }
      toast('Данные успешно импортированы');
    } catch(err) {
      toast('Ошибка чтения файла. Проверьте формат JSON.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (!confirm('Сбросить ВСЕ данные к значениям по умолчанию? Это действие нельзя отменить.')) return;
  Object.values(DATA_KEYS).forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* ===== STATIC PAGE GENERATORS ===== */

function articleContentToHtml(content) {
  if (!content) return '';
  const lines = content.split('\n');
  const out = [];
  let inList = false;
  lines.forEach(line => {
    const t = line.trim();
    if (!t) { if (inList) { out.push('</ul>'); inList = false; } return; }
    if (t.startsWith('—') || t.startsWith('- ')) {
      if (!inList) { out.push('<ul class="article-list">'); inList = true; }
      out.push('  <li>' + t.replace(/^[—\-]\s*/, '') + '</li>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<p>' + t + '</p>');
    }
  });
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function articleReadingTime(article) {
  const words = ((article.content || '') + ' ' + (article.summary || '')).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function articleFormatDate(d) {
  const months = ['января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'];
  try {
    const parts = d.split('-');
    return `${parseInt(parts[2])} ${months[parseInt(parts[1])-1]} ${parts[0]} г.`;
  } catch(e) { return d; }
}

function sharedHead(title, description, canonical, ogType, extra) {
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description.replace(/"/g,'&quot;')}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${ogType || 'website'}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description.replace(/"/g,'&quot;')}">
  <meta property="og:site_name" content="Адвокатская коллегия Альтер-Эго">
  <meta property="og:locale" content="ru_RU">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description.replace(/"/g,'&quot;').substring(0,160)}">
  ${extra || ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"></noscript>
  <link rel="stylesheet" href="../css/style.css">`;
}

function sharedHeader() {
  return `<header id="header">
  <div class="container header-inner">
    <a href="../index.html" class="logo">
      <span class="logo-name">Альтер-Эго</span>
      <span class="logo-sub">Адвокатская коллегия</span>
    </a>
    <nav class="nav-links" id="navLinks">
      <a href="../index.html">Главная</a>
      <a href="../about.html">О нас</a>
      <a href="../services.html">Услуги</a>
      <a href="../team.html">Команда</a>
      <a href="../articles.html">Статьи</a>
      <a href="../contact.html" class="nav-cta">Связаться</a>
    </nav>
    <a href="tel:+79169286505" class="header-phone">+7 (916) 928-65-05</a>
    <div class="burger" id="burger" aria-label="Меню" aria-expanded="false">
      <span></span><span></span><span></span>
    </div>
  </div>
</header>`;
}

function sharedCtaBand() {
  return `<section class="cta-band" style="position:relative;overflow:hidden">
  <div class="grid-bg" style="opacity:.4"></div>
  <div class="container" style="position:relative;z-index:1">
    <h2>Нужна юридическая помощь?</h2>
    <p>Запишитесь на консультацию — адвокат разберёт вашу ситуацию и предложит варианты действий.</p>
    <div>
      <a href="../contact.html" class="btn btn-gold">Записаться на консультацию</a>
      <a href="tel:+79169286505" class="btn btn-outline" style="margin-left:12px">Позвонить</a>
    </div>
  </div>
</section>`;
}

function sharedFooter() {
  return `<footer>
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
          <li><a href="../about.html">О коллегии</a></li>
          <li><a href="../services.html">Услуги</a></li>
          <li><a href="../team.html">Команда</a></li>
          <li><a href="../articles.html">Публикации</a></li>
          <li><a href="../contact.html">Контакты</a></li>
        </ul>
      </div>
      <div class="footer-nav">
        <h4>Правовое</h4>
        <ul>
          <li><a href="../privacy.html">Политика конфиденциальности</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      <div class="footer-bottom">
        <div>
          <div>© <span id="footerYear"></span> Адвокатская коллегия Альтер-Эго. Все права защищены.</div>
          <div class="footer-disclaimer" style="margin-top:6px">Информация на сайте носит общеознакомительный характер и не является юридической консультацией или публичной офертой.</div>
        </div>
      </div>
    </div>
  </div>
</footer>`;
}

function generateArticleHTML(article) {
  const slug = article.slug || '';
  const canonical = `https://al-e.net/articles/${slug}.html`;
  const dateFormatted = articleFormatDate(article.date || '');
  const mins = articleReadingTime(article);
  const category = article.category || 'Публикация';
  const title = `${article.title} | Адвокатская коллегия «Альтер-Эго»`;
  const description = (article.summary || '').substring(0, 160);
  const ogExtra = `<meta property="article:published_time" content="${article.date || ''}T00:00:00+03:00">
  <meta property="article:section" content="${category}">`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.summary || '',
        datePublished: (article.date || '') + 'T00:00:00+03:00',
        dateModified: (article.date || '') + 'T00:00:00+03:00',
        author: { '@id': 'https://al-e.net/#organization' },
        publisher: { '@id': 'https://al-e.net/#organization' },
        mainEntityOfPage: canonical,
        articleSection: category,
        inLanguage: 'ru'
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://al-e.net/' },
          { '@type': 'ListItem', position: 2, name: 'Публикации', item: 'https://al-e.net/articles.html' },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
${sharedHead(title, description, canonical, 'article', ogExtra)}
  <script type="application/ld+json">
${jsonLd}
  </script>
</head>
<body>

${sharedHeader()}

<div class="breadcrumbs-bar">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Путь">
      <a href="../index.html">Главная</a>
      <span class="bc-sep">›</span>
      <a href="../articles.html">Публикации</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">${category}</span>
    </nav>
  </div>
</div>

<section class="page-hero">
  <div class="hero-base" style="opacity:.8"></div>
  <div class="grid-bg"></div>
  <div class="grid-shimmer"></div>
  <div class="container page-hero-content">
    <span class="hero-badge" style="position:relative;z-index:2;margin-bottom:16px">${category}</span>
    <h1 style="max-width:800px">${article.title}</h1>
    <p style="position:relative;z-index:2">${dateFormatted} · ${mins} мин чтения</p>
  </div>
</section>

<article class="section section-alt" style="position:relative;overflow:hidden">
  <div class="grid-bg grid-bg-light" style="opacity:.35"></div>
  <div class="container" style="position:relative;z-index:1;max-width:800px">
    <div class="article-full-body">
      <p class="article-lead"><em>${article.summary || ''}</em></p>
      ${articleContentToHtml(article.content || '')}
    </div>
    <div style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <a href="../articles.html" class="btn btn-navy" style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Все публикации
      </a>
      <a href="../contact.html" class="btn btn-gold">Задать вопрос адвокату</a>
    </div>
  </div>
</article>

${sharedCtaBand()}

${sharedFooter()}

<script src="../js/script.js"></script>
<script>document.getElementById('footerYear').textContent = new Date().getFullYear();</script>
</body>
</html>`;
}

function generateLawyerHTML(lawyer) {
  const slug = lawyer.slug || transliterate(lawyer.name || '');
  const canonical = `https://al-e.net/team/${slug}.html`;
  const title = `${lawyer.name} — адвокат | Коллегия «Альтер-Эго»`;
  const description = (lawyer.bio || '').substring(0, 160);
  const position = lawyer.position || 'Адвокат';
  const spec = lawyer.specialization || '';
  const photoHtml = lawyer.photo
    ? `<img src="../${lawyer.photo}" alt="${lawyer.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:4px">`
    : `<div style="width:120px;height:120px;background:linear-gradient(135deg,var(--navy),var(--navy-mid));border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(201,160,61,0.4)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': canonical + '#person',
        name: lawyer.name,
        jobTitle: position,
        description: lawyer.bio || '',
        worksFor: { '@id': 'https://al-e.net/#organization' },
        identifier: `Рег. № ${lawyer.regNumber || ''}${lawyer.palata ? ', ' + lawyer.palata : ''}`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://al-e.net/' },
          { '@type': 'ListItem', position: 2, name: 'Команда', item: 'https://al-e.net/team.html' },
          { '@type': 'ListItem', position: 3, name: lawyer.name, item: canonical }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
${sharedHead(title, description, canonical, 'profile', '')}
  <script type="application/ld+json">
${jsonLd}
  </script>
</head>
<body>

${sharedHeader()}

<div class="breadcrumbs-bar">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Путь">
      <a href="../index.html">Главная</a>
      <span class="bc-sep">›</span>
      <a href="../team.html">Команда</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">${lawyer.name}</span>
    </nav>
  </div>
</div>

<section class="page-hero">
  <div class="hero-base" style="opacity:.8"></div>
  <div class="grid-bg"></div>
  <div class="grid-shimmer"></div>
  <div class="container page-hero-content">
    <span class="hero-badge" style="position:relative;z-index:2;margin-bottom:16px">${position}</span>
    <h1 style="max-width:800px">${lawyer.name}</h1>
    <p style="position:relative;z-index:2">${spec}</p>
  </div>
</section>

<section class="section section-alt" style="position:relative;overflow:hidden">
  <div class="grid-bg grid-bg-light" style="opacity:.35"></div>
  <div class="container" style="position:relative;z-index:1;max-width:800px">
    <div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start">
      <div style="flex-shrink:0">${photoHtml}</div>
      <div style="flex:1;min-width:240px">
        <div class="lawyer-full-spec" style="margin-bottom:16px">${spec}</div>
        ${lawyer.bio ? `<p class="lawyer-full-bio">${lawyer.bio}</p>` : ''}
        <div class="lawyer-full-meta" style="margin-top:20px">
          ${lawyer.experience ? `<span><strong>Опыт:</strong> ${lawyer.experience}</span>` : ''}
          ${lawyer.regNumber  ? `<span><strong>Рег. №</strong> ${lawyer.regNumber}</span>` : ''}
          ${lawyer.palata     ? `<span><strong>Палата:</strong> ${lawyer.palata}</span>` : ''}
        </div>
      </div>
    </div>
    <div style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);display:flex;align-items:center;flex-wrap:wrap;gap:12px">
      <a href="../team.html" class="btn btn-navy" style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Вся команда
      </a>
      <a href="../contact.html" class="btn btn-gold">Записаться на консультацию</a>
    </div>
  </div>
</section>

${sharedCtaBand()}

${sharedFooter()}

<script src="../js/script.js"></script>
<script>document.getElementById('footerYear').textContent = new Date().getFullYear();</script>
</body>
</html>`;
}

/* ===== EXPORT ALL STATIC PAGES ===== */
function exportAllStaticPages() {
  const all = [
    ...articles.filter(a => a.slug).map(a => ({ name: a.slug + '.html', html: generateArticleHTML(a) })),
    ...lawyers.filter(l => l.slug).map(l => ({ name: l.slug + '.html', html: generateLawyerHTML(l) })),
  ];
  if (!all.length) { toast('Нет данных для экспорта', 'error'); return; }
  all.forEach((item, i) => setTimeout(() => downloadFile(item.name, item.html), i * 400));
  toast(`Запущена загрузка ${all.length} файлов. Поместите articles/*.html и team/*.html в репозиторий и выполните git push.`);
}

/* ===== CLOSE MODALS ON OVERLAY CLICK ===== */
['lawyerModal', 'articleModal', 'confirmModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === document.getElementById(id)) {
      document.getElementById(id).classList.remove('open');
    }
  });
});

/* ===== AUTO-INIT ===== */
if (checkAuth()) {
  showPanel();
} else {
  document.getElementById('loginScreen').style.display = 'flex';
}
