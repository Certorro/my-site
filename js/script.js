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

/* ===== READING TIME ===== */
function readingTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ===== ACTIVE NAV ===== */
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const hPage = href.split('/').pop().split('#')[0] || 'index.html';
    a.classList.toggle('nav-active', hPage === page);
  });
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
  if (s.about)        { setEl('aboutText', s.about); setEl('aboutFullText', s.about); }
  if (s.phone) {
    ['contactPhone','contactPhone2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = s.phone; el.href = 'tel:' + s.phone.replace(/\D/g,''); }
    });
  }
  if (s.email) {
    ['contactEmail','contactEmail2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = s.email; el.href = 'mailto:' + s.email; }
    });
  }
  if (s.address)       { setEl('contactAddress', s.address); setEl('contactAddress2', s.address); }
  if (s.fullName)      setEl('legalFullName', s.fullName);
  if (s.inn)           setEl('legalINN', s.inn);
  if (s.ogrn)          setEl('legalOGRN', s.ogrn);
  if (s.reestryNumber) setEl('legalReestry', s.reestryNumber);
  if (s.legalAddress)  setEl('legalAddress', s.legalAddress);
  if (s.address)       setEl('factAddress', s.address);
  if (s.advokatPalata) setEl('advokatPalata', s.advokatPalata);
}
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

/* ===== LAWYER CARD HTML (dark team section on home.html) ===== */
function lawyerCardHTML(l) {
  const photo = l.photo
    ? `<img src="${l.photo}" alt="${l.name}" loading="lazy">`
    : `<div class="lawyer-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
  return `
    <div class="lawyer-card fade-up">
      <div class="lawyer-photo">${photo}</div>
      <div class="lawyer-info">
        <h3>${l.name}</h3>
        <div class="lawyer-spec">${l.specialization || l.position}</div>
        <div class="lawyer-exp">${l.experience}</div>
        ${l.bio ? `<p style="color:rgba(255,255,255,0.48);font-size:0.82rem;margin-top:10px;line-height:1.6">${l.bio}</p>` : ''}
        ${l.regNumber ? `<div class="lawyer-reg">Рег. № ${l.regNumber}</div>` : ''}
        ${l.palata    ? `<div class="lawyer-palata">${l.palata}</div>` : ''}
      </div>
    </div>`;
}

/* ===== LAWYER FULL CARD HTML (team.html) ===== */
function lawyerFullCardHTML(l) {
  const photo = l.photo
    ? `<img src="${l.photo}" alt="${l.name}" loading="lazy">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  return `
    <div class="lawyer-full-card fade-up">
      <div class="lawyer-full-photo">${photo}</div>
      <div class="lawyer-full-info">
        <h3>${l.name}</h3>
        <div class="lawyer-full-spec">${l.specialization || l.position}</div>
        ${l.bio ? `<p class="lawyer-full-bio">${l.bio}</p>` : ''}
        <div class="lawyer-full-meta">
          ${l.experience ? `<span><strong>Опыт:</strong> ${l.experience}</span>` : ''}
          ${l.regNumber  ? `<span><strong>Рег. №</strong> ${l.regNumber}</span>` : ''}
          ${l.palata     ? `<span><strong>Палата:</strong> ${l.palata}</span>` : ''}
        </div>
      </div>
    </div>`;
}

/* ===== TEAM (home page — max 3) ===== */
async function renderTeam() {
  const lawyers = await loadData(DATA_KEYS.lawyers, 'data/lawyers.json');
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  if (!lawyers.length) {
    grid.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;grid-column:1/-1;padding:32px">Информация о команде скоро появится</p>';
    return;
  }
  grid.innerHTML = lawyers.slice(0, 3).map(lawyerCardHTML).join('');
}

/* ===== TEAM FULL (team.html) ===== */
async function renderFullTeam() {
  const lawyers = await loadData(DATA_KEYS.lawyers, 'data/lawyers.json');
  const grid = document.getElementById('teamFullGrid');
  if (!grid) return;
  if (!lawyers.length) {
    grid.innerHTML = '<p style="color:var(--text-light);text-align:center;grid-column:1/-1;padding:48px">Информация о команде скоро появится</p>';
    return;
  }
  grid.innerHTML = lawyers.map(lawyerFullCardHTML).join('');
}

/* ===== ARTICLE CARD HTML (home page — links to articles.html) ===== */
function homeArticleCardHTML(a) {
  const mins = readingTime(a.content || a.summary || '');
  return `
  <div class="article-card">
    <div class="article-category">${a.category || ''}</div>
    <h3>${a.title}</h3>
    <div class="article-date">${formatDate(a.date)}<span class="article-reading-time">${mins} мин</span></div>
    <div class="article-excerpt">${a.summary}</div>
    <a href="${a.slug ? 'articles/' + a.slug + '.html' : 'articles.html'}" class="read-more">Читать далее →</a>
  </div>`;
}

/* ===== ARTICLES (home page — first 3) ===== */
async function renderArticles() {
  const articles = await loadData(DATA_KEYS.articles, 'data/articles.json');
  const grid = document.getElementById('articlesGrid');
  if (!grid) return;
  const recent = articles.slice(0, 3);
  if (!recent.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-light);grid-column:1/-1">Статьи скоро появятся</p>';
    return;
  }
  grid.innerHTML = recent.map(homeArticleCardHTML).join('');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cards = grid.querySelectorAll('.article-card');
    const shifts = [-6, 0, 4];
    const obs = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.filter = 'drop-shadow(0 0 0 rgba(201,160,61,0))';
          entry.target.style.transform = 'scale(1)';
        }, i * 80);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    cards.forEach((card, i) => {
      card.style.transform = `translateY(${shifts[i % shifts.length]}px)`;
      obs.observe(card);
    });
  }));
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

  const closeNav = () => {
    burger.classList.remove('open');
    nav.classList.remove('open');
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger?.addEventListener('click', () => {
    const open = burger.classList.toggle('open');
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', open);
  });

  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));

  document.addEventListener('click', e => {
    if (nav?.classList.contains('open') && !nav.contains(e.target) && !burger?.contains(e.target)) {
      closeNav();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNav();
  });
}

/* ===== CONTACT FORM ===== */
function initContactForm() {
  const form     = document.getElementById('contactForm');
  const modal    = document.getElementById('successModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const closeX   = document.getElementById('modalClose');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const consent = form.querySelector('#consent');
    if (consent && !consent.checked) { consent.focus(); return; }
    if (modal) modal.classList.add('open');
    form.reset();
  });

  const closeModal = () => { if (modal) modal.classList.remove('open'); };
  closeBtn?.addEventListener('click', closeModal);
  closeX?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

/* ===== MOUSE PARALLAX — all .grid-bg elements ===== */
function initParallax() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  const grids = document.querySelectorAll('.grid-bg');
  const heroBg = document.getElementById('heroBg');
  if (!grids.length && !heroBg) return;
  let ticking = false;

  document.addEventListener('mousemove', e => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const xPct = (e.clientX / window.innerWidth)  - 0.5;
      const yPct = (e.clientY / window.innerHeight) - 0.5;
      grids.forEach(bg => {
        const x = xPct * 10;
        const y = yPct * 10;
        bg.style.transform = `translate(calc(-5% + ${x}px), calc(-5% + ${y}px))`;
      });
      if (heroBg) {
        heroBg.style.transform = `translate(calc(-5% + ${xPct * 14}px), calc(-5% + ${yPct * 10}px))`;
      }
      ticking = false;
    });
    ticking = true;
  });
}

/* ===== RIPPLE EFFECT ===== */
function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn, .cat-btn, .page-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top  = (e.clientY - rect.top)  + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  initHeader();
  setActiveNav();
  initParallax();
  initRipple();

  await applySettings();

  if (!page || page === 'home.html' || page === 'index.html') {
    await renderTeam();
    await renderArticles();
  }

  if (page === 'team.html') {
    await renderFullTeam();
  }

  if (page === 'contact.html') {
    initContactForm();
  }
});
