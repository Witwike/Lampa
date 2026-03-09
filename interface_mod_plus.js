// Netflix Premium Cards 1.1 by LEX for FOIL (2026, all features from video)
(function () {
  'use strict';

  console.log('[Netflix Premium Cards 1.1] Активен — карточки как в премиум-стриминге');

  const PLUGIN_NAME = 'netflix_premium_cards';
  const PREFIX = 'npc_';

  // Настройки
  let config = {
    enabled: Lampa.Storage.get(PREFIX + 'enabled', true),
    big_season_text: Lampa.Storage.get(PREFIX + 'big_season_text', true),
    progress_bar: Lampa.Storage.get(PREFIX + 'progress_bar', true),
    quality_badge: Lampa.Storage.get(PREFIX + 'quality_badge', true),
    rating_badge: Lampa.Storage.get(PREFIX + 'rating_badge', true),
    year_badge: Lampa.Storage.get(PREFIX + 'year_badge', true),
    next_episode: Lampa.Storage.get(PREFIX + 'next_episode', true)
  };

  // CSS — всё как в видео
  function injectNetflixCSS() {
    if (document.getElementById('npc_css')) return;

    const css = document.createElement('style');
    css.id = 'npc_css';
    css.innerHTML = `
      .card__npc_view {
        position: relative !important;
        overflow: hidden;
        border-radius: 18px !important;
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
      }
      .card__npc_view:hover, .card__npc_view.focus, .card.focus .card__npc_view {
        transform: scale(1.09) translateY(-6px) !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
      }
      .npc_gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.95) 100%);
        pointer-events: none;
        z-index: 5;
      }
      .npc_season_big {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #ffffff;
        font-size: 3.2em;
        font-weight: 900;
        text-shadow: 4px 4px 16px rgba(0,0,0,0.9);
        letter-spacing: 3px;
        z-index: 10;
        pointer-events: none;
        text-align: center;
      }
      .npc_progress_container {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 8px;
        background: rgba(255,255,255,0.15);
        z-index: 15;
      }
      .npc_progress_fill {
        height: 100%;
        width: 0%;
        background: #e50914;
        transition: width 1.2s ease-out;
        box-shadow: 0 0 12px #e50914;
      }
      .npc_quality {
        position: absolute;
        top: 14px;
        right: 14px;
        background: rgba(30,30,30,0.85);
        color: #fff;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 1em;
        font-weight: bold;
        z-index: 12;
        backdrop-filter: blur(4px);
      }
      .npc_rating {
        position: absolute;
        top: 14px;
        left: 14px;
        background: rgba(30,30,30,0.85);
        color: #fff;
        padding: 5px 10px;
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: bold;
        z-index: 12;
        backdrop-filter: blur(4px);
      }
      .npc_year {
        position: absolute;
        bottom: 14px;
        right: 14px;
        background: rgba(30,30,30,0.85);
        color: #ddd;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.95em;
        z-index: 12;
        backdrop-filter: blur(4px);
      }
      .npc_next {
        position: absolute;
        bottom: 14px;
        left: 14px;
        color: #ff4d4d;
        font-size: 1em;
        font-weight: bold;
        text-shadow: 1px 1px 6px black;
        z-index: 12;
      }
    `;
    document.head.appendChild(css);
  }

  // Качество с JacRed (как в видео)
  function fetchQuality(title, year, cb) {
    const mirrors = ['jacred.bond', 'jacred.online', 'jred.top'];
    let i = 0;

    function attempt() {
      if (i >= mirrors.length) return cb(null);
      const u = `https://${mirrors[i++]}/api/v2/torrents?search=${encodeURIComponent(title)}&year=${year}`;
      fetch(u)
        .then(r => r.json())
        .then(arr => {
          if (!Array.isArray(arr) || arr.length === 0) return attempt();
          const best = arr.filter(t => t.quality > 0 && !/cam|ts|telesync/i.test(t.title||''))
                           .sort((a,b) => b.quality - a.quality)[0];
          if (best) {
            const q = best.quality >= 2160 ? '4K' : best.quality >= 1080 ? '1080p' : best.quality >= 720 ? '720p' : 'SD';
            cb(q);
          } else cb(null);
        })
        .catch(attempt);
    }
    attempt();
  }

  // Рендер одной карточки
  function applyNetflixStyle(card) {
    if (!config.enabled || card.classList.contains('npc-enhanced')) return;
    card.classList.add('npc-enhanced');

    const view = card.querySelector('.card__view');
    if (!view) return;

    // Градиент
    const grad = document.createElement('div');
    grad.className = 'npc_gradient';
    view.appendChild(grad);

    const data = card.card_data || {};
    const isTV = !!data.number_of_seasons || data.name || data.original_name;
    const title = data.title || data.name || '';
    const year = (data.release_date || data.first_air_date || '').slice(0, 4);
    const vote = parseFloat(data.vote_average);

    // Большой текст сезона
    if (config.big_season_text && isTV && data.last_episode_to_air) {
      const last = data.last_episode_to_air;
      const txt = `S${last.season_number} • Эпизод ${last.episode_number}`;
      const bigTxt = document.createElement('div');
      bigTxt.className = 'npc_season_big';
      bigTxt.textContent = txt;
      view.appendChild(bigTxt);
    }

    // Прогресс-бар
    if (config.progress_bar && isTV && data.number_of_episodes) {
      const total = data.number_of_episodes;
      const aired = data.last_episode_to_air?.episode_number || 0;
      const pct = total > 0 ? Math.min(100, (aired / total) * 100) : 0;

      const bar = document.createElement('div');
      bar.className = 'npc_progress_container';
      const fill = document.createElement('div');
      fill.className = 'npc_progress_fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      view.appendChild(bar);
    }

    // Качество
    if (config.quality_badge) {
      fetchQuality(title, year, q => {
        if (q) {
          const qual = document.createElement('div');
          qual.className = 'npc_quality';
          qual.textContent = q;
          view.appendChild(qual);
        }
      });
    }

    // Рейтинг с цветом
    if (config.rating_badge && !isNaN(vote)) {
      const r = document.createElement('div');
      r.className = 'npc_rating';
      r.textContent = vote.toFixed(1);
      r.style.background = vote >= 8 ? 'rgba(76,175,80,0.85)' : vote >= 6 ? 'rgba(33,150,243,0.85)' : vote >= 4 ? 'rgba(255,152,0,0.85)' : 'rgba(244,67,54,0.85)';
      view.appendChild(r);
    }

    // Год
    if (config.year_badge && year) {
      const y = document.createElement('div');
      y.className = 'npc_year';
      y.textContent = year;
      view.appendChild(y);
    }

    // Следующая серия
    if (config.next_episode && isTV && data.next_episode_to_air?.air_date) {
      const air = new Date(data.next_episode_to_air.air_date);
      const days = Math.ceil((air - Date.now()) / 86400000);
      const txt = days <= 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `+${days} дн.`;
      const next = document.createElement('div');
      next.className = 'npc_next';
      next.textContent = txt;
      view.appendChild(next);
    }
  }

  // Observer + первичный запуск
  function startNetflixCards() {
    injectNetflixCSS();

    const obs = new MutationObserver(() => {
      document.querySelectorAll('.card:not(.npc-enhanced)').forEach(applyNetflixStyle);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Запуск сразу
    setTimeout(() => {
      document.querySelectorAll('.card').forEach(applyNetflixStyle);
    }, 800);
  }

  // Настройки в меню
  function addPluginSettings() {
    Lampa.SettingsApi.addComponent({
      component: PLUGIN_NAME,
      name: 'Netflix Premium Cards',
      icon: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>'
    });

    const toggles = [
      { key: 'enabled', name: 'Включить стиль Netflix' },
      { key: 'big_season_text', name: 'Большой текст сезона' },
      { key: 'progress_bar', name: 'Прогресс-бар сезона' },
      { key: 'quality_badge', name: 'Бейдж качества' },
      { key: 'rating_badge', name: 'Цветной рейтинг' },
      { key: 'year_badge', name: 'Год выхода' },
      { key: 'next_episode', name: 'Дата следующей серии' }
    ];

    toggles.forEach(t => {
      Lampa.SettingsApi.addParam({
        component: PLUGIN_NAME,
        param: { name: PREFIX + t.key, type: 'trigger', default: true },
        field: { name: t.name }
      });
    });
  }

  function init() {
    addPluginSettings();
    startNetflixCards();
  }

  if (window.npc_loaded) return;
  window.npc_loaded = true;

  if (window.appready) init();
  else Lampa.Listener.follow('app', e => { if (e.type === 'ready') init(); });

  Lampa.Manifest.plugins.netflix_premium_cards = {
    name: 'Netflix Premium Cards',
    version: '1.1',
    description: 'Полный Netflix-стиль карточек как в видео: градиент, большой сезон, прогресс-бар, качество, рейтинг'
  };
})();
