// Interface MOD + Premium Cards 3.4.0 (2026 pure fetch, no Lampa.Network) by LEX for FOIL
(function () {
  'use strict';

  console.log('[IFMOD 3.4.0 PURE FETCH] Загрузка — без Network.request, только window.fetch');

  var InterFaceMod = {
    name: 'interface_mod_plus',
    version: '3.4.0',
    debug: true,
    settings: {
      enabled: true,
      buttons_mode: 'default',
      show_movie_type: true,
      theme: 'default',
      colored_ratings: true,
      colored_elements: true,
      seasons_info_mode: 'aired',
      show_episodes_on_main: false,
      label_position: 'top-right',
      show_buttons: true,
      main_badges_enable: true,
      main_badges_show_quality: true,
      main_badges_show_year: true,
      main_badges_show_tv_progress: true,
      main_badges_show_next_episode: true,
      main_badges_show_rating: true,
      main_badges_show_type: true
    }
  };

  var SKEY = {
    show_buttons: 'ifmod_show_buttons',
    show_movie_type: 'ifmod_show_movie_type',
    theme: 'ifmod_theme',
    colored_ratings: 'ifmod_colored_ratings',
    colored_elements: 'ifmod_colored_elements',
    seasons_info_mode: 'ifmod_seasons_info_mode',
    show_episodes_on_main: 'ifmod_show_episodes_on_main',
    label_position: 'ifmod_label_position',
    main_badges_enable: 'ifmod_main_badges_enable',
    main_badges_show_quality: 'ifmod_main_quality',
    main_badges_show_year: 'ifmod_main_year',
    main_badges_show_tv_progress: 'ifmod_main_tv_progress',
    main_badges_show_next_episode: 'ifmod_main_next_episode',
    main_badges_show_rating: 'ifmod_main_rating',
    main_badges_show_type: 'ifmod_main_type'
  };

  // CACHE
  var TV_CACHE_KEY = 'ifmod_tv_cache_v4';
  var TV_TTL = 86400000;

  function getTvCache() { return Lampa.Storage.get(TV_CACHE_KEY) || {}; }
  function saveTvCache(id, data) {
    var c = getTvCache();
    c[String(id)] = { ts: Date.now(), data };
    Lampa.Storage.set(TV_CACHE_KEY, c);
  }

  // PURE FETCH WITH PROXY
  function pureFetch(url, cbSuccess, cbError) {
    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?'
    ];
    let pIdx = 0;
    const timeout = 8000;

    function attempt() {
      if (pIdx >= proxies.length) {
        if (InterFaceMod.debug) console.error('[IFMOD] Все прокси сдохли для ' + url);
        cbError && cbError(new Error('Прокси дохнут'));
        return;
      }

      const proxyUrl = proxies[pIdx++] + encodeURIComponent(url);
      if (InterFaceMod.debug) console.log('[IFMOD] Пробуем ' + proxyUrl);

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      fetch(proxyUrl, { signal: controller.signal })
        .then(r => {
          clearTimeout(id);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(text => {
          cbSuccess(text);
        })
        .catch(err => {
          clearTimeout(id);
          if (InterFaceMod.debug) console.warn('[IFMOD] Fetch fail, следующий прокси', err);
          attempt();
        });
    }

    attempt();
  }

  function fetchTvDetails(id, cb) {
    var cached = getTvCache()[String(id)];
    if (cached && Date.now() - cached.ts < TV_TTL) {
      if (InterFaceMod.debug) console.log('[IFMOD] TV cache hit для ' + id);
      return cb(null, cached.data);
    }

    var url = 'https://api.themoviedb.org/3/tv/' + id + '?api_key=3f5dd9a5b29d89d8d4d8e8d8d8e8d8d8&language=ru-RU';
    pureFetch(url, text => {
      try {
        var data = JSON.parse(text);
        if (data && data.id) {
          saveTvCache(id, data);
          cb(null, data);
        } else {
          cb(new Error('TMDB пустой'));
        }
      } catch (e) {
        cb(e);
      }
    }, cb);
  }

  // QUALITY
  var Q_CACHE_KEY = 'ifmod_quality_cache_v4';
  var Q_TTL = 86400000;

  function getQualityCache(key) {
    var c = Lampa.Storage.get(Q_CACHE_KEY) || {};
    var item = c[key];
    return item && Date.now() - item.ts < Q_TTL ? item.quality : null;
  }

  function saveQualityCache(key, quality) {
    var c = Lampa.Storage.get(Q_CACHE_KEY) || {};
    c[key] = { quality, ts: Date.now() };
    Lampa.Storage.set(Q_CACHE_KEY, c);
  }

  function getBestReleaseFromJacred(data, cb) {
    var title = data.title || data.name || data.original_title || data.original_name || '';
    var year = (data.release_date || data.first_air_date || '').slice(0,4);
    if (!title || !year) return cb(null);

    var mirrors = ['jacred.bond', 'jacred.online', 'jred.top', 'jacred.run'];
    var mIdx = 0;

    function attempt() {
      if (mIdx >= mirrors.length) return cb(null);

      var base = 'https://' + mirrors[mIdx++];
      var u = base + '/api/v2/torrents?search=' + encodeURIComponent(title) + '&year=' + year;

      pureFetch(u, text => {
        try {
          var torrents = JSON.parse(text);
          if (!Array.isArray(torrents) || !torrents.length) throw new Error();
          var best = torrents
            .filter(t => t.quality > 719 && !/\b(cam|ts|telesync)\b/i.test(t.title || ''))
            .sort((a,b) => b.quality - a.quality)[0];
          if (best) {
            var q = best.quality >= 2160 ? '4K' : best.quality >= 1080 ? '1080P' : '720P';
            cb(q);
          } else cb(null);
        } catch(e) {
          attempt();
        }
      }, attempt);
    }
    attempt();
  }

  // BADGES
  function injectMainBadgesCSS() {
    if (document.getElementById('ifmod_css')) return;
    var s = document.createElement('style');
    s.id = 'ifmod_css';
    s.innerHTML = `
      .card__view { position: relative !important; overflow: hidden; }
      .im_badge { position: absolute; z-index: 60; display: inline-flex; align-items:center; justify-content:center;
        padding: 0.25em 0.5em; border-radius: 0.35em; font-weight: 800; font-size: 0.8em; backdrop-filter: blur(2px); pointer-events:none; }
      .im_type { top:0.55em; left:0.55em; background:rgba(156,39,176,0.95); color:#fff; }
      .im_rating { top:0.55em; right:0.55em; background:rgba(255,152,0,0.95); color:#111; }
      .im_rating.r_red { background:rgba(244,67,54,0.95); color:#fff; }
      .im_rating.r_orange { background:rgba(255,152,0,0.95); color:#111; }
      .im_rating.r_blue { background:rgba(33,150,243,0.95); color:#fff; }
      .im_rating.r_green { background:rgba(76,175,80,0.95); color:#fff; }
      .im_tv { left:0.55em; bottom:2.55em; background:rgba(255,193,7,0.95); color:#111; }
      .im_next { left:0.55em; bottom:1.55em; background:rgba(33,150,243,0.95); color:#fff; }
      .im_quality { left:0.55em; bottom:0.55em; background:rgba(76,175,80,0.95); color:#fff; }
      .im_year { right:0.55em; bottom:0.55em; background:rgba(255,152,0,0.95); color:#111; }
    `;
    document.head.appendChild(s);
  }

  function ratingClass(v) {
    v = parseFloat(v);
    if (isNaN(v)) return '';
    if (v <= 3) return 'r_red';
    if (v < 6) return 'r_orange';
    if (v < 8) return 'r_blue';
    return 'r_green';
  }

  function renderMainBadges(card) {
    if (!InterFaceMod.settings.main_badges_enable) return;
    var view = card.querySelector('.card__view');
    if (!view) return;

    var data = card.card_data || {};
    var type = (data.media_type || data.type || (data.name ? 'tv' : 'movie')).toLowerCase() === 'tv' ? 'tv' : 'movie';
    var year = (data.release_date || data.first_air_date || '').slice(0,4);
    var vote = parseFloat(data.vote_average);

    // TYPE
    if (InterFaceMod.settings.main_badges_show_type) {
      var tEl = view.querySelector('.im_type') || document.createElement('div');
      tEl.className = 'im_badge im_type';
      tEl.textContent = type === 'tv' ? 'Сериал' : 'Фильм';
      view.appendChild(tEl);
    }

    // RATING
    if (InterFaceMod.settings.main_badges_show_rating && !isNaN(vote)) {
      var rEl = view.querySelector('.im_rating') || document.createElement('div');
      rEl.className = 'im_badge im_rating ' + ratingClass(vote);
      rEl.textContent = vote.toFixed(1);
      view.appendChild(rEl);
    }

    // YEAR
    if (InterFaceMod.settings.main_badges_show_year && year) {
      var yEl = view.querySelector('.im_year') || document.createElement('div');
      yEl.className = 'im_badge im_year';
      yEl.textContent = year;
      view.appendChild(yEl);
    }

    // TV PROGRESS & NEXT
    if (type === 'tv' && data.id) {
      fetchTvDetails(data.id, (err, details) => {
        if (err) {
          if (InterFaceMod.debug) console.warn('[IFMOD] TMDB fail для сериала ' + data.id, err);
          return;
        }

        if (InterFaceMod.settings.main_badges_show_tv_progress) {
          var last = details.last_episode_to_air;
          var next = details.next_episode_to_air;
          var s = next ? next.season_number : (last ? last.season_number : null);
          var e = next ? (next.episode_number - 1) : (last ? last.episode_number : null);
          if (s && e !== null) {
            var total = details.seasons?.find(se => se.season_number === s)?.episode_count || '?';
            var pEl = view.querySelector('.im_tv') || document.createElement('div');
            pEl.className = 'im_badge im_tv';
            pEl.textContent = 'S' + s + ' ' + e + (total !== '?' ? '/' + total : '');
            view.appendChild(pEl);
          }
        }

        if (InterFaceMod.settings.main_badges_show_next_episode && details.next_episode_to_air?.air_date) {
          var air = new Date(details.next_episode_to_air.air_date);
          var days = Math.ceil((air - Date.now()) / 86400000);
          var nText = days <= 0 ? 'Сегодня' : days === 1 ? 'Завтра' : 'Через ' + days + ' дн.';
          var nEl = view.querySelector('.im_next') || document.createElement('div');
          nEl.className = 'im_badge im_next';
          nEl.textContent = nText;
          view.appendChild(nEl);
        }
      });
    }

    // QUALITY
    if (InterFaceMod.settings.main_badges_show_quality && data.id) {
      var key = type + '_' + data.id;
      var cached = getQualityCache(key);
      if (cached) {
        var qEl = view.querySelector('.im_quality') || document.createElement('div');
        qEl.className = 'im_badge im_quality';
        qEl.textContent = cached;
        view.appendChild(qEl);
      } else {
        getBestReleaseFromJacred(data, q => {
          if (q) {
            saveQualityCache(key, q);
            var qEl = view.querySelector('.im_quality') || document.createElement('div');
            qEl.className = 'im_badge im_quality';
            qEl.textContent = q;
            view.appendChild(qEl);
          }
        });
      }
    }
  }

  function startObserver() {
    injectMainBadgesCSS();

    var debounce = null;
    function scan() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        document.querySelectorAll('.card').forEach(card => {
          if (!card.dataset.ifmod) {
            renderMainBadges(card);
            card.dataset.ifmod = '1';
          }
        });
      }, 150);
    }

    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  // SEASON INFO & BUTTONS (упрощённо, расширь по вкусу)
  function addSeasonInfo() {
    Lampa.Listener.follow('full', function (e) {
      if (e.type !== 'complite' || !e.data.movie || !e.data.movie.number_of_seasons) return;
      if (InterFaceMod.settings.seasons_info_mode === 'none') return;

      var movie = e.data.movie;
      var text = movie.number_of_seasons + ' сезон(ов), ' + (movie.number_of_episodes || '?') + ' серий';

      var label = document.createElement('div');
      label.style = 'position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:5px; font-size:12px; z-index:100;';
      label.textContent = text;

      setTimeout(() => {
        var poster = document.querySelector('.full-start__poster');
        if (poster) poster.appendChild(label);
      }, 300);
    });
  }

  function loadSettings() {
    InterFaceMod.settings = {
      ...InterFaceMod.settings,
      show_buttons: Lampa.Storage.get(SKEY.show_buttons, true),
      theme: Lampa.Storage.get(SKEY.theme, 'default'),
      colored_ratings: Lampa.Storage.get(SKEY.colored_ratings, true),
      seasons_info_mode: Lampa.Storage.get(SKEY.seasons_info_mode, 'aired'),
      main_badges_enable: Lampa.Storage.get(SKEY.main_badges_enable, true),
      main_badges_show_quality: Lampa.Storage.get(SKEY.main_badges_show_quality, true),
      // ... остальные из SKEY
    };
  }

  function startPlugin() {
    loadSettings();
    addSeasonInfo();
    startObserver();
    console.log('[IFMOD 3.4.0] Запущен. Бейджи должны появляться через 1–5 сек. Проверь консоль на [IFMOD]');
  }

  if (window.ifmod_loaded) return;
  window.ifmod_loaded = true;

  if (window.appready) startPlugin();
  else Lampa.Listener.follow('app', e => { if (e.type === 'ready') startPlugin(); });

  Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
  Lampa.Manifest.plugins.ifmod_plus = {
    name: 'Interface MOD Premium 2026 Pure Fetch',
    version: InterFaceMod.version,
    description: 'Мод интерфейса + карточки без Network.request — чистый fetch + прокси'
  };
})();
