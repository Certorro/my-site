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
          localStorage.removeItem(COOKIE_KEY);
          window.location.reload();
        });
      }

      /* Show cookie banner only when consent is not yet recorded */
      if (!localStorage.getItem(COOKIE_KEY)) {
        var banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Управление cookie');
        banner.innerHTML =
          '<div class="cookie-inner">' +
            '<p class="cookie-text"><strong>Аналитические cookie.</strong> ' +
            'Мы используем Яндекс.Метрику (Вебвизор, тепловые карты кликов) для анализа посещаемости. ' +
            'Аналитические cookie устанавливаются только с вашего согласия.</p>' +
            '<div class="cookie-actions">' +
              '<button class="cookie-accept" id="cookieAccept" type="button">Принять</button>' +
              '<button class="cookie-decline" id="cookieDecline" type="button">Отклонить</button>' +
              '<a class="cookie-more" href="' + R + 'privacy.html">Подробнее</a>' +
            '</div>' +
          '</div>';
        document.body.appendChild(banner);

        var AEref = window.AE;
        document.getElementById('cookieAccept').addEventListener('click', function () {
          localStorage.setItem(COOKIE_KEY, 'accepted');
          banner.classList.add('cookie-banner--hidden');
          if (AEref && AEref.initMetrika) AEref.initMetrika();
        });
        document.getElementById('cookieDecline').addEventListener('click', function () {
          localStorage.setItem(COOKIE_KEY, 'declined');
          banner.classList.add('cookie-banner--hidden');
        });
      }
    },

    initMetrika: function () {
      if (localStorage.getItem(COOKIE_KEY) !== 'accepted') return;
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
      document.addEventListener('click', function (e) {
        if (e.target.closest('a[href^="tel:"]'))    ym(109534459, 'reachGoal', 'phone_click');
        if (e.target.closest('a[href^="mailto:"]')) ym(109534459, 'reachGoal', 'email_click');
      });
      var ns = document.createElement('noscript');
      ns.innerHTML = '<div><img src="https://mc.yandex.ru/watch/109534459" style="position:absolute;left:-9999px" alt=""/></div>';
      document.body.appendChild(ns);
    }

  };

}());
