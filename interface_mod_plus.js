(function () {
  'use strict';

  /**
   * Интерфейс MOD + Главные карточки (Фильм/Сериал, рейтинг с цветом, сезон/серии, дата новой серии, качество, год)
   * Версия: 3.0.0
   */

  /* ==========================
   * ОСНОВНОЙ ОБЪЕКТ
   * ========================== */
  var InterFaceMod = {
    name: 'interface_mod',
    version: '3.0.0',
    debug: false,
    settings: {
      // interface_mod (как было)
      enabled: true,
      buttons_mode: 'default', // 'default', 'main_buttons', 'all_buttons'
      show_movie_type: true,
      theme: 'default',
      colored_ratings: true,
      seasons_info_mode: 'aired', // 'none', 'aired', 'total'
      show_episodes_on_main: false,
      label_position: 'top-right', // 'top-right','top-left','bottom-right','bottom-left'
      show_buttons: true,
      colored_elements: true,

      // NEW: главные карточки (как на скрине)
      main_badges_enable: true,
      main_badges_show_quality: true,
      main_badges_show_year: true,
      main_badges_show_tv_progress: true,
      main_badges_show_next_episode: true,
      main_badges_show_rating: true,
      main_badges_show_type: true
    }
  };

  /* ==========================
   * STORAGE KEYS
   * ========================== */
  var SKEY = {
    show_buttons: 'show_buttons',
    show_movie_type: 'season_info_show_movie_type',
    theme: 'theme_select',
    colored_ratings: 'colored_ratings',
    colored_elements: 'colored_elements',
    seasons_info_mode: 'seasons_info_mode',
    show_episodes_on_main: 'show_episodes_on_main',
    label_position: 'label_position',

    main_badges_enable: 'main_badges_enable',
    main_badges_show_quality: 'main_badges_show_quality',
    main_badges_show_year: 'main_badges_show_year',
    main_badges_show_tv_progress: 'main_badges_show_tv_progress',
    main_badges_show_next_episode: 'main_badges_show_next_episode',
    main_badges_show_rating: 'main_badges_show_rating',
    main_badges_show_type: 'main_badges_show_type'
  };

  /* ==========================
   * TMDB TV DETAILS CACHE
   * ========================== */
  var TV_CACHE_KEY = 'interface_mod_tv_cache_v1';
  var TV_CACHE_TTL = 24 * 60 * 60 * 1000;

  function getTvCache() {
    return Lampa.Storage.get(TV_CACHE_KEY) || {};
  }
  function setTvCache(cache) {
    Lampa.Storage.set(TV_CACHE_KEY, cache);
  }
  function getTvCached(id) {
    var c = getTvCache();
    var item = c[String(id)];
    if (!item) return null;
    if (Date.now() - item.ts > TV_CACHE_TTL) return null;
    return item.data || null;
  }
  function saveTvCached(id, data) {
    var c = getTvCache();
    c[String(id)] = { ts: Date.now(), data: data };
    setTvCache(c);
  }

  function fetchTvDetails(id, cb) {
    var cached = getTvCached(id);
    if (cached) return cb(null, cached);

    // 1) Lampa.TMDB.get
    try {
      if (Lampa.TMDB && typeof Lampa.TMDB.get === 'function') {
        return Lampa.TMDB.get(
          'tv/' + id,
          {},
          function (r) {
            if (r && r.id) {
              saveTvCached(id, r);
              cb(null, r);
            } else cb(new Error('empty tv details'));
          },
          function () {
            cb(new Error('tmdb error'));
          }
        );
      }
    } catch (e) {}

    // 2) Lampa.Api.tmdb
    try {
      if (Lampa.Api && typeof Lampa.Api.tmdb === 'function') {
        return Lampa.Api.tmdb(
          'tv/' + id,
          {},
          function (r) {
            if (r && r.id) {
              saveTvCached(id, r);
              cb(null, r);
            } else cb(new Error('empty tv details'));
          },
          function () {
            cb(new Error('tmdb error'));
          }
        );
      }
    } catch (e2) {}

    // Нет способа получить детали — вернем ошибку
    cb(new Error('no tmdb getter'));
  }

  /* ==========================
   * JACRED QUALITY (как у тебя)
   * ========================== */
  var Q_LOGGING = false;
  var Q_CACHE_TIME = 24 * 60 * 60 * 1000;
  var QUALITY_CACHE = 'interface_mod_quality_cache_v1';
  var JACRED_PROTOCOL = 'http://';
  var JACRED_URL = Lampa.Storage.get('jacred.xyz') || 'jacred.xyz';
  var PROXY_TIMEOUT = 5000;
  var PROXY_LIST = ['http://api.allorigins.win/raw?url=', 'http://cors.bwa.workers.dev/'];

  function getQualityCache(key) {
    var cache = Lampa.Storage.get(QUALITY_CACHE) || {};
    var item = cache[key];
    return item && Date.now() - item.timestamp < Q_CACHE_TIME ? item : null;
  }
  function saveQualityCache(key, data) {
    var cache = Lampa.Storage.get(QUALITY_CACHE) || {};
    cache[key] = { quality: data.quality || null, timestamp: Date.now() };
    Lampa.Storage.set(QUALITY_CACHE, cache);
  }

  function fetchWithProxy(url, cardId, callback) {
    var idx = 0;
    var done = false;

    function tryNext() {
      if (idx >= PROXY_LIST.length) {
        if (!done) {
          done = true;
          callback(new Error('All proxies failed'));
        }
        return;
      }

      var proxyUrl = PROXY_LIST[idx] + encodeURIComponent(url);
      if (Q_LOGGING) console.log('INTERFACE_MOD', 'card:', cardId, 'proxy:', proxyUrl);

      var timeoutId = setTimeout(function () {
        if (done) return;
        idx++;
        tryNext();
      }, PROXY_TIMEOUT);

      fetch(proxyUrl)
        .then(function (r) {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error('Proxy status ' + r.status);
          return r.text();
        })
        .then(function (txt) {
          if (done) return;
          done = true;
          callback(null, txt);
        })
        .catch(function () {
          clearTimeout(timeoutId);
          if (done) return;
          idx++;
          tryNext();
        });
    }

    tryNext();
  }

  function translateQuality(quality) {
    if (typeof quality !== 'number') return quality;
    if (quality >= 2160) return '4K';
    if (quality >= 1080) return '1080P';
    if (quality >= 720) return '720P';
    if (quality > 0) return 'SD';
    return null;
  }

  function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
    if (!JACRED_URL) return callback(null);

    var dateStr = normalizedCard.release_date || '';
    var year = dateStr && dateStr.length >= 4 ? dateStr.substring(0, 4) : '';
    if (!year || isNaN(year)) return callback(null);

    function searchJacredApi(searchTitle, searchYear, exactMatch, strategyName, apiCallback) {
      var userId = Lampa.Storage.get('lampac_unic_id', '');
      var apiUrl =
        JACRED_PROTOCOL +
        JACRED_URL +
        '/api/v1.0/torrents?search=' +
        encodeURIComponent(searchTitle) +
        '&year=' +
        searchYear +
        (exactMatch ? '&exact=true' : '') +
        '&uid=' +
        userId;

      var timeoutId = setTimeout(function () {
        apiCallback(null);
      }, PROXY_TIMEOUT * PROXY_LIST.length + 1000);

      fetchWithProxy(apiUrl, cardId, function (error, responseText) {
        clearTimeout(timeoutId);
        if (error || !responseText) return apiCallback(null);

        try {
          var torrents = JSON.parse(responseText);
          if (!Array.isArray(torrents) || torrents.length === 0) return apiCallback(null);

          var bestNumeric = -1;
          var bestTorrent = null;

          for (var i = 0; i < torrents.length; i++) {
            var t = torrents[i] || {};
            var q = t.quality;
            var lt = String(t.title || '').toLowerCase();

            if (/\b(ts|telesync|camrip|cam)\b/i.test(lt) && typeof q === 'number' && q < 720) continue;
            if (typeof q !== 'number' || q <= 0) continue;

            if (q > bestNumeric) {
              bestNumeric = q;
              bestTorrent = t;
            }
          }

          if (!bestTorrent) return apiCallback(null);

          apiCallback({
            quality: translateQuality(bestNumeric),
            title: bestTorrent.title || ''
          });
        } catch (e) {
          apiCallback(null);
        }
      });
    }

    var strategies = [];
    if (normalizedCard.original_title && /[a-zа-яё0-9]/i.test(normalizedCard.original_title)) {
      strategies.push({ title: normalizedCard.original_title.trim(), year: year, exact: true, name: 'OriginalTitle' });
    }
    if (normalizedCard.title && /[a-zа-яё0-9]/i.test(normalizedCard.title)) {
      strategies.push({ title: normalizedCard.title.trim(), year: year, exact: true, name: 'Title' });
    }

    (function run(ix) {
      if (ix >= strategies.length) return callback(null);
      var s = strategies[ix];
      searchJacredApi(s.title, s.year, s.exact, s.name, function (res) {
        if (res && res.quality) return callback(res);
        run(ix + 1);
      });
    })(0);
  }

  /* ==========================
   * CSS: главные карточки (как на твоих двух скринах)
   * ========================== */
  function injectMainBadgesCSS() {
    if (document.getElementById('interface_mod_main_badges_css')) return;

    var css =
      '<style id="interface_mod_main_badges_css">' +
      '.card__view{position:relative!important;}' +

      '.im_badge{position:absolute;z-index:60;display:inline-flex;align-items:center;justify-content:center;' +
      'padding:0.25em 0.50em;border-radius:0.35em;font-weight:800;line-height:1;white-space:nowrap;' +
      'font-size:0.80em;backdrop-filter: blur(2px);}' +

      /* TYPE (верх слева) */
      '.im_type{top:0.55em;left:0.55em;background:rgba(156,39,176,0.95);color:#fff;}' +

      /* RATING (верх справа) */
      '.im_rating{top:0.55em;right:0.55em;background:rgba(255,152,0,0.95);color:#111;}' +
      '.im_rating.r_red{background:rgba(244,67,54,0.95);color:#fff;}' +
      '.im_rating.r_orange{background:rgba(255,152,0,0.95);color:#111;}' +
      '.im_rating.r_blue{background:rgba(33,150,243,0.95);color:#fff;}' +
      '.im_rating.r_green{background:rgba(76,175,80,0.95);color:#fff;}' +

      /* TV прогресс (слева снизу выше всех) */
      '.im_tv{left:0.55em;bottom:2.55em;background:rgba(255,193,7,0.95);color:#111;}' +

      /* Next episode (слева снизу середина) */
      '.im_next{left:0.55em;bottom:1.55em;background:rgba(33,150,243,0.95);color:#fff;}' +

      /* Quality (слева снизу) */
      '.im_quality{left:0.55em;bottom:0.55em;background:rgba(76,175,80,0.95);color:#fff;}' +

      /* Year (справа снизу) */
      '.im_year{right:0.55em;bottom:0.55em;background:rgba(255,152,0,0.95);color:#111;}' +
      '</style>';

    $('head').append(css);
  }

  function ratingClass(v) {
    if (v === null) return '';
    if (v >= 0 && v <= 3) return 'r_red';
    if (v > 3 && v < 6) return 'r_orange';
    if (v >= 6 && v < 8) return 'r_blue';
    return 'r_green';
  }

  function safeNum(n) {
    var x = parseFloat(n);
    return isNaN(x) ? null : x;
  }

  function getCardTypeFromData(d) {
    var t = d.media_type || d.type || d.card_type;
    if (t === 'movie') return 'movie';
    if (t === 'tv' || t === 'serial') return 'tv';
    if (d.name || d.original_name) return 'tv';
    return 'movie';
  }

  function getYearFromData(d) {
    var dateStr = d.release_date || d.first_air_date || d.air_date || '';
    if (dateStr && dateStr.length >= 4) return dateStr.slice(0, 4);
    return '';
  }

  function ensureBadge(view, cls, text) {
    var el = view.querySelector('.' + cls.replace(/\s+/g, '.'));
    if (!el) {
      el = document.createElement('div');
      el.className = 'im_badge ' + cls;
      view.appendChild(el);
    }
    el.textContent = text;
    return el;
  }

  function removeBadge(view, cls) {
    var el = view.querySelector('.' + cls.replace(/\s+/g, '.'));
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function msUntil(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.getTime() - Date.now();
  }

  function nextTextFromAirDate(airDateStr) {
    var ms = msUntil(airDateStr);
    if (ms === null) return null;
    var days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return 'Через ' + days + ' дн.';
  }

  function buildTvProgress(details) {
    if (!details) return null;

    var last = details.last_episode_to_air;
    var next = details.next_episode_to_air;

    var season = last && last.season_number ? last.season_number : null;
    var ep = last && last.episode_number ? last.episode_number : null;

    // если есть next — значит вышло next-1 в текущем сезоне
    if (next && next.season_number && next.episode_number) {
      season = next.season_number;
      ep = Math.max(0, next.episode_number - 1);
    }

    if (!season || ep === null) return null;

    // total ep in this season
    var total = null;
    if (details.seasons && season !== null) {
      for (var i = 0; i < details.seasons.length; i++) {
        var s = details.seasons[i];
        if (s && s.season_number === season) {
          total = s.episode_count || null;
          break;
        }
      }
    }

    if (total) return 'S' + season + ' ' + ep + '/' + total;
    return 'S' + season + ' ' + ep;
  }

  function buildNextEpisode(details) {
    if (!details || !details.next_episode_to_air || !details.next_episode_to_air.air_date) return null;
    return nextTextFromAirDate(details.next_episode_to_air.air_date);
  }

  function applyQualityBadge(view, q) {
    if (!q) {
      removeBadge(view, 'im_quality');
      return;
    }
    ensureBadge(view, 'im_quality', q);
  }

  function renderMainBadges(cardEl) {
    if (!InterFaceMod.settings.main_badges_enable) return;
    if (!cardEl || !cardEl.querySelector) return;

    var view = cardEl.querySelector('.card__view');
    if (!view) return;

    var data = cardEl.card_data;
    if (!data) return;

    var type = getCardTypeFromData(data);
    var year = getYearFromData(data);
    var vote = safeNum(data.vote_average);
    var id = data.id;

    // TYPE
    if (InterFaceMod.settings.main_badges_show_type) {
      var tText = type === 'tv' ? 'Сериал' : 'Фильм';
      ensureBadge(view, 'im_type', tText);
    } else {
      removeBadge(view, 'im_type');
    }

    // RATING
    if (InterFaceMod.settings.main_badges_show_rating && vote !== null) {
      var r = ensureBadge(view, 'im_rating ' + ratingClass(vote), vote.toFixed(1));
      // фикс классов
      r.className = 'im_badge im_rating ' + ratingClass(vote);
    } else {
      removeBadge(view, 'im_rating');
    }

    // YEAR
    if (InterFaceMod.settings.main_badges_show_year && year) {
      ensureBadge(view, 'im_year', year);
    } else {
      removeBadge(view, 'im_year');
    }

    // TV прогресс + next
    if (type === 'tv' && (InterFaceMod.settings.main_badges_show_tv_progress || InterFaceMod.settings.main_badges_show_next_episode)) {
      fetchTvDetails(id, function (_err, details) {
        if (!document.body.contains(cardEl)) return;

        // TV progress
        if (InterFaceMod.settings.main_badges_show_tv_progress) {
          var p = buildTvProgress(details);
          if (p) ensureBadge(view, 'im_tv', p);
          else removeBadge(view, 'im_tv');
        } else {
          removeBadge(view, 'im_tv');
        }

        // Next episode
        if (InterFaceMod.settings.main_badges_show_next_episode) {
          var n = buildNextEpisode(details);
          if (n) ensureBadge(view, 'im_next', n);
          else removeBadge(view, 'im_next');
        } else {
          removeBadge(view, 'im_next');
        }

        // QUALITY (после того как отрисовали next)
        if (InterFaceMod.settings.main_badges_show_quality) {
          renderQualityForCard(cardEl, view, data, type);
        } else {
          removeBadge(view, 'im_quality');
        }
      });
    } else {
      // Не сериал — чистим tv элементы
      removeBadge(view, 'im_tv');
      removeBadge(view, 'im_next');

      // QUALITY
      if (InterFaceMod.settings.main_badges_show_quality) {
        renderQualityForCard(cardEl, view, data, type);
      } else {
        removeBadge(view, 'im_quality');
      }
    }
  }

  function renderQualityForCard(cardEl, view, data, type) {
    var normalized = {
      id: data.id || '',
      title: data.title || data.name || '',
      original_title: data.original_title || data.original_name || '',
      release_date: data.release_date || data.first_air_date || '',
      type: type
    };

    var cacheKey = type + '_' + normalized.id;
    var cached = getQualityCache(cacheKey);
    if (cached && cached.quality) {
      applyQualityBadge(view, cached.quality);
      return;
    }

    getBestReleaseFromJacred(normalized, String(normalized.id), function (jr) {
      if (!document.body.contains(cardEl)) return;
      var q = jr && jr.quality ? jr.quality : null;
      if (q) saveQualityCache(cacheKey, { quality: q });
      applyQualityBadge(view, q);
    });
  }

  function startMainBadgesObserver() {
    injectMainBadgesCSS();

    function scan() {
      var cards = document.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) renderMainBadges(cards[i]);
    }

    scan();

    var obs = new MutationObserver(function (mutations) {
      var list = [];
      for (var m = 0; m < mutations.length; m++) {
        var mu = mutations[m];
        if (!mu.addedNodes) continue;

        for (var j = 0; j < mu.addedNodes.length; j++) {
          var n = mu.addedNodes[j];
          if (!n || n.nodeType !== 1) continue;

          if (n.classList && n.classList.contains('card')) list.push(n);

          var nested = n.querySelectorAll ? n.querySelectorAll('.card') : [];
          for (var k = 0; k < nested.length; k++) list.push(nested[k]);
        }
      }

      if (list.length) {
        setTimeout(function () {
          for (var i = 0; i < list.length; i++) renderMainBadges(list[i]);
        }, 30);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ==========================
   * interface_mod: Инфа о сезонах/сериях в FULL карточке (как было)
   * ========================== */
  function addSeasonInfo() {
    Lampa.Listener.follow('full', function (data) {
      if (!(data && data.type === 'complite' && data.data && data.data.movie)) return;

      var movie = data.data.movie;
      if (!movie.number_of_seasons) return;
      if (InterFaceMod.settings.seasons_info_mode === 'none') return;

      var status = movie.status;
      var totalSeasons = movie.number_of_seasons || 0;
      var totalEpisodes = movie.number_of_episodes || 0;

      var airedSeasons = 0;
      var airedEpisodes = 0;
      var currentDate = new Date();

      if (movie.seasons && Array.isArray(movie.seasons)) {
        movie.seasons.forEach(function (season) {
          if (!season || season.season_number === 0) return;

          var seasonAired = false;

          if (season.air_date) {
            var airDate = new Date(season.air_date);
            if (airDate <= currentDate) {
              seasonAired = true;
              airedSeasons++;
            }
          }

          if (seasonAired && season.episode_count) {
            airedEpisodes += season.episode_count;
          }
        });
      } else if (movie.last_episode_to_air) {
        airedSeasons = movie.last_episode_to_air.season_number || 0;
        if (movie.last_episode_to_air.episode_number) {
          // грубо: считаем вышедшие эпизоды по last_episode_to_air
          airedEpisodes = 0;
          if (movie.seasons && Array.isArray(movie.seasons)) {
            movie.seasons.forEach(function (s) {
              if (!s || s.season_number === 0) return;
              if (s.season_number < airedSeasons) airedEpisodes += s.episode_count || 0;
              if (s.season_number === airedSeasons) airedEpisodes += movie.last_episode_to_air.episode_number || 0;
            });
          } else {
            airedEpisodes = movie.last_episode_to_air.episode_number || 0;
          }
        }
      }

      if (airedSeasons === 0) airedSeasons = totalSeasons;
      if (airedEpisodes === 0) airedEpisodes = totalEpisodes;

      if (totalEpisodes > 0 && airedEpisodes > totalEpisodes) airedEpisodes = totalEpisodes;

      function plural(number, one, two, five) {
        var n = Math.abs(number);
        n %= 100;
        if (n >= 5 && n <= 20) return five;
        n %= 10;
        if (n === 1) return one;
        if (n >= 2 && n <= 4) return two;
        return five;
      }

      function getStatusText(st) {
        if (st === 'Ended') return 'Завершён';
        if (st === 'Canceled') return 'Отменён';
        if (st === 'Returning Series') return 'Выходит';
        if (st === 'In Production') return 'В производстве';
        return st || 'Неизвестно';
      }

      var isCompleted = status === 'Ended' || status === 'Canceled';
      var bgColor = isCompleted ? 'rgba(33,150,243,0.8)' : 'rgba(244,67,54,0.8)';

      var displaySeasons, displayEpisodes, seasonsText, episodesText;

      if (InterFaceMod.settings.seasons_info_mode === 'aired') {
        displaySeasons = airedSeasons;
        displayEpisodes = airedEpisodes;
      } else {
        displaySeasons = totalSeasons;
        displayEpisodes = totalEpisodes;
      }

      seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
      episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');

      var infoElement = $('<div class="season-info-label"></div>');

      if (isCompleted) {
        var line1 = $('<div></div>').text(displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText);
        var line2 = $('<div></div>').text(getStatusText(status));
        infoElement.append(line1).append(line2);
      } else {
        var text = '';
        if (InterFaceMod.settings.seasons_info_mode === 'aired') {
          if (totalEpisodes > 0 && airedEpisodes < totalEpisodes && airedEpisodes > 0) {
            text = displaySeasons + ' ' + seasonsText + ' ' + airedEpisodes + ' ' + episodesText + ' из ' + totalEpisodes;
          } else {
            text = displaySeasons + ' ' + seasonsText + ' ' + airedEpisodes + ' ' + episodesText;
          }
        } else {
          text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
        }
        infoElement.append($('<div></div>').text(text));
      }

      var positionStyles = {
        'top-right': { position: 'absolute', top: '1.4em', right: '-0.8em', left: 'auto', bottom: 'auto' },
        'top-left': { position: 'absolute', top: '1.4em', left: '-0.8em', right: 'auto', bottom: 'auto' },
        'bottom-right': { position: 'absolute', bottom: '1.4em', right: '-0.8em', top: 'auto', left: 'auto' },
        'bottom-left': { position: 'absolute', bottom: '1.4em', left: '-0.8em', top: 'auto', right: 'auto' }
      };

      var position = InterFaceMod.settings.label_position || 'top-right';
      var positionStyle = positionStyles[position] || positionStyles['top-right'];

      var commonStyles = {
        'background-color': bgColor,
        color: 'white',
        padding: '0.4em 0.6em',
        'border-radius': '0.3em',
        'font-size': '0.8em',
        'z-index': '999',
        'text-align': 'center',
        'white-space': 'nowrap',
        'line-height': '1.2em',
        'backdrop-filter': 'blur(2px)',
        'box-shadow': '0 2px 5px rgba(0,0,0,0.2)'
      };

      infoElement.css($.extend({}, commonStyles, positionStyle));

      setTimeout(function () {
        var poster = $(data.object.activity.render()).find('.full-start-new__poster, .full-start__poster').first();
        if (poster.length) {
          poster.css('position', 'relative');
          // убираем старый, если был
          poster.find('.season-info-label').remove();
          poster.append(infoElement);
        }
      }, 100);
    });
  }

  /* ==========================
   * interface_mod: Показ всех кнопок (как было, но стабильно)
   * ========================== */
  function showAllButtons() {
    if (document.getElementById('interface_mod_buttons_style')) return;

    var st = document.createElement('style');
    st.id = 'interface_mod_buttons_style';
    st.innerHTML =
      '.full-start-new__buttons, .full-start__buttons{display:flex!important;flex-wrap:wrap!important;gap:10px!important;}';
    document.head.appendChild(st);

    function organize(container) {
      if (!container || !container.length) return;

      container.css({ display: 'flex', flexWrap: 'wrap', gap: '10px' });

      var btns = [];
      container.find('> *').each(function () {
        btns.push(this);
      });
      if (!btns.length) return;

      var categories = { online: [], torrent: [], trailer: [], other: [] };
      var used = {};

      $(btns).each(function () {
        var b = this;
        var txt = $(b).text().trim();
        if (!txt) return;
        if (used[txt]) return;
        used[txt] = true;

        var cls = b.className || '';
        if (cls.indexOf('online') >= 0) categories.online.push(b);
        else if (cls.indexOf('torrent') >= 0) categories.torrent.push(b);
        else if (cls.indexOf('trailer') >= 0) categories.trailer.push(b);
        else categories.other.push(b);
      });

      container.empty();
      ['online', 'torrent', 'trailer', 'other'].forEach(function (k) {
        categories[k].forEach(function (b) {
          container.append(b);
        });
      });
    }

    Lampa.Listener.follow('full', function (e) {
      if (e.type !== 'complite') return;
      if (!InterFaceMod.settings.show_buttons) return;

      setTimeout(function () {
        var root = e.object.activity.render();
        var c = root.find('.full-start-new__buttons');
        if (!c.length) c = root.find('.full-start__buttons');
        if (!c.length) c = root.find('.buttons-container');
        if (!c.length) return;
        organize(c);
      }, 250);
    });

    var obs = new MutationObserver(function (mutations) {
      if (!InterFaceMod.settings.show_buttons) return;

      var need = false;
      mutations.forEach(function (mu) {
        if (mu.type !== 'childList') return;
        var t = mu.target;
        if (!t || !t.classList) return;
        if (
          t.classList.contains('full-start-new__buttons') ||
          t.classList.contains('full-start__buttons') ||
          t.classList.contains('buttons-container')
        ) {
          need = true;
        }
      });

      if (need) {
        setTimeout(function () {
          var active = Lampa.Activity.active && Lampa.Activity.active();
          if (!active || !active.activity) return;
          var el = active.activity.render && active.activity.render();
          if (!el) return;

          var c = el.find('.full-start-new__buttons');
          if (!c.length) c = el.find('.full-start__buttons');
          if (!c.length) c = el.find('.buttons-container');
          if (!c.length) return;
          organize(c);
        }, 120);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ==========================
   * interface_mod: Темы (как было, но аккуратно)
   * ========================== */
  function applyTheme(theme) {
    $('#interface_mod_theme').remove();
    if (!theme || theme === 'default') return;

    var style = $('<style id="interface_mod_theme"></style>');

    var themes = {
      neon:
        'body{background:linear-gradient(135deg,#0d0221 0%,#150734 50%,#1f0c47 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#ff00ff,#00ffff);color:#fff;box-shadow:0 0 20px rgba(255,0,255,.4);border:none;}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #ff00ff;box-shadow:0 0 20px #00ffff;}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#ff00ff,#00ffff);box-shadow:0 0 15px rgba(255,0,255,.3);}' +
        '.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(15,2,33,.95);border:1px solid rgba(255,0,255,.1);}',

      dark_night:
        'body{background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 50%,#0f0f0f 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#8a2387,#e94057,#f27121);color:#fff;box-shadow:0 0 30px rgba(233,64,87,.3);}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #e94057;box-shadow:0 0 30px rgba(242,113,33,.5);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#8a2387,#f27121);}' +
        '.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(10,10,10,.95);border:1px solid rgba(233,64,87,.1);}',

      blue_cosmos:
        'body{background:linear-gradient(135deg,#0b365c 0%,#144d80 50%,#0c2a4d 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#12c2e9,#c471ed,#f64f59);color:#fff;box-shadow:0 0 30px rgba(18,194,233,.3);}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #12c2e9;box-shadow:0 0 30px rgba(196,113,237,.5);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#12c2e9,#f64f59);}' +
        '.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(11,54,92,.95);border:1px solid rgba(18,194,233,.1);}',

      sunset:
        'body{background:linear-gradient(135deg,#2d1f3d 0%,#614385 50%,#516395 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#ff6e7f,#bfe9ff);color:#2d1f3d;box-shadow:0 0 15px rgba(255,110,127,.3);font-weight:700;}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #ff6e7f;box-shadow:0 0 15px rgba(255,110,127,.5);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#ff6e7f,#bfe9ff);color:#2d1f3d;}',

      emerald:
        'body{background:linear-gradient(135deg,#1a2a3a 0%,#2C5364 50%,#203A43 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#43cea2,#185a9d);color:#fff;box-shadow:0 4px 15px rgba(67,206,162,.3);}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:3px solid #43cea2;box-shadow:0 0 20px rgba(67,206,162,.4);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#43cea2,#185a9d);}' +
        '.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(26,42,58,.98);border:1px solid rgba(67,206,162,.1);}',

      aurora:
        'body{background:linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#aa4b6b,#6b6b83,#3b8d99);color:#fff;box-shadow:0 0 20px rgba(170,75,107,.3);}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #aa4b6b;box-shadow:0 0 25px rgba(170,75,107,.5);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#aa4b6b,#3b8d99);}',

      bywolf_mod:
        'body{background:linear-gradient(135deg,#090227 0%,#170b34 50%,#261447 100%);color:#fff;}' +
        '.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#fc00ff,#00dbde);color:#fff;box-shadow:0 0 30px rgba(252,0,255,.3);}' +
        '.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #fc00ff;box-shadow:0 0 30px rgba(0,219,222,.5);}' +
        '.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#fc00ff,#00dbde);}' +
        '.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(9,2,39,.95);border:1px solid rgba(252,0,255,.1);}'
    };

    style.html(themes[theme] || '');
    $('head').append(style);
  }

  /* ==========================
   * interface_mod: Цветной рейтинг (как было)
   * ========================== */
  function updateVoteColors() {
    if (!InterFaceMod.settings.colored_ratings) return;

    function applyColorByRating(element) {
      var voteText = $(element).text().trim();
      var match = voteText.match(/(\d+(\.\d+)?)/);
      if (!match) return;
      var vote = parseFloat(match[0]);
      if (vote >= 0 && vote <= 3) $(element).css('color', 'red');
      else if (vote > 3 && vote < 6) $(element).css('color', 'orange');
      else if (vote >= 6 && vote < 8) $(element).css('color', 'cornflowerblue');
      else if (vote >= 8 && vote <= 10) $(element).css('color', 'lawngreen');
    }

    $('.card__vote').each(function () {
      applyColorByRating(this);
    });
    $('.full-start__rate, .full-start-new__rate').each(function () {
      applyColorByRating(this);
    });
    $('.info__rate, .card__imdb-rate, .card__kinopoisk-rate').each(function () {
      applyColorByRating(this);
    });
  }

  function setupVoteColorsObserver() {
    if (!InterFaceMod.settings.colored_ratings) return;
    setTimeout(updateVoteColors, 500);

    var observer = new MutationObserver(function () {
      setTimeout(updateVoteColors, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupVoteColorsForDetailPage() {
    if (!InterFaceMod.settings.colored_ratings) return;
    Lampa.Listener.follow('full', function (data) {
      if (data.type === 'complite') setTimeout(updateVoteColors, 100);
    });
  }

  /* ==========================
   * interface_mod: Цвет статуса + возраст
   * ========================== */
  function colorizeSeriesStatus() {
    if (!InterFaceMod.settings.colored_elements) return;

    function applyStatusColor(el) {
      var statusText = $(el).text().trim();

      var bg = '';
      var tc = '';

      if (statusText.indexOf('Заверш') >= 0 || statusText.indexOf('Ended') >= 0) {
        bg = 'rgba(46,204,113,0.8)';
        tc = 'white';
      } else if (statusText.indexOf('Отмен') >= 0 || statusText.indexOf('Canceled') >= 0) {
        bg = 'rgba(231,76,60,0.8)';
        tc = 'white';
      } else if (
        statusText.indexOf('Онгоинг') >= 0 ||
        statusText.indexOf('Выход') >= 0 ||
        statusText.indexOf('В процессе') >= 0 ||
        statusText.indexOf('Return') >= 0
      ) {
        bg = 'rgba(243,156,18,0.8)';
        tc = 'black';
      } else if (statusText.indexOf('производстве') >= 0 || statusText.indexOf('Production') >= 0) {
        bg = 'rgba(52,152,219,0.8)';
        tc = 'white';
      } else if (statusText.indexOf('Заплан') >= 0 || statusText.indexOf('Planned') >= 0) {
        bg = 'rgba(155,89,182,0.8)';
        tc = 'white';
      }

      if (bg) {
        $(el).css({
          'background-color': bg,
          color: tc,
          'border-radius': '0.3em',
          border: '0px',
          'font-size': '1.3em',
          display: 'inline-block'
        });
      }
    }

    $('.full-start__status').each(function () {
      applyStatusColor(this);
    });

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (mu) {
        if (!mu.addedNodes) return;
        for (var i = 0; i < mu.addedNodes.length; i++) {
          var node = mu.addedNodes[i];
          if (!node || node.nodeType !== 1) continue;
          $(node).find('.full-start__status').each(function () {
            applyStatusColor(this);
          });
          if ($(node).hasClass('full-start__status')) applyStatusColor(node);
        }
      });
    });

    obs.observe(document.body, { childList: true, subtree: true });

    Lampa.Listener.follow('full', function (data) {
      if (data.type === 'complite' && data.data.movie) {
        setTimeout(function () {
          $(data.object.activity.render())
            .find('.full-start__status')
            .each(function () {
              applyStatusColor(this);
            });
        }, 100);
      }
    });
  }

  function colorizeAgeRating() {
    if (!InterFaceMod.settings.colored_elements) return;

    function applyAgeRatingColor(el) {
      var t = $(el).text().trim();

      var groups = {
        kids: ['G', 'TV-Y', 'TV-G', '0+', '3+', '0', '3'],
        children: ['PG', 'TV-PG', 'TV-Y7', '6+', '7+', '6', '7'],
        teens: ['PG-13', 'TV-14', '12+', '13+', '14+', '12', '13', '14'],
        almostAdult: ['R', 'TV-MA', '16+', '17+', '16', '17'],
        adult: ['NC-17', '18+', '18', 'X']
      };

      var colors = {
        kids: { bg: '#2ecc71', text: 'white' },
        children: { bg: '#3498db', text: 'white' },
        teens: { bg: '#f1c40f', text: 'black' },
        almostAdult: { bg: '#e67e22', text: 'white' },
        adult: { bg: '#e74c3c', text: 'white' }
      };

      var group = null;
      Object.keys(groups).some(function (k) {
        if (groups[k].indexOf(t) >= 0) {
          group = k;
          return true;
        }
        for (var i = 0; i < groups[k].length; i++) {
          if (t.indexOf(groups[k][i]) >= 0) {
            group = k;
            return true;
          }
        }
        return false;
      });

      if (group) {
        $(el).css({
          'background-color': colors[group].bg,
          color: colors[group].text,
          'border-radius': '0.3em',
          'font-size': '1.3em',
          border: '0px'
        });
      }
    }

    $('.full-start__pg').each(function () {
      applyAgeRatingColor(this);
    });

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (mu) {
        if (!mu.addedNodes) return;
        for (var i = 0; i < mu.addedNodes.length; i++) {
          var node = mu.addedNodes[i];
          if (!node || node.nodeType !== 1) continue;
          $(node).find('.full-start__pg').each(function () {
            applyAgeRatingColor(this);
          });
          if ($(node).hasClass('full-start__pg')) applyAgeRatingColor(node);
        }
      });
    });

    obs.observe(document.body, { childList: true, subtree: true });

    Lampa.Listener.follow('full', function (data) {
      if (data.type === 'complite' && data.data.movie) {
        setTimeout(function () {
          $(data.object.activity.render())
            .find('.full-start__pg')
            .each(function () {
              applyAgeRatingColor(this);
            });
        }, 100);
      }
    });
  }

  /* ==========================
   * Settings UI
   * ========================== */
  function registerSettings() {
    Lampa.SettingsApi.addComponent({
      component: 'season_info',
      name: 'Интерфейс мод',
      icon:
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>' +
        '<path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>' +
        '<path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.44772 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/>' +
        '</svg>'
    });

    // Информация о сериях (FULL)
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: {
        name: SKEY.seasons_info_mode,
        type: 'select',
        values: { none: 'Выключить', aired: 'Актуальная информация', total: 'Полное количество' },
        default: 'aired'
      },
      field: { name: 'Информация о сериях (в карточке)', description: 'Лейбл на постере в полной карточке' },
      onChange: function (v) {
        InterFaceMod.settings.seasons_info_mode = v;
        InterFaceMod.settings.enabled = v !== 'none';
        Lampa.Settings.update();
      }
    });

    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: {
        name: SKEY.label_position,
        type: 'select',
        values: {
          'top-right': 'Верхний правый угол',
          'top-left': 'Верхний левый угол',
          'bottom-right': 'Нижний правый угол',
          'bottom-left': 'Нижний левый угол'
        },
        default: 'top-right'
      },
      field: { name: 'Расположение лейбла серий', description: 'Позиция в полной карточке' },
      onChange: function (v) {
        InterFaceMod.settings.label_position = v;
        Lampa.Settings.update();
        Lampa.Noty.show('Открой карточку сериала заново для обновления');
      }
    });

    // Кнопки
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.show_buttons, type: 'trigger', default: true },
      field: { name: 'Показывать все кнопки', description: 'Собирает все кнопки действий в карточке' },
      onChange: function (v) {
        InterFaceMod.settings.show_buttons = v;
        Lampa.Settings.update();
      }
    });

    // Тип контента (legacy)
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.show_movie_type, type: 'trigger', default: true },
      field: { name: 'Лейблы типа (включая главные карточки)', description: 'Фильм/Сериал' },
      onChange: function (v) {
        InterFaceMod.settings.show_movie_type = v;
        InterFaceMod.settings.main_badges_show_type = v; // синхронно
        Lampa.Settings.update();
      }
    });

    // Темы
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: {
        name: SKEY.theme,
        type: 'select',
        values: {
          default: 'Нет',
          bywolf_mod: 'Bywolf_mod',
          dark_night: 'Dark Night',
          blue_cosmos: 'Blue Cosmos',
          neon: 'Neon',
          sunset: 'Dark MOD',
          emerald: 'Emerald V1',
          aurora: 'Aurora'
        },
        default: 'default'
      },
      field: { name: 'Тема интерфейса', description: 'Оформление' },
      onChange: function (v) {
        InterFaceMod.settings.theme = v;
        Lampa.Settings.update();
        applyTheme(v);
      }
    });

    // Цветные рейтинги
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.colored_ratings, type: 'trigger', default: true },
      field: { name: 'Цветные рейтинги', description: 'Меняет цвет рейтинга по шкале' },
      onChange: function (v) {
        InterFaceMod.settings.colored_ratings = v;
        Lampa.Settings.update();
        if (v) {
          setupVoteColorsObserver();
          setupVoteColorsForDetailPage();
        } else {
          $('.card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate').css(
            'color',
            ''
          );
        }
      }
    });

    // Цветные элементы (статус/возраст)
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.colored_elements, type: 'trigger', default: true },
      field: { name: 'Цветные элементы', description: 'Статусы сериалов и возрастные ограничения' },
      onChange: function (v) {
        InterFaceMod.settings.colored_elements = v;
        Lampa.Settings.update();
        if (v) {
          colorizeSeriesStatus();
          colorizeAgeRating();
        } else {
          $('.full-start__status').css({ 'background-color': '', color: '', 'border-radius': '', 'font-size': '', display: '' });
          $('.full-start__pg').css({ 'background-color': '', color: '', 'font-size': '' });
        }
      }
    });

    // NEW: Главные карточки — общий переключатель
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_enable, type: 'trigger', default: true },
      field: { name: 'Главные карточки: включить', description: 'Плашки на постерах в списках/главной' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_enable = v;
        Lampa.Settings.update();
      }
    });

    // NEW: Качество
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_show_quality, type: 'trigger', default: true },
      field: { name: 'Главные карточки: качество', description: '4K/1080P/720P/SD (JacRed)' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_show_quality = v;
        Lampa.Settings.update();
      }
    });

    // NEW: Год
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_show_year, type: 'trigger', default: true },
      field: { name: 'Главные карточки: год', description: 'Год выхода справа снизу' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_show_year = v;
        Lampa.Settings.update();
      }
    });

    // NEW: ТВ прогресс
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_show_tv_progress, type: 'trigger', default: true },
      field: { name: 'Главные карточки: Sx a/b', description: 'Сезон и вышедшие серии' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_show_tv_progress = v;
        Lampa.Settings.update();
      }
    });

    // NEW: Следующая серия
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_show_next_episode, type: 'trigger', default: true },
      field: { name: 'Главные карточки: новая серия', description: 'Сегодня/Завтра/Через N дн.' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_show_next_episode = v;
        Lampa.Settings.update();
      }
    });

    // NEW: Рейтинг
    Lampa.SettingsApi.addParam({
      component: 'season_info',
      param: { name: SKEY.main_badges_show_rating, type: 'trigger', default: true },
      field: { name: 'Главные карточки: рейтинг', description: 'С цветом по шкале' },
      onChange: function (v) {
        InterFaceMod.settings.main_badges_show_rating = v;
        Lampa.Settings.update();
      }
    });

    // Перемещение раздела после "Интерфейс"
    Lampa.Settings.listener.follow('open', function () {
      setTimeout(function () {
        var mod = $('.settings-folder[data-component="season_info"]');
        var std = $('.settings-folder[data-component="interface"]');
        if (mod.length && std.length) mod.insertAfter(std);
      }, 100);
    });
  }

  /* ==========================
   * LOAD SETTINGS
   * ========================== */
  function loadSettings() {
    InterFaceMod.settings.show_buttons = Lampa.Storage.get(SKEY.show_buttons, true);
    InterFaceMod.settings.show_movie_type = Lampa.Storage.get(SKEY.show_movie_type, true);
    InterFaceMod.settings.theme = Lampa.Storage.get(SKEY.theme, 'default');
    InterFaceMod.settings.colored_ratings = Lampa.Storage.get(SKEY.colored_ratings, true);
    InterFaceMod.settings.colored_elements = Lampa.Storage.get(SKEY.colored_elements, true);
    InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get(SKEY.seasons_info_mode, 'aired');
    InterFaceMod.settings.show_episodes_on_main = Lampa.Storage.get(SKEY.show_episodes_on_main, false);
    InterFaceMod.settings.label_position = Lampa.Storage.get(SKEY.label_position, 'top-right');

    InterFaceMod.settings.main_badges_enable = Lampa.Storage.get(SKEY.main_badges_enable, true);
    InterFaceMod.settings.main_badges_show_quality = Lampa.Storage.get(SKEY.main_badges_show_quality, true);
    InterFaceMod.settings.main_badges_show_year = Lampa.Storage.get(SKEY.main_badges_show_year, true);
    InterFaceMod.settings.main_badges_show_tv_progress = Lampa.Storage.get(SKEY.main_badges_show_tv_progress, true);
    InterFaceMod.settings.main_badges_show_next_episode = Lampa.Storage.get(SKEY.main_badges_show_next_episode, true);
    InterFaceMod.settings.main_badges_show_rating = Lampa.Storage.get(SKEY.main_badges_show_rating, true);
    InterFaceMod.settings.main_badges_show_type = Lampa.Storage.get(SKEY.main_badges_show_type, true);

    // синхрон для типа
    InterFaceMod.settings.main_badges_show_type = !!InterFaceMod.settings.show_movie_type;

    InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';
  }

  /* ==========================
   * START PLUGIN
   * ========================== */
  function startPlugin() {
    loadSettings();
    registerSettings();

    applyTheme(InterFaceMod.settings.theme);

    if (InterFaceMod.settings.enabled) addSeasonInfo();

    showAllButtons();

    if (InterFaceMod.settings.colored_ratings) {
      setupVoteColorsObserver();
      setupVoteColorsForDetailPage();
    }

    if (InterFaceMod.settings.colored_elements) {
      colorizeSeriesStatus();
      colorizeAgeRating();
    }

    // NEW: карточки (как на скрине)
    startMainBadgesObserver();

    console.log('Interface MOD + Cards started v' + InterFaceMod.version);
  }

  /* ==========================
   * BOOTSTRAP
   * ========================== */
  if (window.interface_mod_plus_loaded) return;
  window.interface_mod_plus_loaded = true;

  if (window.appready) startPlugin();
  else {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') startPlugin();
    });
  }

  // Манифест
  Lampa.Manifest = Lampa.Manifest || {};
  Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
  Lampa.Manifest.plugins.interface_mod = {
    name: 'Интерфейс мод + Карточки',
    version: InterFaceMod.version,
    description:
      'Полный функционал interface_mod + главные карточки: тип, цветной рейтинг, Sx a/b, дата новой серии, качество (JacRed), год'
  };

  // Экспорт
  window.season_info = InterFaceMod;
})();
