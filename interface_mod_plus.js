(function () {
'use strict';
/**
* Интерфейс MOD + Главные карточки (Финальная исправленная версия)
* Версия: 3.0.3-Complete
*/

/* ==========================
* ОСНОВНОЙ ОБЪЕКТ
* ========================== */
var InterFaceMod = {
    name: 'interface_mod',
    version: '3.0.3-Complete',
    debug: false,
    settings: {
        enabled: true,
        buttons_mode: 'default',
        show_movie_type: true,
        theme: 'default',
        colored_ratings: true,
        seasons_info_mode: 'aired',
        show_episodes_on_main: false,
        label_position: 'top-right',
        show_buttons: true,
        colored_elements: true,
        main_badges_enable: true,
        main_badges_show_quality: true,
        main_badges_show_year: true,
        main_badges_show_tv_progress: true,
        main_badges_show_next_episode: true,
        main_badges_show_rating: true,
        main_badges_show_type: true,
        jacred_enabled: true,
        jacred_url: 'jacred.xyz'
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
    main_badges_show_type: 'main_badges_show_type',
    jacred_enabled: 'jacred_enabled',
    jacred_url: 'jacred_xyz_url'
};

/* ==========================
* CACHE MANAGEMENT
* ========================== */
var TV_CACHE_KEY = 'interface_mod_tv_cache_v2';
var TV_CACHE_TTL = 24 * 60 * 60 * 1000;
var TV_CACHE_MAX_ITEMS = 300;
var QUALITY_CACHE_KEY = 'interface_mod_quality_cache_v2';
var Q_CACHE_TIME = 24 * 60 * 60 * 1000;
var Q_CACHE_MAX_ITEMS = 500;

function pruneCache(cacheObj, maxItems) {
    var keys = Object.keys(cacheObj);
    if (keys.length > maxItems) {
        keys.sort(function(a, b) {
            return (cacheObj[a].ts || cacheObj[a].timestamp || 0) - (cacheObj[b].ts || cacheObj[b].timestamp || 0);
        });
        while (keys.length > maxItems) delete cacheObj[keys.shift()];
    }
}

function getTvCache() { try { return Lampa.Storage.get(TV_CACHE_KEY) || {}; } catch(e) { return {}; } }
function setTvCache(cache) { try { pruneCache(cache, TV_CACHE_MAX_ITEMS); Lampa.Storage.set(TV_CACHE_KEY, cache); } catch(e) {} }
function getTvCached(id) {
    var c = getTvCache(), item = c[String(id)];
    if (!item) return null;
    if (Date.now() - item.ts > TV_CACHE_TTL) { delete c[String(id)]; setTvCache(c); return null; }
    return item.data || null;
}
function saveTvCached(id, data) { var c = getTvCache(); c[String(id)] = { ts: Date.now(), data: data }; setTvCache(c); }

function getQualityCache() { try { return Lampa.Storage.get(QUALITY_CACHE_KEY) || {}; } catch(e) { return {}; } }
function setQualityCache(cache) { try { pruneCache(cache, Q_CACHE_MAX_ITEMS); Lampa.Storage.set(QUALITY_CACHE_KEY, cache); } catch(e) {} }
function getQualityCacheItem(key) {
    var cache = getQualityCache(), item = cache[key];
    return item && (Date.now() - item.timestamp < Q_CACHE_TIME) ? item : null;
}
function saveQualityCacheItem(key, data) {
    var cache = getQualityCache();
    cache[key] = { quality: data.quality || null, timestamp: Date.now() };
    setQualityCache(cache);
}

/* ==========================
* TMDB FUNCTIONS
* ========================== */
function fetchTvDetails(id, cb) {
    var cached = getTvCached(id);
    if (cached) return cb(null, cached);
    try {
        if (Lampa.TMDB && typeof Lampa.TMDB.get === 'function') {
            return Lampa.TMDB.get('tv/' + id, {}, function(r) {
                if (r && r.id) { saveTvCached(id, r); cb(null, r); } else cb(new Error('empty'));
            }, function() { cb(new Error('tmdb error')); });
        }
    } catch(e) {}
    try {
        if (Lampa.Api && typeof Lampa.Api.tmdb === 'function') {
            return Lampa.Api.tmdb('tv/' + id, {}, function(r) {
                if (r && r.id) { saveTvCached(id, r); cb(null, r); } else cb(new Error('empty'));
            }, function() { cb(new Error('tmdb error')); });
        }
    } catch(e) {}
    cb(new Error('no getter'));
}

/* ==========================
* JACRED QUALITY - HTTPS + SAFE
* ========================== */
var Q_LOGGING = false;
var JACRED_PROTOCOL = 'https://';
var JACRED_URL = 'jacred.xyz';
var PROXY_TIMEOUT = 7000;
// ИСПРАВЛЕНО: убраны пробелы в URL
var PROXY_LIST = [
    'https://api.allorigins.win/raw?url=',
    'https://cors.bwa.workers.dev/',
    'https://cors-proxy.htmldriven.com/?url='
];

function initJacredUrl() {
    try {
        if (Lampa.Storage && typeof Lampa.Storage.get === 'function') {
            var stored = Lampa.Storage.get(SKEY.jacred_url);
            if (stored) JACRED_URL = stored.replace(/^https?:\/\//, '');
        }
    } catch(e) { console.log('Interface MOD: Cannot access Storage for JacRed URL'); }
}

function fetchWithProxy(url, cardId, callback) {
    var idx = 0, done = false;
    function tryNext() {
        if (idx >= PROXY_LIST.length) { if (!done) { done = true; callback(new Error('All proxies failed')); } return; }
        var proxyUrl = PROXY_LIST[idx] + encodeURIComponent(url);
        var timeoutId = setTimeout(function() { if (!done) { idx++; tryNext(); } }, PROXY_TIMEOUT);
        fetch(proxyUrl).then(function(r) {
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error('Proxy ' + r.status);
            return r.text();
        }).then(function(txt) {
            if (done) return; done = true; callback(null, txt);
        }).catch(function() {
            clearTimeout(timeoutId);
            if (!done) { idx++; tryNext(); }
        });
    }
    tryNext();
}

function translateQuality(q) {
    if (typeof q !== 'number') return q;
    if (q >= 2160) return '4K'; if (q >= 1080) return '1080P'; if (q >= 720) return '720P'; if (q > 0) return 'SD';
    return null;
}

function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
    if (!InterFaceMod.settings.jacred_enabled || !JACRED_URL) return callback(null);
    var dateStr = normalizedCard.release_date || '';
    var year = dateStr && dateStr.length >= 4 ? dateStr.substring(0, 4) : '';
    if (!year || isNaN(year)) return callback(null);
    
    function searchApi(searchTitle, searchYear, exactMatch, apiCallback) {
        var userId = ''; try { userId = Lampa.Storage.get('lampac_unic_id', '') || ''; } catch(e) {}
        var apiUrl = JACRED_PROTOCOL + JACRED_URL + '/api/v1.0/torrents?search=' +
            encodeURIComponent(searchTitle) + '&year=' + searchYear + (exactMatch ? '&exact=true' : '') + '&uid=' + userId;
        var timeoutId = setTimeout(function() { apiCallback(null); }, PROXY_TIMEOUT * PROXY_LIST.length + 2000);
        fetchWithProxy(apiUrl, cardId, function(error, txt) {
            clearTimeout(timeoutId);
            if (error || !txt) return apiCallback(null);
            try {
                var torrents = JSON.parse(txt);
                if (!Array.isArray(torrents) || !torrents.length) return apiCallback(null);
                var bestQ = -1, bestT = null;
                for (var i = 0; i < torrents.length; i++) {
                    var t = torrents[i] || {}, q = t.quality, lt = String(t.title || '').toLowerCase();
                    if (/\b(ts|telesync|camrip|cam)\b/i.test(lt) && typeof q === 'number' && q < 720) continue;
                    if (typeof q !== 'number' || q <= 0) continue;
                    if (q > bestQ) { bestQ = q; bestT = t; }
                }
                if (!bestT) return apiCallback(null);
                apiCallback({ quality: translateQuality(bestQ), title: bestT.title || '' });
            } catch(e) { apiCallback(null); }
        });
    }
    var strategies = [];
    if (normalizedCard.original_title && /[a-zа-яё0-9]/i.test(normalizedCard.original_title))
        strategies.push({ title: normalizedCard.original_title.trim(), year: year, exact: true });
    if (normalizedCard.title && /[a-zа-яё0-9]/i.test(normalizedCard.title))
        strategies.push({ title: normalizedCard.title.trim(), year: year, exact: true });
    (function run(ix) {
        if (ix >= strategies.length) return callback(null);
        var s = strategies[ix];
        searchApi(s.title, s.year, s.exact, function(res) {
            if (res && res.quality) return callback(res);
            run(ix + 1);
        });
    })(0);
}

/* ==========================
* CSS STYLES
* ========================== */
function injectMainBadgesCSS() {
    if (document.getElementById('interface_mod_main_badges_css')) return;
    var css = '<style id="interface_mod_main_badges_css">' +
        '.card__type{display:none!important;}' +
        '.card__vote{display:none!important;}' +
        '.card__view{position:relative!important;}' +
        '.im_badge{position:absolute!important;z-index:9999!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;' +
        'padding:0.25em 0.50em!important;border-radius:0.35em!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important;' +
        'font-size:0.80em!important;backdrop-filter:blur(2px)!important;pointer-events:none!important;}' +
        '.im_type{top:0.55em!important;left:0.55em!important;background:rgba(156,39,176,0.95)!important;color:#fff!important;}' +
        '.im_rating{top:0.55em!important;right:0.55em!important;background:rgba(255,152,0,0.95)!important;color:#111!important;}' +
        '.im_rating.r_red{background:rgba(244,67,54,0.95)!important;color:#fff!important;}' +
        '.im_rating.r_orange{background:rgba(255,152,0,0.95)!important;color:#111!important;}' +
        '.im_rating.r_blue{background:rgba(33,150,243,0.95)!important;color:#fff!important;}' +
        '.im_rating.r_green{background:rgba(76,175,80,0.95)!important;color:#fff!important;}' +
        '.im_tv{left:0.55em!important;bottom:2.55em!important;background:rgba(255,193,7,0.95)!important;color:#111!important;}' +
        '.im_next{left:0.55em!important;bottom:1.55em!important;background:rgba(33,150,243,0.95)!important;color:#fff!important;}' +
        '.im_quality{left:0.55em!important;bottom:0.55em!important;background:rgba(76,175,80,0.95)!important;color:#fff!important;}' +
        '.im_year{right:0.55em!important;bottom:0.55em!important;background:rgba(255,152,0,0.95)!important;color:#111!important;}' +
        '</style>';
    $('head').append(css);
}

/* ==========================
* BADGE FUNCTIONS
* ========================== */
function ratingClass(v) {
    if (v === null) return '';
    if (v >= 0 && v <= 3) return 'r_red';
    if (v > 3 && v < 6) return 'r_orange';
    if (v >= 6 && v < 8) return 'r_blue';
    return 'r_green';
}
function safeNum(n) { var x = parseFloat(n); return isNaN(x) ? null : x; }
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
    if (!el) { el = document.createElement('div'); el.className = 'im_badge ' + cls; view.appendChild(el); }
    el.textContent = text; return el;
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
    var last = details.last_episode_to_air, next = details.next_episode_to_air;
    var season = last && last.season_number ? last.season_number : null;
    var ep = last && last.episode_number ? last.episode_number : null;
    if (next && next.season_number && next.episode_number) { season = next.season_number; ep = Math.max(0, next.episode_number - 1); }
    if (!season || ep === null) return null;
    var total = null;
    if (details.seasons && season !== null) {
        for (var i = 0; i < details.seasons.length; i++) {
            var s = details.seasons[i];
            if (s && s.season_number === season) { total = s.episode_count || null; break; }
        }
    }
    if (total) return 'S' + season + ' ' + ep + '/' + total;
    return 'S' + season + ' ' + ep;
}
function buildNextEpisode(details) {
    if (!details || !details.next_episode_to_air || !details.next_episode_to_air.air_date) return null;
    return nextTextFromAirDate(details.next_episode_to_air.air_date);
}
function applyQualityBadge(view, q) { if (!q) { removeBadge(view, 'im_quality'); return; } ensureBadge(view, 'im_quality', q); }

function renderMainBadges(cardEl) {
    if (!InterFaceMod.settings.main_badges_enable || !cardEl || !cardEl.querySelector) return;
    var view = cardEl.querySelector('.card__view'); if (!view) return;
    var data = cardEl.card_data; if (!data) return;
    
    var oldBadges = view.querySelectorAll('.im_badge');
    for (var i = 0; i < oldBadges.length; i++) oldBadges[i].parentNode.removeChild(oldBadges[i]);
    
    var type = getCardTypeFromData(data), year = getYearFromData(data);
    var vote = safeNum(data.vote_average), id = data.id;
    
    if (InterFaceMod.settings.main_badges_show_type) ensureBadge(view, 'im_type', type === 'tv' ? 'Сериал' : 'Фильм');
    else removeBadge(view, 'im_type');
    
    if (InterFaceMod.settings.main_badges_show_rating && vote !== null) {
        var r = ensureBadge(view, 'im_rating ' + ratingClass(vote), vote.toFixed(1));
        r.className = 'im_badge im_rating ' + ratingClass(vote);
    } else removeBadge(view, 'im_rating');
    
    if (InterFaceMod.settings.main_badges_show_year && year) ensureBadge(view, 'im_year', year);
    else removeBadge(view, 'im_year');
    
    if (type === 'tv' && (InterFaceMod.settings.main_badges_show_tv_progress || InterFaceMod.settings.main_badges_show_next_episode)) {
        fetchTvDetails(id, function(_err, details) {
            if (!document.body.contains(cardEl)) return;
            if (InterFaceMod.settings.main_badges_show_tv_progress) {
                var p = buildTvProgress(details); if (p) ensureBadge(view, 'im_tv', p); else removeBadge(view, 'im_tv');
            } else removeBadge(view, 'im_tv');
            if (InterFaceMod.settings.main_badges_show_next_episode) {
                var n = buildNextEpisode(details); if (n) ensureBadge(view, 'im_next', n); else removeBadge(view, 'im_next');
            } else removeBadge(view, 'im_next');
            if (InterFaceMod.settings.main_badges_show_quality) renderQualityForCard(cardEl, view, data, type);
            else removeBadge(view, 'im_quality');
        });
    } else {
        removeBadge(view, 'im_tv'); removeBadge(view, 'im_next');
        if (InterFaceMod.settings.main_badges_show_quality) renderQualityForCard(cardEl, view, data, type);
        else removeBadge(view, 'im_quality');
    }
}

function renderQualityForCard(cardEl, view, data, type) {
    var normalized = { id: data.id || '', title: data.title || data.name || '', original_title: data.original_title || data.original_name || '', release_date: data.release_date || data.first_air_date || '', type: type };
    var cacheKey = type + '_' + normalized.id, cached = getQualityCacheItem(cacheKey);
    if (cached && cached.quality) { applyQualityBadge(view, cached.quality); return; }
    getBestReleaseFromJacred(normalized, String(normalized.id), function(jr) {
        if (!document.body.contains(cardEl)) return;
        var q = jr && jr.quality ? jr.quality : null;
        if (q) saveQualityCacheItem(cacheKey, { quality: q });
        applyQualityBadge(view, q);
    });
}

/* ==========================
* OBSERVER
* ========================== */
var domObserver = null;
function startMainBadgesObserver() {
    injectMainBadgesCSS();
    function processCards() {
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) { try { renderMainBadges(cards[i]); } catch(e) {} }
    }
    setTimeout(processCards, 800); setTimeout(processCards, 2000);
    domObserver = new MutationObserver(function(mutations) {
        var hasCards = false;
        for (var m = 0; m < mutations.length; m++) {
            var mu = mutations[m]; if (!mu.addedNodes) continue;
            for (var j = 0; j < mu.addedNodes.length; j++) {
                var n = mu.addedNodes[j]; if (!n || n.nodeType !== 1) continue;
                if (n.classList && n.classList.contains('card')) hasCards = true;
                var nested = n.querySelectorAll ? n.querySelectorAll('.card') : [];
                if (nested.length) hasCards = true;
            }
        }
        if (hasCards) setTimeout(processCards, 150);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    if (Lampa && Lampa.Listener) {
        Lampa.Listener.follow('catalog', function(data) { if (data.type === 'complite') setTimeout(processCards, 500); });
        Lampa.Listener.follow('full', function(data) { if (data.type === 'complite') setTimeout(processCards, 500); });
    }
}
function stopObserver() { if (domObserver) { domObserver.disconnect(); domObserver = null; } }

/* ==========================
* ADD SEASON INFO (FULL CARD)
* ========================== */
function addSeasonInfo() {
    Lampa.Listener.follow('full', function(data) {
        if (!(data && data.type === 'complite' && data.data && data.data.movie)) return;
        var movie = data.data.movie;
        if (!movie.number_of_seasons) return;
        if (InterFaceMod.settings.seasons_info_mode === 'none') return;
        
        var status = movie.status, totalSeasons = movie.number_of_seasons || 0, totalEpisodes = movie.number_of_episodes || 0;
        var airedSeasons = 0, airedEpisodes = 0, currentDate = new Date();
        
        if (movie.seasons && Array.isArray(movie.seasons)) {
            movie.seasons.forEach(function(season) {
                if (!season || season.season_number === 0) return;
                var seasonAired = false;
                if (season.air_date) { var airDate = new Date(season.air_date); if (airDate <= currentDate) { seasonAired = true; airedSeasons++; } }
                if (seasonAired && season.episode_count) airedEpisodes += season.episode_count;
            });
        } else if (movie.last_episode_to_air) {
            airedSeasons = movie.last_episode_to_air.season_number || 0;
            if (movie.last_episode_to_air.episode_number) {
                airedEpisodes = 0;
                if (movie.seasons && Array.isArray(movie.seasons)) {
                    movie.seasons.forEach(function(s) {
                        if (!s || s.season_number === 0) return;
                        if (s.season_number < airedSeasons) airedEpisodes += s.episode_count || 0;
                        if (s.season_number === airedSeasons) airedEpisodes += movie.last_episode_to_air.episode_number || 0;
                    });
                } else airedEpisodes = movie.last_episode_to_air.episode_number || 0;
            }
        }
        if (airedSeasons === 0) airedSeasons = totalSeasons;
        if (airedEpisodes === 0) airedEpisodes = totalEpisodes;
        if (totalEpisodes > 0 && airedEpisodes > totalEpisodes) airedEpisodes = totalEpisodes;
        
        function plural(number, one, two, five) {
            var n = Math.abs(number); n %= 100;
            if (n >= 5 && n <= 20) return five; n %= 10;
            if (n === 1) return one; if (n >= 2 && n <= 4) return two; return five;
        }
        function getStatusText(st) {
            if (st === 'Ended') return 'Завершён'; if (st === 'Canceled') return 'Отменён';
            if (st === 'Returning Series') return 'Выходит'; if (st === 'In Production') return 'В производстве';
            return st || 'Неизвестно';
        }
        
        var isCompleted = status === 'Ended' || status === 'Canceled';
        var bgColor = isCompleted ? 'rgba(33,150,243,0.8)' : 'rgba(244,67,54,0.8)';
        var displaySeasons = InterFaceMod.settings.seasons_info_mode === 'aired' ? airedSeasons : totalSeasons;
        var displayEpisodes = InterFaceMod.settings.seasons_info_mode === 'aired' ? airedEpisodes : totalEpisodes;
        var seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
        var episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');
        
        var infoElement = $('<div class="season-info-label"></div>');
        if (isCompleted) {
            infoElement.append($('<div></div>').text(displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText));
            infoElement.append($('<div></div>').text(getStatusText(status)));
        } else {
            var text = '';
            if (InterFaceMod.settings.seasons_info_mode === 'aired' && totalEpisodes > 0 && airedEpisodes < totalEpisodes && airedEpisodes > 0)
                text = displaySeasons + ' ' + seasonsText + ' ' + airedEpisodes + ' ' + episodesText + ' из ' + totalEpisodes;
            else text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
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
        var commonStyles = { 'background-color': bgColor, color: 'white', padding: '0.4em 0.6em', 'border-radius': '0.3em', 'font-size': '0.8em', 'z-index': '999', 'text-align': 'center', 'white-space': 'nowrap', 'line-height': '1.2em', 'backdrop-filter': 'blur(2px)', 'box-shadow': '0 2px 5px rgba(0,0,0,0.2)' };
        infoElement.css($.extend({}, commonStyles, positionStyle));
        
        setTimeout(function() {
            var poster = $(data.object.activity.render()).find('.full-start-new__poster, .full-start__poster').first();
            if (poster.length) { poster.css('position', 'relative'); poster.find('.season-info-label').remove(); poster.append(infoElement); }
        }, 100);
    });
}

/* ==========================
* SHOW ALL BUTTONS
* ========================== */
function showAllButtons() {
    if (document.getElementById('interface_mod_buttons_style')) return;
    var st = document.createElement('style'); st.id = 'interface_mod_buttons_style';
    st.innerHTML = '.full-start-new__buttons, .full-start__buttons{display:flex!important;flex-wrap:wrap!important;gap:10px!important;}';
    document.head.appendChild(st);
    
    function organize(container) {
        if (!container || !container.length) return;
        container.css({ display: 'flex', flexWrap: 'wrap', gap: '10px' });
        var btns = [], used = {}, categories = { online: [], torrent: [], trailer: [], other: [] };
        container.find('> *').each(function() { btns.push(this); });
        if (!btns.length) return;
        $(btns).each(function() {
            var b = this, txt = $(b).text().trim(), cls = b.className || '';
            if (!txt || used[txt]) return; used[txt] = true;
            if (cls.indexOf('online') >= 0) categories.online.push(b);
            else if (cls.indexOf('torrent') >= 0) categories.torrent.push(b);
            else if (cls.indexOf('trailer') >= 0) categories.trailer.push(b);
            else categories.other.push(b);
        });
        container.empty(); ['online', 'torrent', 'trailer', 'other'].forEach(function(k) { categories[k].forEach(function(b) { container.append(b); }); });
    }
    
    Lampa.Listener.follow('full', function(e) {
        if (e.type !== 'complite' || !InterFaceMod.settings.show_buttons) return;
        setTimeout(function() {
            var root = e.object.activity.render(), c = root.find('.full-start-new__buttons');
            if (!c.length) c = root.find('.full-start__buttons'); if (!c.length) c = root.find('.buttons-container');
            if (!c.length) return; organize(c);
        }, 250);
    });
}

/* ==========================
* THEMES
* ========================== */
function applyTheme(theme) {
    $('#interface_mod_theme').remove(); if (!theme || theme === 'default') return;
    var style = $('<style id="interface_mod_theme"></style>');
    var themes = {
        neon: 'body{background:linear-gradient(135deg,#0d0221 0%,#150734 50%,#1f0c47 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#ff00ff,#00ffff);color:#fff;box-shadow:0 0 20px rgba(255,0,255,.4);border:none;}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #ff00ff;box-shadow:0 0 20px #00ffff;}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#ff00ff,#00ffff);box-shadow:0 0 15px rgba(255,0,255,.3);}.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(15,2,33,.95);border:1px solid rgba(255,0,255,.1);}',
        dark_night: 'body{background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 50%,#0f0f0f 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#8a2387,#e94057,#f27121);color:#fff;box-shadow:0 0 30px rgba(233,64,87,.3);}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #e94057;box-shadow:0 0 30px rgba(242,113,33,.5);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#8a2387,#f27121);}.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(10,10,10,.95);border:1px solid rgba(233,64,87,.1);}',
        blue_cosmos: 'body{background:linear-gradient(135deg,#0b365c 0%,#144d80 50%,#0c2a4d 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#12c2e9,#c471ed,#f64f59);color:#fff;box-shadow:0 0 30px rgba(18,194,233,.3);}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #12c2e9;box-shadow:0 0 30px rgba(196,113,237,.5);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#12c2e9,#f64f59);}.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(11,54,92,.95);border:1px solid rgba(18,194,233,.1);}',
        sunset: 'body{background:linear-gradient(135deg,#2d1f3d 0%,#614385 50%,#516395 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#ff6e7f,#bfe9ff);color:#2d1f3d;box-shadow:0 0 15px rgba(255,110,127,.3);font-weight:700;}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #ff6e7f;box-shadow:0 0 15px rgba(255,110,127,.5);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#ff6e7f,#bfe9ff);color:#2d1f3d;}',
        emerald: 'body{background:linear-gradient(135deg,#1a2a3a 0%,#2C5364 50%,#203A43 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#43cea2,#185a9d);color:#fff;box-shadow:0 4px 15px rgba(67,206,162,.3);}.card.focus .card__view::after,.card.hover .card__view::after{border:3px solid #43cea2;box-shadow:0 0 20px rgba(67,206,162,.4);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#43cea2,#185a9d);}.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(26,42,58,.98);border:1px solid rgba(67,206,162,.1);}',
        aurora: 'body{background:linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#aa4b6b,#6b6b83,#3b8d99);color:#fff;box-shadow:0 0 20px rgba(170,75,107,.3);}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #aa4b6b;box-shadow:0 0 25px rgba(170,75,107,.5);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#aa4b6b,#3b8d99);}',
        bywolf_mod: 'body{background:linear-gradient(135deg,#090227 0%,#170b34 50%,#261447 100%);color:#fff;}.menu__item.focus,.menu__item.traverse,.menu__item.hover,.settings-folder.focus,.settings-param.focus,.selectbox-item.focus,.full-start__button.focus,.full-descr__tag.focus,.player-panel .button.focus{background:linear-gradient(to right,#fc00ff,#00dbde);color:#fff;box-shadow:0 0 30px rgba(252,0,255,.3);}.card.focus .card__view::after,.card.hover .card__view::after{border:2px solid #fc00ff;box-shadow:0 0 30px rgba(0,219,222,.5);}.head__action.focus,.head__action.hover{background:linear-gradient(45deg,#fc00ff,#00dbde);}.settings__content,.settings-input__content,.selectbox__content,.modal__content{background:rgba(9,2,39,.95);border:1px solid rgba(252,0,255,.1);}'
    };
    style.html(themes[theme] || ''); $('head').append(style);
}

/* ==========================
* COLORED RATINGS
* ========================== */
function updateVoteColors() {
    if (!InterFaceMod.settings.colored_ratings) return;
    function applyColorByRating(element) {
        var voteText = $(element).text().trim(), match = voteText.match(/(\d+(\.\d+)?)/);
        if (!match) return; var vote = parseFloat(match[0]);
        if (vote >= 0 && vote <= 3) $(element).css('color', 'red');
        else if (vote > 3 && vote < 6) $(element).css('color', 'orange');
        else if (vote >= 6 && vote < 8) $(element).css('color', 'cornflowerblue');
        else if (vote >= 8 && vote <= 10) $(element).css('color', 'lawngreen');
    }
    $('.card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate').each(function() { applyColorByRating(this); });
}
function setupVoteColorsObserver() {
    if (!InterFaceMod.settings.colored_ratings) return;
    setTimeout(updateVoteColors, 500);
    var observer = new MutationObserver(function() { setTimeout(updateVoteColors, 100); });
    observer.observe(document.body, { childList: true, subtree: true });
}
function setupVoteColorsForDetailPage() {
    if (!InterFaceMod.settings.colored_ratings) return;
    Lampa.Listener.follow('full', function(data) { if (data.type === 'complite') setTimeout(updateVoteColors, 100); });
}

/* ==========================
* COLORED ELEMENTS
* ========================== */
function colorizeSeriesStatus() {
    if (!InterFaceMod.settings.colored_elements) return;
    function applyStatusColor(el) {
        var statusText = $(el).text().trim(), bg = '', tc = '';
        if (statusText.indexOf('Заверш') >= 0 || statusText.indexOf('Ended') >= 0) { bg = 'rgba(46,204,113,0.8)'; tc = 'white'; }
        else if (statusText.indexOf('Отмен') >= 0 || statusText.indexOf('Canceled') >= 0) { bg = 'rgba(231,76,60,0.8)'; tc = 'white'; }
        else if (statusText.indexOf('Онгоинг') >= 0 || statusText.indexOf('Выход') >= 0 || statusText.indexOf('В процессе') >= 0 || statusText.indexOf('Return') >= 0) { bg = 'rgba(243,156,18,0.8)'; tc = 'black'; }
        else if (statusText.indexOf('производстве') >= 0 || statusText.indexOf('Production') >= 0) { bg = 'rgba(52,152,219,0.8)'; tc = 'white'; }
        else if (statusText.indexOf('Заплан') >= 0 || statusText.indexOf('Planned') >= 0) { bg = 'rgba(155,89,182,0.8)'; tc = 'white'; }
        if (bg) $(el).css({ 'background-color': bg, color: tc, 'border-radius': '0.3em', border: '0px', 'font-size': '1.3em', display: 'inline-block' });
    }
    $('.full-start__status').each(function() { applyStatusColor(this); });
    var obs = new MutationObserver(function(mutations) {
        mutations.forEach(function(mu) {
            if (!mu.addedNodes) return;
            for (var i = 0; i < mu.addedNodes.length; i++) {
                var node = mu.addedNodes[i]; if (!node || node.nodeType !== 1) continue;
                $(node).find('.full-start__status').each(function() { applyStatusColor(this); });
                if ($(node).hasClass('full-start__status')) applyStatusColor(node);
            }
        });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    Lampa.Listener.follow('full', function(data) {
        if (data.type === 'complite' && data.data.movie) {
            setTimeout(function() { $(data.object.activity.render()).find('.full-start__status').each(function() { applyStatusColor(this); }); }, 100);
        }
    });
}

function colorizeAgeRating() {
    if (!InterFaceMod.settings.colored_elements) return;
    function applyAgeRatingColor(el) {
        var t = $(el).text().trim();
        var groups = { kids: ['G','TV-Y','TV-G','0+','3+','0','3'], children: ['PG','TV-PG','TV-Y7','6+','7+','6','7'], teens: ['PG-13','TV-14','12+','13+','14+','12','13','14'], almostAdult: ['R','TV-MA','16+','17+','16','17'], adult: ['NC-17','18+','18','X'] };
        var colors = { kids: { bg: '#2ecc71', text: 'white' }, children: { bg: '#3498db', text: 'white' }, teens: { bg: '#f1c40f', text: 'black' }, almostAdult: { bg: '#e67e22', text: 'white' }, adult: { bg: '#e74c3c', text: 'white' } };
        var group = null;
        Object.keys(groups).some(function(k) {
            if (groups[k].indexOf(t) >= 0) { group = k; return true; }
            for (var i = 0; i < groups[k].length; i++) { if (t.indexOf(groups[k][i]) >= 0) { group = k; return true; } }
            return false;
        });
        if (group) $(el).css({ 'background-color': colors[group].bg, color: colors[group].text, 'border-radius': '0.3em', 'font-size': '1.3em', border: '0px' });
    }
    $('.full-start__pg').each(function() { applyAgeRatingColor(this); });
    var obs = new MutationObserver(function(mutations) {
        mutations.forEach(function(mu) {
            if (!mu.addedNodes) return;
            for (var i = 0; i < mu.addedNodes.length; i++) {
                var node = mu.addedNodes[i]; if (!node || node.nodeType !== 1) continue;
                $(node).find('.full-start__pg').each(function() { applyAgeRatingColor(this); });
                if ($(node).hasClass('full-start__pg')) applyAgeRatingColor(node);
            }
        });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    Lampa.Listener.follow('full', function(data) {
        if (data.type === 'complite' && data.data.movie) {
            setTimeout(function() { $(data.object.activity.render()).find('.full-start__pg').each(function() { applyAgeRatingColor(this); }); }, 100);
        }
    });
}

/* ==========================
* SETTINGS UI
* ========================== */
function registerSettings() {
    Lampa.SettingsApi.addComponent({ component: 'season_info', name: 'Интерфейс мод', icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/><path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/><path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.44772 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/></svg>' });
    
    // JacRed настройки
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.jacred_enabled, type: 'trigger', default: true }, field: { name: 'JacRed: Включить', description: 'Показывать качество из JacRed (4K/1080P/720P)' }, onChange: function(v) { InterFaceMod.settings.jacred_enabled = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.jacred_url, type: 'input', default: 'jacred.xyz' }, field: { name: 'JacRed: URL', description: 'Адрес сервера JacRed' }, onChange: function(v) { InterFaceMod.settings.jacred_url = v; Lampa.Storage.set(SKEY.jacred_url, v); JACRED_URL = v.replace(/^https?:\/\//, ''); Lampa.Settings.update(); } });
    
    // Информация о сериях
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.seasons_info_mode, type: 'select', values: { none: 'Выключить', aired: 'Актуальная информация', total: 'Полное количество' }, default: 'aired' }, field: { name: 'Информация о сериях (в карточке)', description: 'Лейбл на постере в полной карточке' }, onChange: function(v) { InterFaceMod.settings.seasons_info_mode = v; InterFaceMod.settings.enabled = v !== 'none'; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.label_position, type: 'select', values: { 'top-right': 'Верхний правый угол', 'top-left': 'Верхний левый угол', 'bottom-right': 'Нижний правый угол', 'bottom-left': 'Нижний левый угол' }, default: 'top-right' }, field: { name: 'Расположение лейбла серий', description: 'Позиция в полной карточке' }, onChange: function(v) { InterFaceMod.settings.label_position = v; Lampa.Settings.update(); Lampa.Noty.show('Открой карточку сериала заново для обновления'); } });
    
    // Кнопки и тип
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.show_buttons, type: 'trigger', default: true }, field: { name: 'Показывать все кнопки', description: 'Собирает все кнопки действий в карточке' }, onChange: function(v) { InterFaceMod.settings.show_buttons = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.show_movie_type, type: 'trigger', default: true }, field: { name: 'Лейблы типа (включая главные карточки)', description: 'Фильм/Сериал' }, onChange: function(v) { InterFaceMod.settings.show_movie_type = v; InterFaceMod.settings.main_badges_show_type = v; Lampa.Settings.update(); } });
    
    // Темы
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.theme, type: 'select', values: { default: 'Нет', bywolf_mod: 'Bywolf_mod', dark_night: 'Dark Night', blue_cosmos: 'Blue Cosmos', neon: 'Neon', sunset: 'Dark MOD', emerald: 'Emerald V1', aurora: 'Aurora' }, default: 'default' }, field: { name: 'Тема интерфейса', description: 'Оформление' }, onChange: function(v) { InterFaceMod.settings.theme = v; Lampa.Settings.update(); applyTheme(v); } });
    
    // Цветные рейтинги и элементы
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.colored_ratings, type: 'trigger', default: true }, field: { name: 'Цветные рейтинги', description: 'Меняет цвет рейтинга по шкале' }, onChange: function(v) { InterFaceMod.settings.colored_ratings = v; Lampa.Settings.update(); if (v) { updateVoteColors(); setupVoteColorsObserver(); setupVoteColorsForDetailPage(); } else { $('.card__vote, .full-start__rate, .full-start-new__rate').css('color', ''); } } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.colored_elements, type: 'trigger', default: true }, field: { name: 'Цветные элементы', description: 'Статусы сериалов и возрастные ограничения' }, onChange: function(v) { InterFaceMod.settings.colored_elements = v; Lampa.Settings.update(); if (v) { colorizeSeriesStatus(); colorizeAgeRating(); } else { $('.full-start__status, .full-start__pg').css({ 'background-color': '', color: '' }); } } });
    
    // Главные карточки
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_enable, type: 'trigger', default: true }, field: { name: 'Главные карточки: включить', description: 'Плашки на постерах в списках/главной' }, onChange: function(v) { InterFaceMod.settings.main_badges_enable = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_quality, type: 'trigger', default: true }, field: { name: 'Главные карточки: качество', description: '4K/1080P/720P/SD (JacRed)' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_quality = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_year, type: 'trigger', default: true }, field: { name: 'Главные карточки: год', description: 'Год выхода справа снизу' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_year = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_tv_progress, type: 'trigger', default: true }, field: { name: 'Главные карточки: Sx a/b', description: 'Сезон и вышедшие серии' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_tv_progress = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_next_episode, type: 'trigger', default: true }, field: { name: 'Главные карточки: новая серия', description: 'Сегодня/Завтра/Через N дн.' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_next_episode = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_rating, type: 'trigger', default: true }, field: { name: 'Главные карточки: рейтинг', description: 'С цветом по шкале' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_rating = v; Lampa.Settings.update(); } });
    
    // Перемещение раздела
    Lampa.Settings.listener.follow('open', function() { setTimeout(function() { var mod = $('.settings-folder[data-component="season_info"]'), std = $('.settings-folder[data-component="interface"]'); if (mod.length && std.length) mod.insertAfter(std); }, 100); });
}

/* ==========================
* LOAD SETTINGS
* ========================== */
function loadSettings() {
    try {
        InterFaceMod.settings.jacred_enabled = Lampa.Storage.get(SKEY.jacred_enabled, true);
        InterFaceMod.settings.jacred_url = Lampa.Storage.get(SKEY.jacred_url, 'jacred.xyz');
        InterFaceMod.settings.show_buttons = Lampa.Storage.get(SKEY.show_buttons, true);
        InterFaceMod.settings.show_movie_type = Lampa.Storage.get(SKEY.show_movie_type, true);
        InterFaceMod.settings.theme = Lampa.Storage.get(SKEY.theme, 'default');
        InterFaceMod.settings.colored_ratings = Lampa.Storage.get(SKEY.colored_ratings, true);
        InterFaceMod.settings.colored_elements = Lampa.Storage.get(SKEY.colored_elements, true);
        InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get(SKEY.seasons_info_mode, 'aired');
        InterFaceMod.settings.label_position = Lampa.Storage.get(SKEY.label_position, 'top-right');
        InterFaceMod.settings.main_badges_enable = Lampa.Storage.get(SKEY.main_badges_enable, true);
        InterFaceMod.settings.main_badges_show_quality = Lampa.Storage.get(SKEY.main_badges_show_quality, true);
        InterFaceMod.settings.main_badges_show_year = Lampa.Storage.get(SKEY.main_badges_show_year, true);
        InterFaceMod.settings.main_badges_show_tv_progress = Lampa.Storage.get(SKEY.main_badges_show_tv_progress, true);
        InterFaceMod.settings.main_badges_show_next_episode = Lampa.Storage.get(SKEY.main_badges_show_next_episode, true);
        InterFaceMod.settings.main_badges_show_rating = Lampa.Storage.get(SKEY.main_badges_show_rating, true);
    } catch(e) { console.log('Interface MOD: Error loading settings'); }
    InterFaceMod.settings.main_badges_show_type = !!InterFaceMod.settings.show_movie_type;
    InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';
    JACRED_URL = (InterFaceMod.settings.jacred_url || 'jacred.xyz').replace(/^https?:\/\//, '');
}

/* ==========================
* START PLUGIN
* ========================== */
function startPlugin() {
    if (typeof $ === 'undefined') { console.error('Interface MOD: jQuery not found'); return; }
    initJacredUrl(); loadSettings(); registerSettings(); applyTheme(InterFaceMod.settings.theme);
    if (InterFaceMod.settings.enabled) addSeasonInfo(); showAllButtons();
    if (InterFaceMod.settings.colored_ratings) { updateVoteColors(); setupVoteColorsObserver(); setupVoteColorsForDetailPage(); }
    if (InterFaceMod.settings.colored_elements) { colorizeSeriesStatus(); colorizeAgeRating(); }
    startMainBadgesObserver();
    console.log('Interface MOD + Cards started v' + InterFaceMod.version);
}

/* ==========================
* BOOTSTRAP
* ========================== */
if (window.interface_mod_plus_loaded) return; window.interface_mod_plus_loaded = true;
if (window.appready) startPlugin(); else { Lampa.Listener.follow('app', function(event) { if (event.type === 'ready') startPlugin(); }); }

Lampa.Manifest = Lampa.Manifest || {}; Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
Lampa.Manifest.plugins.interface_mod = { name: 'Интерфейс мод + Карточки', version: InterFaceMod.version, description: 'Полный функционал: тип, цветной рейтинг, Sx a/b, дата новой серии, качество (JacRed), год' };
window.season_info = InterFaceMod;
})();
