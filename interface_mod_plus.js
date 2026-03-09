// Epic Cards 2026 (Netflix-style full from screenshots) by LEX for FOIL
(function () {
  'use strict';

  console.log('[Epic Cards 2026] Загружен — карточки как на твоём первом скрине');

  const PLUGIN = 'epic_cards';
  const PREFIX = 'epic_';

  let cfg = {
    enabled: Lampa.Storage.get(PREFIX + 'enabled', true),
    big_season: Lampa.Storage.get(PREFIX + 'big_season', true),
    progress_bar: Lampa.Storage.get(PREFIX + 'progress_bar', true),
    quality: Lampa.Storage.get(PREFIX + 'quality', true),
    rating: Lampa.Storage.get(PREFIX + 'rating', true),
    year: Lampa.Storage.get(PREFIX + 'year', true),
    next_episode: Lampa.Storage.get(PREFIX + 'next_episode', true),
    language: Lampa.Storage.get(PREFIX + 'language', true)
  };

  function injectEpicCSS() {
    if (document.getElementById('epic_css')) return;
    const s = document.createElement('style');
    s.id = 'epic_css';
    s.innerHTML = `
      .card__epic_view { position: relative; overflow: hidden; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); transition: all 0.4s ease; }
      .card__epic_view:hover, .card.focus .card__epic_view { transform: scale(1.08) translateY(-8px); box-shadow: 0 20px 60px rgba(0,0,0,0.8); }
      .epic_gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.95) 100%); z-index: 5; pointer-events: none; }
      .epic_season_big { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 3.5em; font-weight: 900; text-shadow: 4px 4px 20px black; letter-spacing: 2px; z-index: 10; pointer-events: none; }
      .epic_progress { position: absolute; bottom: 0; left: 0; right: 0; height: 8px; background: rgba(255,255,255,0.2); z-index: 15; }
      .epic_progress_fill { height: 100%; background: linear-gradient(to right, #e50914, #ff2d55); transition: width 1s ease-out; box-shadow: 0 0 15px #e50914; }
      .epic_badge { position: absolute; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 1em; backdrop-filter: blur(6px); z-index: 12; pointer-events: none; }
      .epic_quality { top: 12px; right: 12px; background: rgba(30,30,30,0.85); color: #fff; }
      .epic_rating { top: 12px; left: 12px; background: rgba(30,30,30,0.85); color: #fff; }
      .epic_year { bottom: 12px; right: 12px; background: rgba(30,30,30,0.85); color: #ccc; font-size: 0.9em; }
      .epic_next { bottom: 12px; left: 12px; color: #ff4d4d; font-weight: bold; text-shadow: 1px 1px 4px black; font-size: 1em; }
      .epic_type { top: 12px; left: 50%; transform: translateX(-50%); background: rgba(156,39,176,0.85); color: #fff; font-size: 0.9em; }
      .epic_lang { top: 60px; left: 12px; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.8em; padding: 3px 8px; }
    `;
    document.head.appendChild(s);
  }

  function getQuality(title, year, cb) {
    const mirrors = ['jacred.bond', 'jacred.online', 'jred.top'];
    let idx = 0;
    function tryM() {
      if (idx >= mirrors.length) return cb(null);
      const u = `https://${mirrors[idx++]}/api/v2/torrents?search=${encodeURIComponent(title)}&year=${year}`;
      fetch(u).then(r => r.json()).then(arr => {
        if (!Array.isArray(arr) || !arr.length) return tryM();
        const best = arr.filter(t => t.quality > 719 && !/cam|ts|telesync/i.test(t.title||''))
                         .sort((a,b)=>b.quality-a.quality)[0];
        if (best) cb(best.quality >= 2160 ? '4K' : best.quality >= 1080 ? '1080P' : '720P');
        else cb(null);
      }).catch(tryM);
    }
    tryM();
  }

  function enhanceCard(card) {
    if (!cfg.enabled || card.classList.contains('epic-enhanced')) return;
    card.classList.add('epic-enhanced');

    const view = card.querySelector('.card__view');
    if (!view) return;

    view.classList.add('card__epic_view');
    view.innerHTML += '<div class="epic_gradient"></div>';

    const data = card.card_data || {};
    const isTV = !!data.number_of_seasons || data.name;
    const title = data.title || data.name || '';
    const year = (data.release_date || data.first_air_date || '').slice(0,4);
    const vote = parseFloat(data.vote_average);

    // Большой сезон
    if (cfg.big_season && isTV && data.last_episode_to_air) {
      const last = data.last_episode_to_air;
      const txt = `S${last.season_number} ${data.last_episode_to_air.episode_number}/${data.number_of_episodes || '?'}`;
      const big = document.createElement('div');
      big.className = 'epic_season_big';
      big.textContent = txt;
      view.appendChild(big);
    }

    // Прогресс-бар
    if (cfg.progress_bar && isTV && data.number_of_episodes) {
      const total = data.number_of_episodes;
      const aired = data.last_episode_to_air?.episode_number || 0;
      const pct = total ? Math.min(100, (aired / total) * 100) : 0;
      const bar = document.createElement('div');
      bar.className = 'epic_progress';
      const fill = document.createElement('div');
      fill.className = 'epic_progress_fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      view.appendChild(bar);
    }

    // Качество
    if (cfg.quality) {
      getQuality(title, year, q => {
        if (q) {
          const qual = document.createElement('div');
          qual.className = 'epic_badge epic_quality';
          qual.textContent = q;
          view.appendChild(qual);
        }
      });
    }

    // Рейтинг
    if (cfg.rating && !isNaN(vote)) {
      const r = document.createElement('div');
      r.className = 'epic_badge epic_rating';
      r.textContent = vote.toFixed(1);
      r.style.background = vote >= 8 ? 'rgba(0,200,83,0.85)' : vote >= 6 ? 'rgba(33,150,243,0.85)' : 'rgba(244,67,54,0.85)';
      view.appendChild(r);
    }

    // Год
    if (cfg.year && year) {
      const y = document.createElement('div');
      y.className = 'epic_badge epic_year';
      y.textContent = year;
      view.appendChild(y);
    }

    // Следующая серия
    if (cfg.next_episode && isTV && data.next_episode_to_air?.air_date) {
      const d = new Date(data.next_episode_to_air.air_date);
      const days = Math.ceil((d - Date.now()) / 86400000);
      const txt = days <= 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
      const next = document.createElement('div');
      next.className = 'epic_next';
      next.textContent = txt;
      view.appendChild(next);
    }

    // Тип сериал
    if (isTV) {
      const type = document.createElement('div');
      type.className = 'epic_badge epic_type';
      type.textContent = 'Сериал';
      view.appendChild(type);
    }

    // Язык (если есть)
    if (cfg.language && data.original_language) {
      const lang = document.createElement('div');
      lang.className = 'epic_badge epic_lang';
      lang.textContent = data.original_language.toUpperCase();
      view.appendChild(lang);
    }
  }

  function startEpicObserver() {
    injectEpicCSS();
    const obs = new MutationObserver(() => {
      document.querySelectorAll('.card:not(.epic-enhanced)').forEach(enhanceCard);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => document.querySelectorAll('.card').forEach(enhanceCard), 600);
  }

  function addEpicSettings() {
    Lampa.SettingsApi.addComponent({
      component: PLUGIN,
      name: 'Epic Cards 2026',
      icon: '<svg>...</svg>' // вставь любой
    });

    ['enabled','big_season','progress_bar','quality','rating','year','next_episode','language'].forEach(k => {
      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PREFIX + k, type: 'trigger', default: true },
        field: { name: k.replace('_', ' ').toUpperCase() }
      });
    });
  }

  function start() {
    addEpicSettings();
    startEpicObserver();
  }

  if (window.epic_cards_loaded) return;
  window.epic_cards_loaded = true;

  if (window.appready) start();
  else Lampa.Listener.follow('app', e => { if (e.type === 'ready') start(); });

  Lampa.Manifest.plugins.epic_cards = {
    name: 'Epic Cards 2026',
    version: '1.0',
    description: 'Полный Netflix-стиль из твоего скрина: градиент, большой сезон, прогресс, бейджи'
  };
})();
