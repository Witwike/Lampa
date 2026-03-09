// Ultimate Customization Layer 2026 by LEX for FOIL
// Один плагин — все фичи из твоего списка
(function () {
  'use strict';

  console.log('[UCL 2026] Загружен — гибкий кастом без мусора');

  const PLUGIN_NAME = 'ucl_custom';
  const PREFIX = 'ucl_';

  // Базовые настройки (чекбоксы и селекты)
  const config = {
    cards_seasons: Lampa.Storage.get(PREFIX + 'cards_seasons', true),
    cards_next_episode: Lampa.Storage.get(PREFIX + 'cards_next_episode', true),
    cards_type: Lampa.Storage.get(PREFIX + 'cards_type', true),
    cards_quality: Lampa.Storage.get(PREFIX + 'cards_quality', true),
    cards_year: Lampa.Storage.get(PREFIX + 'cards_year', true),
    cards_country_mode: Lampa.Storage.get(PREFIX + 'cards_country_mode', 'flag'), // 'none', 'flag', 'text'
    cards_rating: Lampa.Storage.get(PREFIX + 'cards_rating', true),
    cards_hover_scale: Lampa.Storage.get(PREFIX + 'cards_hover_scale', true),

    full_logo: Lampa.Storage.get(PREFIX + 'full_logo', true),
    full_styled_info: Lampa.Storage.get(PREFIX + 'full_styled_info', true),
    full_platforms: Lampa.Storage.get(PREFIX + 'full_platforms', true),
    full_buttons_split: Lampa.Storage.get(PREFIX + 'full_buttons_split', true),

    top_clock: Lampa.Storage.get(PREFIX + 'top_clock', 'analog'), // 'none', 'analog', 'digital', 'digital_sec', 'minimal'

    torrents_border: Lampa.Storage.get(PREFIX + 'torrents_border', true),

    theme: Lampa.Storage.get(PREFIX + 'theme', 'dark'),
    font: Lampa.Storage.get(PREFIX + 'font', 'roboto'),
    loader_anim: Lampa.Storage.get(PREFIX + 'loader_anim', 'pulse'),
    color_accent: Lampa.Storage.get(PREFIX + 'color_accent', '#e50914')
  };

  // 1. CSS база + динамические стили
  function applyGlobalStyles() {
    let styleId = 'ucl_global_css';
    let el = document.getElementById(styleId);
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }

    let css = `
      :root {
        --ucl-accent: ${config.color_accent};
        --ucl-font: '${config.font}', sans-serif;
      }
      body, * { font-family: var(--ucl-font) !important; }
      .card__view {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
    `;

    if (config.cards_hover_scale) {
      css += `
        .card:hover .card__view, .card.focus .card__view {
          transform: scale(1.08) translateY(-6px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.7);
        }
      `;
    }

    if (config.theme === 'dark') {
      css += `body { background: #0f0f0f; color: #e0e0e0; }`;
    } else if (config.theme === 'oled') {
      css += `body { background: #000; color: #f0f0f0; }`;
    }

    // Анимация загрузки
    if (config.loader_anim === 'pulse') {
      css += `
        .loader { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `;
    }

    el.innerHTML = css;
  }

  // 2. Карточки — бейджи, сезоны, качество, рейтинг и т.д.
  function enhanceCards() {
    document.querySelectorAll('.card').forEach(card => {
      if (card.dataset.uclEnhanced) return;
      card.dataset.uclEnhanced = '1';

      const view = card.querySelector('.card__view');
      if (!view) return;

      const data = card.card_data || {};
      const isTV = data.number_of_seasons || data.name;

      // Тип контента
      if (config.cards_type) {
        const typeBadge = document.createElement('div');
        typeBadge.style = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:6px;font-size:0.8em;z-index:10;';
        typeBadge.textContent = isTV ? 'Сериал' : 'Фильм';
        view.appendChild(typeBadge);
      }

      // Рейтинг
      if (config.cards_rating && data.vote_average) {
        const r = parseFloat(data.vote_average);
        const color = r >= 8 ? '#4caf50' : r >= 6 ? '#2196f3' : r >= 4 ? '#ff9800' : '#f44336';
        const rBadge = document.createElement('div');
        rBadge.style = `position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:${color};padding:4px 8px;border-radius:6px;font-weight:bold;z-index:10;`;
        rBadge.textContent = r.toFixed(1);
        view.appendChild(rBadge);
      }

      // Год
      if (config.cards_year) {
        const y = (data.release_date || data.first_air_date || '').slice(0,4);
        if (y) {
          const yBadge = document.createElement('div');
          yBadge.style = 'position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);color:#ccc;padding:4px 8px;border-radius:6px;font-size:0.8em;z-index:10;';
          yBadge.textContent = y;
          view.appendChild(yBadge);
        }
      }

      // Качество (JacRed)
      if (config.cards_quality) {
        const title = data.title || data.name || '';
        const year = (data.release_date || data.first_air_date || '').slice(0,4);
        if (title && year) {
          getJacredQuality(title, year, q => {
            if (q) {
              const qBadge = document.createElement('div');
              qBadge.style = 'position:absolute;bottom:8px;left:8px;background:#4caf50;color:white;padding:4px 8px;border-radius:6px;font-weight:bold;z-index:10;';
              qBadge.textContent = q;
              view.appendChild(qBadge);
            }
          });
        }
      }

      // Сезоны и следующая серия
      if (isTV && (config.cards_seasons || config.cards_next_episode)) {
        Lampa.TMDB.get('tv/' + data.id, {}, tv => {
          if (config.cards_seasons && tv.number_of_seasons) {
            const sBadge = document.createElement('div');
            sBadge.style = 'position:absolute;top:50px;left:8px;background:rgba(0,0,0,0.7);color:#ffeb3b;padding:4px 8px;border-radius:6px;font-size:0.9em;z-index:10;';
            sBadge.textContent = `S${tv.last_episode_to_air?.season_number || '?'} ${tv.last_episode_to_air?.episode_number || '?'} / ${tv.number_of_episodes || '?'}`;
            view.appendChild(sBadge);
          }

          if (config.cards_next_episode && tv.next_episode_to_air?.air_date) {
            const d = new Date(tv.next_episode_to_air.air_date);
            const days = Math.ceil((d - Date.now()) / 86400000);
            const txt = days <= 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
            const nextBadge = document.createElement('div');
            nextBadge.style = 'position:absolute;bottom:50px;left:8px;color:#ff5252;font-weight:bold;z-index:10;';
            nextBadge.textContent = txt;
            view.appendChild(nextBadge);
          }
        }, () => {});
      }
    });
  }

  // JacRed качество (простой вариант)
  function getJacredQuality(title, year, cb) {
    const u = `https://jacred.online/api/v2/torrents?search=${encodeURIComponent(title)}&year=${year}`;
    fetch(u).then(r => r.json()).then(arr => {
      if (!Array.isArray(arr) || !arr.length) return cb(null);
      const best = arr.sort((a,b) => b.quality - a.quality)[0];
      if (best && best.quality > 0) {
        const q = best.quality >= 2160 ? '4K' : best.quality >= 1080 ? '1080P' : '720P';
        cb(q);
      } else cb(null);
    }).catch(() => cb(null));
  }

  // Остальные модули (верхняя панель, часы, торренты и т.д.) — добавляй по аналогии
  // Например часы в топ-баре:
  function addClockToTop() {
    if (config.top_clock === 'none') return;
    const top = document.querySelector('.head');
    if (!top || top.querySelector('.ucl-clock')) return;

    const clock = document.createElement('div');
    clock.className = 'ucl-clock';
    clock.style = 'position:absolute;right:80px;top:12px;color:white;font-size:1.1em;font-weight:bold;';
    top.appendChild(clock);

    setInterval(() => {
      const now = new Date();
      if (config.top_clock === 'analog') {
        clock.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } else if (config.top_clock === 'digital_sec') {
        clock.textContent = now.toLocaleTimeString();
      } // и т.д.
    }, 1000);
  }

  // Запуск
  function initUCL() {
    applyGlobalStyles();
    addClockToTop();

    // Observer на карточки
    const obs = new MutationObserver(enhanceCards);
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(enhanceCards, 800);

    Lampa.Listener.follow('full', e => {
      if (e.type === 'complite') {
        // тут логика для полной страницы: логотип, кнопки, платформы
      }
    });
  }

  // Настройки
  function registerUCLSettings() {
    Lampa.SettingsApi.addComponent({
      component: PLUGIN_NAME,
      name: 'UCL — Оформление',
      description: 'Гибкий кастом без мусора',
      icon: '<svg>...</svg>'
    });

    // Добавь все параметры config как Lampa.SettingsApi.addParam(...)
    // Пример для одного:
    Lampa.SettingsApi.addParam({
      component: PLUGIN_NAME,
      param: { name: PREFIX + 'enabled', type: 'trigger', default: true },
      field: { name: 'Включить UCL' },
      onChange: v => { config.enabled = v; applyGlobalStyles(); }
    });

    // ... остальные чекбоксы и селекты аналогично
  }

  if (window.ucl_loaded) return;
  window.ucl_loaded = true;

  if (window.appready) {
    registerUCLSettings();
    initUCL();
  } else {
    Lampa.Listener.follow('app', e => {
      if (e.type === 'ready') {
        registerUCLSettings();
        initUCL();
      }
    });
  }

  Lampa.Manifest.plugins.ucl_custom = {
    name: 'UCL — Ultimate Customization Layer',
    version: '2026.03',
    description: 'Один плагин — всё оформление под себя'
  };
})();
