// Netflix Cards Style 1.0 by LEX for FOIL (2026)
(function () {
  'use strict';

  console.log('[Netflix Cards] Загружен. Делаем карточки как в премиум-стриминге');

  const PLUGIN_NAME = 'netflix_cards';
  const SETTINGS_PREFIX = 'netflix_cards_';

  // Настройки (добавляются в меню плагинов)
  const settings = {
    enable: Lampa.Storage.get(SETTINGS_PREFIX + 'enable', true),
    show_season_text: Lampa.Storage.get(SETTINGS_PREFIX + 'show_season_text', true),
    show_progress_bar: Lampa.Storage.get(SETTINGS_PREFIX + 'show_progress_bar', true),
    show_quality: Lampa.Storage.get(SETTINGS_PREFIX + 'show_quality', true),
    large_fonts: Lampa.Storage.get(SETTINGS_PREFIX + 'large_fonts', true)
  };

  // CSS — градиент, большие надписи, прогресс-бар
  function injectCSS() {
    if (document.getElementById('netflix_cards_css')) return;

    const style = document.createElement('style');
    style.id = 'netflix_cards_css';
    style.innerHTML = `
      .card__netflix_view {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        transition: transform 0.35s ease, box-shadow 0.35s ease;
      }
      .card__netflix_view:hover, .card__netflix_view.focus {
        transform: scale(1.08);
        box-shadow: 0 16px 48px rgba(0,0,0,0.8);
      }
      .netflix_overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.9) 100%);
        pointer-events: none;
      }
      .netflix_season_big {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 2.8em;
        font-weight: 900;
        text-shadow: 3px 3px 12px black;
        letter-spacing: 2px;
        z-index: 10;
        pointer-events: none;
      }
      .netflix_progress_bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 6px;
        background: rgba(255,255,255,0.2);
        z-index: 15;
      }
      .netflix_progress_fill {
        height: 100%;
        background: #e50914; /* Netflix red */
        transition: width 0.6s ease;
      }
      .netflix_quality {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.9em;
        font-weight: bold;
        z-index: 12;
      }
      .netflix_next_date {
        position: absolute;
        bottom: 12px;
        left: 12px;
        color: #ff4444;
        font-size: 0.95em;
        font-weight: bold;
        text-shadow: 1px 1px 4px black;
        z-index: 12;
      }
    `;
    document.head.appendChild(style);
  }

  // Получаем качество (JacRed зеркала)
  function getQuality(title, year, callback) {
    const mirrors = ['jacred.bond', 'jacred.online', 'jred.top'];
    let idx = 0;

    function tryNext() {
      if (idx >= mirrors.length) return callback(null);
      const url = `https://${mirrors[idx++]}/api/v2/torrents?search=${encodeURIComponent(title)}&year=${year}`;

      fetch(url)
        .then(r => r.json())
        .then(arr => {
          if (!Array.isArray(arr) || !arr.length) return tryNext();
          const best = arr
            .filter(t => t.quality > 0 && !/cam|ts|telesync/i.test(t.title || ''))
            .sort((a,b) => b.quality - a.quality)[0];
          if (best) {
            let q = best.quality >= 2160 ? '4K' : best.quality >= 1080 ? '1080p' : '720p';
            callback(q);
          } else callback(null);
        })
        .catch(tryNext);
    }
    tryNext();
  }

  // Рендер карточки
  function enhanceCard(card) {
    if (!settings.enable || card.classList.contains('netflix-enhanced')) return;
    card.classList.add('netflix-enhanced');

    const view = card.querySelector('.card__view');
    if (!view) return;

    // Оверлей градиент
    const overlay = document.createElement('div');
    overlay.className = 'netflix_overlay';
    view.appendChild(overlay);

    const data = card.card_data || {};
    const isTV = data.name || data.original_name || data.number_of_seasons;
    const title = data.title || data.name || '';
    const year = (data.release_date || data.first_air_date || '').slice(0,4);

    // Большой текст сезона
    if (settings.show_season_text && isTV && data.last_episode_to_air) {
      const last = data.last_episode_to_air;
      const text = `S${last.season_number} • Эпизод ${last.episode_number}`;
      const big = document.createElement('div');
      big.className = 'netflix_season_big';
      big.textContent = text;
      view.appendChild(big);
    }

    // Прогресс-бар сезона
    if (settings.show_progress_bar && isTV && data.number_of_seasons && data.last_episode_to_air) {
      const totalEp = data.number_of_episodes || 0;
      const airedEp = data.last_episode_to_air.episode_number || 0;
      const percent = totalEp > 0 ? (airedEp / totalEp) * 100 : 0;

      const bar = document.createElement('div');
      bar.className = 'netflix_progress_bar';
      const fill = document.createElement('div');
      fill.className = 'netflix_progress_fill';
      fill.style.width = percent + '%';
      bar.appendChild(fill);
      view.appendChild(bar);
    }

    // Качество
    if (settings.show_quality) {
      getQuality(title, year, q => {
        if (q) {
          const qual = document.createElement('div');
          qual.className = 'netflix_quality';
          qual.textContent = q;
          view.appendChild(qual);
        }
      });
    }

    // Дата следующей серии
    if (isTV && data.next_episode_to_air?.air_date) {
      const air = new Date(data.next_episode_to_air.air_date);
      const days = Math.ceil((air - Date.now()) / 86400000);
      let txt = days <= 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
      const nextEl = document.createElement('div');
      nextEl.className = 'netflix_next_date';
      nextEl.textContent = txt;
      view.appendChild(nextEl);
    }
  }

  // Observer для новых карточек
  function startObserver() {
    injectCSS();

    const observer = new MutationObserver(() => {
      document.querySelectorAll('.card:not(.netflix-enhanced)').forEach(enhanceCard);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Первичный скан
    setTimeout(() => {
      document.querySelectorAll('.card').forEach(enhanceCard);
    }, 500);
  }

  // Настройки плагина
  function addSettings() {
    Lampa.SettingsApi.addComponent({
      component: PLUGIN_NAME,
      name: 'Netflix Cards Style',
      icon: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>'
    });

    Lampa.SettingsApi.addParam({
      component: PLUGIN_NAME,
      param: { name: SETTINGS_PREFIX + 'enable', type: 'trigger', default: true },
      field: { name: 'Включить Netflix-стиль карточек' }
    });

    Lampa.SettingsApi.addParam({
      component: PLUGIN_NAME,
      param: { name: SETTINGS_PREFIX + 'show_season_text', type: 'trigger', default: true },
      field: { name: 'Крупный текст Sx • Эпизод' }
    });

    Lampa.SettingsApi.addParam({
      component: PLUGIN_NAME,
      param: { name: SETTINGS_PREFIX + 'show_progress_bar', type: 'trigger', default: true },
      field: { name: 'Прогресс-бар сезона' }
    });

    Lampa.SettingsApi.addParam({
      component: PLUGIN_NAME,
      param: { name: SETTINGS_PREFIX + 'show_quality', type: 'trigger', default: true },
      field: { name: 'Качество (JacRed)' }
    });
  }

  function start() {
    addSettings();
    startObserver();
    console.log('[Netflix Cards] Активен. Карточки должны стать красивыми через пару секунд');
  }

  if (window.netflix_cards_loaded) return;
  window.netflix_cards_loaded = true;

  if (window.appready) start();
  else Lampa.Listener.follow('app', e => { if (e.type === 'ready') start(); });

  Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
  Lampa.Manifest.plugins.netflix_cards = {
    name: 'Netflix Cards Style',
    version: '1.0',
    description: 'Карточки в стиле Netflix: крупный сезон, прогресс-бар, качество, градиент'
  };
})();
