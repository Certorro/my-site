/* ===== DATA LAYER =====
 * localStorage (admin edits) → JSON files (defaults)
 */
const DATA_KEYS = {
  lawyers:  'certorro_lawyers',
  articles: 'certorro_articles',
  settings: 'certorro_settings',
};

async function loadData(key, jsonPath) {
  const cached = localStorage.getItem(key);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  try {
    const res = await fetch(jsonPath);
    const data = await res.json();
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  } catch(e) {
    console.warn('Could not load', jsonPath, e);
    return key === DATA_KEYS.settings ? {} : [];
  }
}

/* ===== FORMAT DATE ===== */
function formatDate(d) {
  try { return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}); }
  catch { return d; }
}

/* ===== SETTINGS ===== */
async function applySettings() {
  const s = await loadData(DATA_KEYS.settings, 'data/settings.json');
  if (!s) return;

  if (s.siteName) {
    document.title = s.siteName + ' — Профессиональная юридическая помощь';
    const el = document.getElementById('heroSiteName');
    if (el) {
      const shortName = s.siteName.replace(/Адвокатская коллегия\s*/i,'').replace(/Коллегия\s*/i,'').trim();
      el.textContent = shortName || s.siteName;
    }
  }
  if (s.heroSubtitle) setEl('heroSubtitle', s.heroSubtitle);
  if (s.about)        setEl('aboutText', s.about);
  if (s.phone) {
    const el = document.getElementById('contactPhone');
    if (el) { el.textContent = s.phone; el.href = 'tel:' + s.phone.replace(/\D/g,''); }
  }
  if (s.email) {
    const el = document.getElementById('contactEmail');
    if (el) { el.textContent = s.email; el.href = 'mailto:' + s.email; }
  }
  if (s.address)        setEl('contactAddress', s.address);
  if (s.fullName)       setEl('legalFullName', s.fullName);
  if (s.inn)            setEl('legalINN', s.inn);
  if (s.ogrn)           setEl('legalOGRN', s.ogrn);
  if (s.reestryNumber)  setEl('legalReestry', s.reestryNumber);
  if (s.legalAddress)   setEl('legalAddress', s.legalAddress);
  if (s.address)        setEl('factAddress', s.address);
  if (s.advokatPalata)  setEl('advokatPalata', s.advokatPalata);
}
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

/* ===== TEAM ===== */
async function renderTeam() {
  const lawyers = await loadData(DATA_KEYS.lawyers, 'data/lawyers.json');
  const grid = document.getElementById('teamGrid');
  if (!grid) return;

  if (!lawyers.length) {
    grid.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;grid-column:1/-1;padding:32px">Информация о команде скоро появится</p>';
    return;
  }

  grid.innerHTML = lawyers.map(l => `
    <div class="lawyer-card fade-up">
      <div class="lawyer-photo">
        ${l.photo
          ? `<img src="${l.photo}" alt="${l.name}" loading="lazy">`
          : `<div class="lawyer-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
      </div>
      <div class="lawyer-info">
        <h3>${l.name}</h3>
        <div class="lawyer-spec">${l.specialization || l.position}</div>
        <div class="lawyer-exp">${l.experience}</div>
        ${l.bio ? `<p style="color:rgba(255,255,255,0.48);font-size:0.82rem;margin-top:10px;line-height:1.6">${l.bio}</p>` : ''}
        ${l.regNumber ? `<div class="lawyer-reg">Рег. № ${l.regNumber}</div>` : ''}
        ${l.palata    ? `<div class="lawyer-palata">${l.palata}</div>` : ''}
      </div>
    </div>
  `).join('');
}

/* ===== ARTICLES (MAIN PAGE — last 3) ===== */
async function renderArticles() {
  const articles = await loadData(DATA_KEYS.articles, 'data/articles.json');
  const grid = document.getElementById('articlesGrid');
  if (!grid) return;

  const recent = articles.slice(0, 3);
  if (!recent.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-light);grid-column:1/-1">Статьи скоро появятся</p>';
    return;
  }

  grid.innerHTML = recent.map(a => `
    <div class="article-card fade-up">
      <div class="article-photo">
        ${a.photo
          ? `<img src="${a.photo}" alt="${a.title}" loading="lazy">`
          : `<div class="article-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>`}
        ${a.category ? `<div class="article-cat-badge"><span class="cat-badge">${a.category}</span></div>` : ''}
      </div>
      <div class="article-body">
        <div class="article-date">${formatDate(a.date)}</div>
        <h3>${a.title}</h3>
        <p>${a.summary}</p>
        <a href="#" class="article-link" onclick="openArticleModal(${a.id});return false;">
          Читать <span class="article-link-arrow">→</span>
        </a>
      </div>
    </div>
  `).join('');
}

/* ===== ARTICLE MODAL ===== */
async function openArticleModal(id) {
  const articles = await loadData(DATA_KEYS.articles, 'data/articles.json');
  const a = articles.find(x => x.id === id);
  if (!a) return;

  const modal = document.getElementById('articleModal');
  if (!modal) return;

  document.getElementById('articleModalTitle').textContent = a.title;
  document.getElementById('articleModalMeta').innerHTML = `
    <span style="font-size:0.78rem;color:var(--gold)">${formatDate(a.date)}</span>
    ${a.category ? `<span class="cat-badge" style="background:rgba(10,31,68,0.08);color:var(--navy)">${a.category}</span>` : ''}
  `;
  const body = (a.content || a.summary).split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('');
  document.getElementById('articleModalBody').innerHTML = body;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeArticleModal() {
  const modal = document.getElementById('articleModal');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
}

/* ===== HEADER ===== */
function initHeader() {
  const header = document.getElementById('header');
  const burger = document.getElementById('burger');
  const nav    = document.getElementById('navLinks');
  if (!header) return;

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  burger?.addEventListener('click', () => {
    const open = burger.classList.toggle('open');
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ===== CONTACT FORM ===== */
function initContactForm() {
  const form    = document.getElementById('contactForm');
  const modal   = document.getElementById('successModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const closeX  = document.getElementById('modalClose');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const consent = form.querySelector('#consent');
    if (consent && !consent.checked) {
      consent.focus();
      return;
    }
    if (modal) modal.classList.add('open');
    form.reset();
  });

  const closeModal = () => { if (modal) modal.classList.remove('open'); };
  closeBtn?.addEventListener('click', closeModal);
  closeX?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

/* ===== ARTICLE MODAL EVENTS ===== */
function initArticleModal() {
  const closeBtn = document.getElementById('articleModalClose');
  const overlay  = document.getElementById('articleModal');
  closeBtn?.addEventListener('click', closeArticleModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeArticleModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeArticleModal(); });
}

/* ===== MOUSE PARALLAX ===== */
function initParallax() {
  const bg = document.getElementById('heroBg');
  if (!bg) return;
  let ticking = false;

  document.addEventListener('mousemove', e => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const xShift = ((e.clientX / window.innerWidth)  - 0.5) * 14;
      const yShift = ((e.clientY / window.innerHeight) - 0.5) * 10;
      bg.style.transform = `translate(calc(-5% + ${xShift}px), calc(-5% + ${yShift}px))`;
      ticking = false;
    });
    ticking = true;
  });
}

/* ===== SCROLL FADE-UP ANIMATIONS ===== */
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  initHeader();
  initContactForm();
  initArticleModal();
  initParallax();

  await applySettings();
  await renderTeam();
  await renderArticles();

  // Run scroll animations after content is in DOM
  requestAnimationFrame(() => {
    requestAnimationFrame(initScrollAnimations);
  });
});
