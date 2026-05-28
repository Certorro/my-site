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
  };

  if (id) {
    const idx = lawyers.findIndex(x => x.id === parseInt(id));
    if (idx !== -1) lawyers[idx] = data;
  } else {
    lawyers.push(data);
  }

  saveToStorage('lawyers', lawyers);
  renderLawyersTable();
  closeLawyerModal();
  toast(id ? 'Данные адвоката обновлены' : 'Адвокат добавлен');
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
  const rawTitle = title.toLowerCase().replace(/[^a-zа-яё0-9\s]/gi, '').replace(/\s+/g, '-').substring(0, 50);
  const data = {
    id: id ? parseInt(id) : generateId(articles),
    title,
    category: document.getElementById('article-category').value.trim(),
    date: document.getElementById('article-date').value || new Date().toISOString().split('T')[0],
    photo: document.getElementById('article-photo').value.trim(),
    summary,
    content: document.getElementById('article-content').value.trim(),
    slug: rawTitle,
  };

  if (id) {
    const idx = articles.findIndex(x => x.id === parseInt(id));
    if (idx !== -1) articles[idx] = data;
  } else {
    articles.unshift(data);
  }

  saveToStorage('articles', articles);
  renderArticlesTable();
  closeArticleModal();
  toast(id ? 'Статья обновлена' : 'Статья добавлена и появится на главной');
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
