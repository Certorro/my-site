/* ============================================================
   Альтер-Эго — Site Chrome
   Cookie-баннер · Яндекс.Метрика

   Шапку и подвал этот файл больше не собирает: их разметку
   вставляет scripts/build.py при публикации, чтобы навигация
   существовала в HTML без выполнения JS. Здесь остаётся только
   поведение, которое без JS и не нужно.
   ============================================================ */
(function () {
  'use strict';

  /* --- Root path ('' for root pages, '../' for depth-1 subdirs) ---- */
  var me = document.currentScript
    || (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    }());
  var src = me ? (me.getAttribute('src') || '') : '';
  var upCount = (src.match(/\.\.\//g) || []).length;
  var R = '../'.repeat(upCount); /* '' for root, '../' for articles/, team/ */
  var COOKIE_KEY = 'ae_cookie_consent';

  /* Согласие хранится как JSON {analytics, webvisor}. Старые значения
     'accepted' / 'declined' от прежнего баннера читаются как раньше. */
  function readConsent() {
    var v;
    try { v = localStorage.getItem(COOKIE_KEY); } catch (e) { return null; }
    if (!v) return null;
    if (v === 'accepted') return { analytics: true, webvisor: true };
    if (v === 'declined') return { analytics: false, webvisor: false };
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  /* Где на странице кнопка: панель, шапка, меню, блок призыва или текст раздела. */
  function callPlace(a) {
    if (a.closest('.mobile-bar')) return 'bar';
    if (a.closest('.nav-phone-drawer, .nav-drawer, .mobile-menu')) return 'menu';
    if (a.closest('header, .header, .site-header')) return 'header';
    if (a.closest('.cta-band')) return 'cta';
    if (a.closest('footer')) return 'footer';
    var p = location.pathname;
    if (p.indexOf('/team/') !== -1) return 'profile';
    if (p.indexOf('/articles/') !== -1) return 'article';
    if (p.indexOf('/ugolovnye-dela') !== -1) return 'practice';
    if (p.indexOf('contact') !== -1) return 'contact';
    if (p === '/' || p.indexOf('index') !== -1) return 'home';
    return 'other';
  }
  function writeConsent(c) {
    try { localStorage.setItem(COOKIE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  window.AE = {

    /* Вызывается в конце <body> каждой страницы. Подвал уже в разметке —
       здесь только год, кнопка управления cookie и баннер согласия. */
    initChrome: function () {
      var fy = document.getElementById('footerYear');
      if (fy) fy.textContent = new Date().getFullYear();

      /* Cookie management button — reset consent and reload */
      var manageBtn = document.getElementById('cookieManageBtn');
      if (manageBtn) {
        manageBtn.addEventListener('click', function () {
          try { localStorage.removeItem(COOKIE_KEY); } catch (e) {}
          window.location.reload();
        });
      }

      /* Баннер: показываем, пока выбор не сохранён. По умолчанию все
         категории включены; Метрика стартует после «Принять» или «Сохранить». */
      if (!readConsent()) {
        var banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Настройки cookie');
        banner.innerHTML =
          '<div class="cookie-inner">' +
            '<p class="cookie-text">Мы используем куки для правильной работы сайта.</p>' +
            '<div class="cookie-actions">' +
              '<button class="cookie-accept" id="cookieAccept" type="button">Принять</button>' +
              '<button class="cookie-settings-btn" id="cookieSettingsBtn" type="button" aria-expanded="false" aria-controls="cookieSettings">Настроить</button>' +
              '<a class="cookie-more" href="' + R + 'privacy.html">Подробнее</a>' +
            '</div>' +
            '<div class="cookie-settings" id="cookieSettings" hidden>' +
              '<label class="cookie-opt">' +
                '<input type="checkbox" checked disabled>' +
                '<span><strong>Необходимые</strong> — работа сайта и запоминание вашего выбора. Отключить нельзя.</span>' +
              '</label>' +
              '<label class="cookie-opt">' +
                '<input type="checkbox" id="cookieAnalytics" checked>' +
                '<span><strong>Аналитические</strong> — Яндекс Метрика: статистика посещений, чтобы улучшать сайт.</span>' +
              '</label>' +
              '<label class="cookie-opt">' +
                '<input type="checkbox" id="cookieWebvisor" checked>' +
                '<span><strong>Вебвизор и карта кликов</strong> — как посетители пользуются страницами. Работают вместе с аналитикой.</span>' +
              '</label>' +
              '<button class="cookie-accept" id="cookieSave" type="button">Сохранить</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(banner);

        var AEref = window.AE;
        var an = document.getElementById('cookieAnalytics');
        var wv = document.getElementById('cookieWebvisor');
        an.addEventListener('change', function () {
          wv.disabled = !an.checked;
          if (!an.checked) wv.checked = false;
        });
        var close = function (c) {
          writeConsent(c);
          banner.classList.add('cookie-banner--hidden');
          if (AEref && AEref.initMetrika) AEref.initMetrika();
        };
        document.getElementById('cookieAccept').addEventListener('click', function () {
          close({ analytics: true, webvisor: true });
        });
        document.getElementById('cookieSettingsBtn').addEventListener('click', function () {
          var panel = document.getElementById('cookieSettings');
          panel.hidden = !panel.hidden;
          this.setAttribute('aria-expanded', String(!panel.hidden));
        });
        document.getElementById('cookieSave').addEventListener('click', function () {
          close({ analytics: an.checked, webvisor: an.checked && wv.checked });
        });
      }
    },

    initMetrika: function () {
      var c = readConsent();
      if (!c || !c.analytics) return;
      if (window.__aeMetrika) return;
      window.__aeMetrika = true;
      (function (m, e, t, r, i, k, a) {
        m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
        m[i].l = 1 * new Date();
        for (var j = 0; j < document.scripts.length; j++) {
          if (document.scripts[j].src === r) { return; }
        }
        k = e.createElement(t);
        a = e.getElementsByTagName(t)[0];
        k.async = 1;
        k.src = r;
        a.parentNode.insertBefore(k, a);
      })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=109534459', 'ym');
      ym(109534459, 'init', {
        ssr: true, webvisor: !!c.webvisor, clickmap: !!c.webvisor,
        ecommerce: 'dataLayer', referrer: document.referrer,
        url: location.href, accurateTrackBounce: true, trackLinks: true
      });
      /* Цели по месту кнопки: какая кнопка приносит звонки.
         call_bar — нижняя панель на телефоне, call_header — шапка и меню,
         call_content — кнопки в тексте страницы; точное место — в параметре place. */
      document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="tel:"], a[href*="t.me/"], a[href^="mailto:"]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var place = callPlace(a);
        var goal;
        if (href.indexOf('tel:') === 0) {
          goal = place === 'bar' ? 'call_bar'
               : (place === 'header' || place === 'menu') ? 'call_header'
               : 'call_content';
        } else if (href.indexOf('t.me/') !== -1) {
          goal = 'telegram';
        } else {
          goal = 'email';
        }
        ym(109534459, 'reachGoal', goal, { place: place, page: location.pathname });
      });
      var ns = document.createElement('noscript');
      ns.innerHTML = '<div><img src="https://mc.yandex.ru/watch/109534459" style="position:absolute;left:-9999px" alt=""/></div>';
      document.body.appendChild(ns);
    }

  };

}());
