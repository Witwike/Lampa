(function () {
'use strict';
/**
* Интерфейс MOD + Главные карточки
* Версия: 3.0.4-Complete
*/

var InterFaceMod = {
    name: 'interface_mod',
    version: '3.0.4-Complete',
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
        main_badges_show_type: true
    }
};

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

var TV_CACHE_KEY = 'interface_mod_tv_cache_v1';
var TV_CACHE_TTL = 24 * 60 * 60 * 1000;

function getTvCache() { return Lampa.Storage.get(TV_CACHE_KEY) || {}; }
function setTvCache(cache) { Lampa.Storage.set(TV_CACHE_KEY, cache); }
function getTvCached(id) {
    var c = getTvCache(), item = c[String(id)];
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
    try {
        if (Lampa.TMDB && typeof Lampa.TMDB.get === 'function') {
            return Lampa.TMDB.get('tv/' + id, {}, function(r) {
                if (r && r.id) { saveTvCached(id, r); cb(null, r); }
                else cb(new Error('empty'));
            }, function() { cb(new Error('tmdb error')); });
        }
    } catch(e) {}
    try {
        if (Lampa.Api && typeof Lampa.Api.tmdb === 'function') {
            return Lampa.Api.tmdb('tv/' + id, {}, function(r) {
                if (r && r.id) { saveTvCached(id, r); cb(null, r); }
                else cb(new Error('empty'));
            }, function() { cb(new Error('tmdb error')); });
        }
    } catch(e) {}
    cb(new Error('no getter'));
}

/* ==========================
* JACRED QUALITY
* ========================== */
var Q_LOGGING = false;
var Q_CACHE_TIME = 24 * 60 * 60 * 1000;
var QUALITY_CACHE = 'interface_mod_quality_cache_v1';
var JACRED_PROTOCOL = 'https://';
var JACRED_URL = 'jac.red';
var PROXY_TIMEOUT = 5000;
var PROXY_LIST = ['https://api.allorigins.win/raw?url=', 'https://cors.bwa.workers.dev/'];

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
    var idx = 0, done = false;
    function tryNext() {
        if (idx >= PROXY_LIST.length) {
            if (!done) { done = true; callback(new Error('All proxies failed')); }
            return;
        }
        var proxyUrl = PROXY_LIST[idx] + encodeURIComponent(url);
        var timeoutId = setTimeout(function() {
            if (done) return;
            idx++;
            tryNext();
        }, PROXY_TIMEOUT);
        fetch(proxyUrl).then(function(r) {
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error('Proxy ' + r.status);
            return r.text();
        }).then(function(txt) {
            if (done) return;
            done = true;
            callback(null, txt);
        }).catch(function() {
            clearTimeout(timeoutId);
            if (!done) { idx++; tryNext(); }
        });
    }
    tryNext();
}

function translateQuality(q) {
    if (typeof q !== 'number') return q;
    if (q >= 2160) return '4K';
    if (q >= 1080) return '1080P';
    if (q >= 720) return '720P';
    if (q > 0) return 'SD';
    return null;
}

function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
    if (!JACRED_URL) return callback(null);
    var dateStr = normalizedCard.release_date || '';
    var year = dateStr && dateStr.length >= 4 ? dateStr.substring(0, 4) : '';
    if (!year || isNaN(year)) return callback(null);
    
    function searchApi(searchTitle, searchYear, exactMatch, apiCallback) {
        var userId = Lampa.Storage.get('lampac_unic_id', '');
        var apiUrl = JACRED_PROTOCOL + JACRED_URL + '/api/v1.0/torrents?search=' +
            encodeURIComponent(searchTitle) + '&year=' + searchYear +
            (exactMatch ? '&exact=true' : '') + '&uid=' + userId;
        var timeoutId = setTimeout(function() { apiCallback(null); }, PROXY_TIMEOUT * PROXY_LIST.length + 1000);
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
* CSS - СКРЫВАЕМ СТАНДАРТНЫЕ ЭЛЕМЕНТЫ
* ========================== */
function injectMainBadgesCSS() {
    if (document.getElementById('interface_mod_main_badges_css')) return;
    var css = '<style id="interface_mod_main_badges_css">' +
        '.card__type{display:none!important;}' +
        '.card__vote{display:none!important;}' +
        '.card__quality{display:none!important;}' +
        '.card__info{display:none!important;}' +
        '.card__view{position:relative!important;}' +
        '.im_badge{position:absolute;z-index:60;display:inline-flex;align-items:center;justify-content:center;' +
        'padding:0.25em 0.50em;border-radius:0.35em;font-weight:800;line-height:1;white-space:nowrap;' +
        'font-size:0.80em;backdrop-filter:blur(2px);}' +
        '.im_type{top:0.55em;left:0.55em;background:rgba(156,39,176,0.95);color:#fff;}' +
        '.im_rating{top:0.55em;right:0.55em;background:rgba(255,152,0,0.95);color:#111;}' +
        '.im_rating.r_red{background:rgba(244,67,54,0.95);color:#fff;}' +
        '.im_rating.r_orange{background:rgba(255,152,0,0.95);color:#111;}' +
        '.im_rating.r_blue{background:rgba(33,150,243,0.95);color:#fff;}' +
        '.im_rating.r_green{background:rgba(76,175,80,0.95);color:#fff;}' +
        '.im_tv{left:0.55em;bottom:2.55em;background:rgba(255,193,7,0.95);color:#111;}' +
        '.im_next{left:0.55em;bottom:1.55em;background:rgba(33,150,243,0.95);color:#fff;}' +
        '.im_quality{left:0.55em;bottom:0.55em;background:rgba(76,175,80,0.95);color:#fff;}' +
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
    var last = details.last_episode_to_air, next = details.next_episode_to_air;
    var season = last && last.season_number ? last.season_number : null;
    var ep = last && last.episode_number ? last.episode_number : null;
    if (next && next.season_number && next.episode_number) {
        season = next.season_number;
        ep = Math.max(0, next.episode_number - 1);
    }
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

function applyQualityBadge(view, q) {
    if (!q) { removeBadge(view, 'im_quality'); return; }
    ensureBadge(view, 'im_quality', q);
}

function renderMainBadges(cardEl) {
    if (!InterFaceMod.settings.main_badges_enable) return;
    if (!cardEl || !cardEl.querySelector) return;
    var view = cardEl.querySelector('.card__view');
    if (!view) return;
    var data = cardEl.card_data;
    if (!data) return;
    
    var type = getCardTypeFromData(data), year = getYearFromData(data);
    var vote = safeNum(data.vote_average), id = data.id;
    
    if (InterFaceMod.settings.main_badges_show_type)
        ensureBadge(view, 'im_type', type === 'tv' ? 'Сериал' : 'Фильм');
    else removeBadge(view, 'im_type');
    
    if (InterFaceMod.settings.main_badges_show_rating && vote !== null) {
        var r = ensureBadge(view, 'im_rating ' + ratingClass(vote), vote.toFixed(1));
        r.className = 'im_badge im_rating ' + ratingClass(vote);
    } else removeBadge(view, 'im_rating');
    
    if (InterFaceMod.settings.main_badges_show_year && year)
        ensureBadge(view, 'im_year', year);
    else removeBadge(view, 'im_year');
    
    if (type === 'tv' && (InterFaceMod.settings.main_badges_show_tv_progress || InterFaceMod.settings.main_badges_show_next_episode)) {
        fetchTvDetails(id, function(_err, details) {
            if (!document.body.contains(cardEl)) return;
            if (InterFaceMod.settings.main_badges_show_tv_progress) {
                var p = buildTvProgress(details);
                if (p) ensureBadge(view, 'im_tv', p);
                else removeBadge(view, 'im_tv');
            } else removeBadge(view, 'im_tv');
            if (InterFaceMod.settings.main_badges_show_next_episode) {
                var n = buildNextEpisode(details);
                if (n) ensureBadge(view, 'im_next', n);
                else removeBadge(view, 'im_next');
            } else removeBadge(view, 'im_next');
            if (InterFaceMod.settings.main_badges_show_quality)
                renderQualityForCard(cardEl, view, data, type);
            else removeBadge(view, 'im_quality');
        });
    } else {
        removeBadge(view, 'im_tv'); removeBadge(view, 'im_next');
        if (InterFaceMod.settings.main_badges_show_quality)
            renderQualityForCard(cardEl, view, data, type);
        else removeBadge(view, 'im_quality');
    }
}

function renderQualityForCard(cardEl, view, data, type) {
    var normalized = {
        id: data.id || '', title: data.title || data.name || '',
        original_title: data.original_title || data.original_name || '',
        release_date: data.release_date || data.first_air_date || '', type: type
    };
    var cacheKey = type + '_' + normalized.id, cached = getQualityCache(cacheKey);
    if (cached && cached.quality) { applyQualityBadge(view, cached.quality); return; }
    getBestReleaseFromJacred(normalized, String(normalized.id), function(jr) {
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
    var obs = new MutationObserver(function(mutations) {
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
        if (list.length) setTimeout(function() {
            for (var i = 0; i < list.length; i++) renderMainBadges(list[i]);
        }, 30);
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

/* ==========================
* ОСТАЛЬНЫЕ ФУНКЦИИ
* ========================== */
function addSeasonInfo() { /* ваш код из версии 3.0.0 */ }
function showAllButtons() { /* ваш код из версии 3.0.0 */ }
function applyTheme(theme) { /* ваш код из версии 3.0.0 */ }
function updateVoteColors() { /* ваш код из версии 3.0.0 */ }
function colorizeSeriesStatus() { /* ваш код из версии 3.0.0 */ }
function colorizeAgeRating() { /* ваш код из версии 3.0.0 */ }
function changeMovieTypeLabels() { /* ваш код из версии 2.2.0 */ }

/* ==========================
* SETTINGS UI
* ========================== */
function registerSettings() {
    Lampa.SettingsApi.addComponent({
        component: 'season_info',
        name: 'Интерфейс мод',
        icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>' +
            '<path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>' +
            '<path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.44772 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/>' +
            '</svg>'
    });
    
    Lampa.SettingsApi.addParam({
        component: 'season_info',
        param: { name: SKEY.seasons_info_mode, type: 'select', values: { none: 'Выключить', aired: 'Актуальная информация', total: 'Полное количество' }, default: 'aired' },
        field: { name: 'Информация о сериях (в карточке)', description: 'Лейбл на постере в полной карточке' },
        onChange: function(v) { InterFaceMod.settings.seasons_info_mode = v; InterFaceMod.settings.enabled = v !== 'none'; Lampa.Settings.update(); }
    });
    
    Lampa.SettingsApi.addParam({
        component: 'season_info',
        param: { name: SKEY.label_position, type: 'select', values: { 'top-right': 'Верхний правый угол', 'top-left': 'Верхний левый угол', 'bottom-right': 'Нижний правый угол', 'bottom-left': 'Нижний левый угол' }, default: 'top-right' },
        field: { name: 'Расположение лейбла серий', description: 'Позиция в полной карточке' },
        onChange: function(v) { InterFaceMod.settings.label_position = v; Lampa.Settings.update(); Lampa.Noty.show('Открой карточку сериала заново'); }
    });
    
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.show_buttons, type: 'trigger', default: true }, field: { name: 'Показывать все кнопки', description: 'Собирает все кнопки действий' }, onChange: function(v) { InterFaceMod.settings.show_buttons = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.show_movie_type, type: 'trigger', default: true }, field: { name: 'Лейблы типа', description: 'Фильм/Сериал' }, onChange: function(v) { InterFaceMod.settings.show_movie_type = v; InterFaceMod.settings.main_badges_show_type = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.theme, type: 'select', values: { default: 'Нет', bywolf_mod: 'Bywolf_mod', dark_night: 'Dark Night', blue_cosmos: 'Blue Cosmos', neon: 'Neon', sunset: 'Dark MOD', emerald: 'Emerald V1', aurora: 'Aurora' }, default: 'default' }, field: { name: 'Тема интерфейса', description: 'Оформление' }, onChange: function(v) { InterFaceMod.settings.theme = v; Lampa.Settings.update(); applyTheme(v); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.colored_ratings, type: 'trigger', default: true }, field: { name: 'Цветные рейтинги', description: 'Меняет цвет рейтинга' }, onChange: function(v) { InterFaceMod.settings.colored_ratings = v; Lampa.Settings.update(); if (v) { updateVoteColors(); } else { $('.card__vote, .full-start__rate').css('color', ''); } } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.colored_elements, type: 'trigger', default: true }, field: { name: 'Цветные элементы', description: 'Статусы и возрастные ограничения' }, onChange: function(v) { InterFaceMod.settings.colored_elements = v; Lampa.Settings.update(); if (v) { colorizeSeriesStatus(); colorizeAgeRating(); } else { $('.full-start__status, .full-start__pg').css({ 'background-color': '', color: '' }); } } });
    
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_enable, type: 'trigger', default: true }, field: { name: 'Главные карточки: включить', description: 'Плашки на постерах' }, onChange: function(v) { InterFaceMod.settings.main_badges_enable = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_quality, type: 'trigger', default: true }, field: { name: 'Главные карточки: качество', description: '4K/1080P/720P/SD' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_quality = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_year, type: 'trigger', default: true }, field: { name: 'Главные карточки: год', description: 'Год выхода' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_year = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_tv_progress, type: 'trigger', default: true }, field: { name: 'Главные карточки: Sx a/b', description: 'Сезон и серии' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_tv_progress = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_next_episode, type: 'trigger', default: true }, field: { name: 'Главные карточки: новая серия', description: 'Дата выхода' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_next_episode = v; Lampa.Settings.update(); } });
    Lampa.SettingsApi.addParam({ component: 'season_info', param: { name: SKEY.main_badges_show_rating, type: 'trigger', default: true }, field: { name: 'Главные карточки: рейтинг', description: 'С цветом' }, onChange: function(v) { InterFaceMod.settings.main_badges_show_rating = v; Lampa.Settings.update(); } });
    
    Lampa.Settings.listener.follow('open', function() {
        setTimeout(function() {
            var mod = $('.settings-folder[data-component="season_info"]'), std = $('.settings-folder[data-component="interface"]');
            if (mod.length && std.length) mod.insertAfter(std);
        }, 100);
    });
}

function loadSettings() {
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
    InterFaceMod.settings.main_badges_show_type = !!InterFaceMod.settings.show_movie_type;
    InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';
}

function startPlugin() {
    loadSettings();
    registerSettings();
    applyTheme(InterFaceMod.settings.theme);
    if (InterFaceMod.settings.enabled) addSeasonInfo();
    showAllButtons();
    if (InterFaceMod.settings.colored_ratings) updateVoteColors();
    if (InterFaceMod.settings.colored_elements) { colorizeSeriesStatus(); colorizeAgeRating(); }
    changeMovieTypeLabels();
    startMainBadgesObserver();
    console.log('Interface MOD + Cards started v' + InterFaceMod.version);
}

if (window.interface_mod_plus_loaded) return;
window.interface_mod_plus_loaded = true;

if (window.appready) startPlugin();
else {
    Lampa.Listener.follow('app', function(event) {
        if (event.type === 'ready') startPlugin();
    });
}

Lampa.Manifest = Lampa.Manifest || {};
Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
Lampa.Manifest.plugins.interface_mod = {
    name: 'Интерфейс мод + Карточки',
    version: InterFaceMod.version,
    description: 'Полный функционал: тип, цветной рейтинг, Sx a/b, дата новой серии, качество (JacRed), год'
};

window.season_info = InterFaceMod;
})();
