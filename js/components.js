/* ============================================================
   Альтер-Эго — Shared Site Components
   Header · Footer · Yandex.Metrika
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

  /* --- Phone SVG icons -------------------------------------------- */
  var PHN15 = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07-.01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.41-.41a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>';
  var PHN18 = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07-.01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.41-.41a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>';

  /* ================================================================
     HEADER
     ================================================================ */
  var HEADER =
    '<header id="header">\n' +
    '  <div class="container header-inner">\n' +
    '    <a href="' + R + 'index.html" class="logo">\n' +
    '      <img src="' + R + 'logo.png" alt="" class="logo-mark" aria-hidden="true" width="68" height="68">\n' +
    '      <div class="logo-text">\n' +
    '        <span class="logo-name">Альтер-Эго</span>\n' +
    '        <span class="logo-sub">Адвокатская коллегия</span>\n' +
    '      </div>\n' +
    '    </a>\n' +
    '    <nav class="nav-links" id="navLinks">\n' +
    '      <a href="' + R + 'index.html">Главная</a>\n' +
    '      <a href="' + R + 'about.html">О нас</a>\n' +
    '      <a href="' + R + 'services.html">Услуги</a>\n' +
    '      <a href="' + R + 'team.html">Команда</a>\n' +
    '      <a href="' + R + 'articles.html">Статьи</a>\n' +
    '      <a href="' + R + 'contact.html" class="nav-cta">Связаться</a>\n' +
    '      <a href="tel:+79169286505" class="nav-phone-drawer">' + PHN15 + '+7 (916) 928-65-05</a>\n' +
    '    </nav>\n' +
    '    <a href="tel:+79169286505" class="header-phone" aria-label="Позвонить: +7 (916) 928-65-05">' + PHN18 + '<span class="header-phone-text">+7 (916) 928-65-05</span></a>\n' +
    '    <button class="burger" id="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="navLinks">\n' +
    '      <span></span><span></span><span></span>\n' +
    '    </button>\n' +
    '  </div>\n' +
    '</header>';

  /* ================================================================
     FOOTER
     ================================================================ */
  var FOOTER =
    '<footer>\n' +
    '  <div class="container">\n' +
    '    <div class="footer-inner">\n' +
    '      <div class="footer-brand">\n' +
    '        <div class="logo">\n' +
    '          <span class="logo-name">Альтер-Эго</span>\n' +
    '          <span class="logo-sub">Адвокатская коллегия</span>\n' +
    '        </div>\n' +
    '        <p style="margin-top:16px">Профессиональная юридическая помощь. Действуем на основании ФЗ-63 «Об адвокатской деятельности и адвокатуре в РФ».</p>\n' +
    '      </div>\n' +
    '      <div class="footer-nav">\n' +
    '        <h4>Навигация</h4>\n' +
    '        <ul>\n' +
    '          <li><a href="' + R + 'about.html">О коллегии</a></li>\n' +
    '          <li><a href="' + R + 'services.html">Услуги</a></li>\n' +
    '          <li><a href="' + R + 'team.html">Команда</a></li>\n' +
    '          <li><a href="' + R + 'articles.html">Публикации</a></li>\n' +
    '          <li><a href="' + R + 'contact.html">Контакты</a></li>\n' +
    '        </ul>\n' +
    '      </div>\n' +
    '      <div class="footer-nav">\n' +
    '        <h4>Практика</h4>\n' +
    '        <ul>\n' +
    '          <li><a href="' + R + 'services.html">Уголовные дела</a></li>\n' +
    '          <li><a href="' + R + 'services.html">Арбитраж</a></li>\n' +
    '          <li><a href="' + R + 'services.html">Семейное право</a></li>\n' +
    '          <li><a href="' + R + 'services.html">Недвижимость</a></li>\n' +
    '          <li><a href="' + R + 'privacy.html">Политика конфиденциальности</a></li>\n' +
    '        </ul>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="footer-legal">\n' +
    '      <div class="footer-bottom">\n' +
    '        <div>\n' +
    '          <div>© <span id="footerYear"></span> Адвокатская коллегия Альтер-Эго. Все права защищены.</div>\n' +
    '          <div class="footer-disclaimer" style="margin-top:6px">Информация на сайте носит общеознакомительный характер и не является юридической консультацией или публичной офертой.</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</footer>';

  /* ================================================================
     Inject header (synchronous — runs before rest of body parses)
     ================================================================ */
  var headerPh = document.getElementById('header-placeholder');
  if (headerPh) {
    headerPh.outerHTML = HEADER;
  }

  /* ================================================================
     Deferred calls — invoked at end of each page's <body>
     ================================================================ */
  window.AE = {

    injectFooter: function () {
      var footerPh = document.getElementById('footer-placeholder');
      if (!footerPh) return;
      footerPh.outerHTML = FOOTER;
      var fy = document.getElementById('footerYear');
      if (fy) fy.textContent = new Date().getFullYear();
    },

    initMetrika: function () {
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
        ssr: true, webvisor: true, clickmap: true,
        ecommerce: 'dataLayer', referrer: document.referrer,
        url: location.href, accurateTrackBounce: true, trackLinks: true
      });
      var ns = document.createElement('noscript');
      ns.innerHTML = '<div><img src="https://mc.yandex.ru/watch/109534459" style="position:absolute;left:-9999px" alt=""/></div>';
      document.body.appendChild(ns);
    }

  };

}());
