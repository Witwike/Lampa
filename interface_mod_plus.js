(function () {
    'use strict';

    var InterFaceMod = {
        name: 'interface_mod',
        version: '2.3.0',
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

            // Новые фичи на карточках
            card_season_label:      true,       // S2, S3... на постере
            card_next_episode_info: true,       // статус + дней до новой серии
            card_quality_year:      true,       // качество • год
            card_country_mode:      'flag',     // 'flag' / 'text' / 'none'
            card_hover_scale:       '1.18',     // масштаб при фокусе/ховере
            card_rating_on_poster:  true        // рейтинг в кружке на постере
        }
    };

    // ────────────────────────────────────────────────
    //  Утилиты
    // ────────────────────────────────────────────────

    function plural(n, one, two, five) {
        n = Math.abs(n) % 100;
        if (n >= 5 && n <= 20) return five;
        n %= 10;
        if (n === 1) return one;
        if (n >= 2 && n <= 4) return two;
        return five;
    }

    function countryCodeToEmoji(code) {
        if (!code || code.length !== 2) return '🌐';
        return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    }

    // ────────────────────────────────────────────────
    //  1. Сезоны + серии на постере в полной карточке (было раньше)
    // ────────────────────────────────────────────────

    function addSeasonInfo() {
        if (InterFaceMod.settings.seasons_info_mode === 'none') return;

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite' || !e.data.movie?.number_of_seasons) return;

            var movie = e.data.movie;
            var status = movie.status || '';
            var totalSeasons = movie.number_of_seasons || 0;
            var totalEpisodes = movie.number_of_episodes || 0;

            var airedSeasons = 0, airedEpisodes = 0;
            var now = new Date();

            if (movie.seasons) {
                movie.seasons.forEach(s => {
                    if (s.season_number === 0) return;
                    if (s.air_date && new Date(s.air_date) <= now) {
                        airedSeasons++;
                        if (s.episodes) {
                            s.episodes.forEach(ep => {
                                if (ep.air_date && new Date(ep.air_date) <= now) airedEpisodes++;
                            });
                        } else if (s.episode_count) {
                            airedEpisodes += s.episode_count;
                        }
                    }
                });
            } else if (movie.last_episode_to_air) {
                airedSeasons = movie.last_episode_to_air.season_number || totalSeasons;
                airedEpisodes = movie.last_episode_to_air.episode_number || totalEpisodes;
            }

            airedSeasons = airedSeasons || totalSeasons;
            airedEpisodes = airedEpisodes || totalEpisodes;

            var isEnded = status === 'Ended' || status === 'Canceled';
            var bg = isEnded ? 'rgba(33,150,243,0.85)' : 'rgba(244,67,54,0.85)';

            var text = '';
            if (InterFaceMod.settings.seasons_info_mode === 'aired') {
                text = `${airedSeasons} ${plural(airedSeasons,'сезон','сезона','сезонов')} ${airedEpisodes} ${plural(airedEpisodes,'серия','серии','серий')}`;
                if (totalEpisodes > airedEpisodes) text += ` из ${totalEpisodes}`;
            } else {
                text = `${totalSeasons} ${plural(totalSeasons,'сезон','сезона','сезонов')} ${totalEpisodes} ${plural(totalEpisodes,'серия','серии','серий')}`;
            }

            var html = isEnded ? `${text}<br>${status === 'Ended' ? 'Завершён' : 'Отменён'}` : text;

            var label = $(`<div class="season-info-label">${html}</div>`);

            var pos = InterFaceMod.settings.label_position || 'top-right';
            var positions = {
                'top-right':   {top:'1.4em', right:'-0.8em'},
                'top-left':    {top:'1.4em', left:'-0.8em'},
                'bottom-right':{bottom:'1.4em', right:'-0.8em'},
                'bottom-left': {bottom:'1.4em', left:'-0.8em'}
            };

            label.css({
                position: 'absolute',
                ...positions[pos],
                background: bg,
                color: 'white',
                padding: '0.4em 0.6em',
                borderRadius: '0.3em',
                fontSize: '0.8em',
                zIndex: 999,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                lineHeight: '1.2em',
                backdropFilter: 'blur(2px)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            });

            setTimeout(() => {
                var poster = $(e.object.activity.render()).find('.full-start__poster, .full-start-new__poster');
                if (poster.length) {
                    poster.css('position','relative').append(label);
                }
            }, 150);
        });
    }

    // ────────────────────────────────────────────────
    //  2. Все кнопки в ряд + сортировка
    // ────────────────────────────────────────────────

    function showAllButtons() {
        if (!InterFaceMod.settings.show_buttons) return;

        $('<style id="interface_mod_buttons">').html(`
            .full-start__buttons, .full-start-new__buttons {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 10px !important;
                justify-content: center !important;
            }
        `).appendTo('head');

        Lampa.Listener.follow('full', e => {
            if (e.type !== 'complite') return;
            setTimeout(() => {
                var container = $(e.object.activity.render()).find('.full-start__buttons, .full-start-new__buttons');
                if (!container.length) return;

                var btns = container.find('.full-start__button, .button');
                if (!btns.length) return;

                var cats = {online:[], torrent:[], trailer:[], other:[]};
                var seen = new Set();

                btns.each(function() {
                    var t = $(this).text().trim();
                    if (!t || seen.has(t)) return;
                    seen.add(t);

                    var cls = this.className.toLowerCase();
                    if (cls.includes('online')) cats.online.push(this);
                    else if (cls.includes('torrent')) cats.torrent.push(this);
                    else if (cls.includes('trailer')) cats.trailer.push(this);
                    else cats.other.push(this);
                });

                container.empty();
                ['online','torrent','trailer','other'].forEach(c => {
                    cats[c].forEach(b => container.append(b));
                });
            }, 400);
        });
    }

    // ────────────────────────────────────────────────
    //  3. Лейблы «Фильм» / «Сериал» + цвет
    // ────────────────────────────────────────────────

    function addContentTypeLabels() {
        if (!InterFaceMod.settings.show_movie_type) return;

        $('<style id="movie-type-labels">').html(`
            .content-type-label {
                position: absolute;
                top: 1.4em;
                left: -0.8em;
                color: white;
                padding: 0.4em 0.6em;
                border-radius: 0.3em;
                font-size: 0.8em;
                z-index: 12;
                font-weight: bold;
            }
            .type-movie { background: #2ecc71; }
            .type-serial { background: #3498db; }
        `).appendTo('head');

        function processCard(card) {
            var $card = $(card);
            if ($card.find('.content-type-label').length) return;

            var data = $card.data() || {};
            var isSerial = false;

            if (data.type === 'tv' || data.card_type === 'tv' ||
                data.number_of_seasons > 0 || data.seasons ||
                $card.hasClass('card--tv') || $card.find('.card__type').text().match(/сезон|серии|ТВ/i)) {
                isSerial = true;
            }

            var label = $(`<div class="content-type-label ${isSerial ? 'type-serial' : 'type-movie'}">
                ${isSerial ? 'Сериал' : 'Фильм'}
            </div>`);

            $card.find('.card__view').css('position','relative').append(label);
        }

        $('.card').each((i,el) => processCard(el));

        new MutationObserver(muts => {
            muts.forEach(mut => {
                if (mut.addedNodes) {
                    $(mut.addedNodes).find('.card').each((i,el) => processCard(el));
                }
            });
        }).observe(document.body, {childList:true, subtree:true});
    }

    // ────────────────────────────────────────────────
    //  4. Новые фичи на карточках (постеры в списках)
    // ────────────────────────────────────────────────

    function enhanceCardPosters() {
        var s = InterFaceMod.settings;

        function updateCards() {
            $('.card').each(function() {
                var $c = $(this);
                var view = $c.find('.card__view');
                if (!view.length) return;
                view.css('position','relative');

                var data = $c.data() || {};
                var movie = data.movie || data;

                // ─── Sx ────────────────────────────────
                if (s.card_season_label && !$c.find('.season-badge').length) {
                    var seas = movie.number_of_seasons || movie.season_count || 0;
                    if (seas > 1) {
                        view.append(`<div class="season-badge">S${seas}</div>`);
                    }
                }

                // ─── Рейтинг в кружке ──────────────────
                if (s.card_rating_on_poster && !$c.find('.card-rating-badge').length) {
                    var vote = movie.vote_average || $c.find('.card__vote').text().trim() || '';
                    if (vote) {
                        view.append(`<div class="card-rating-badge">${vote}</div>`);
                    }
                }

                // ─── Качество + год ────────────────────
                if (s.card_quality_year && !$c.find('.qy-label').length) {
                    var year = movie.release_date?.slice(0,4) || movie.year || '—';
                    var res = movie.resolution || ''; // если есть
                    var txt = res ? `${res} • ${year}` : year;
                    view.append(`<div class="qy-label">${txt}</div>`);
                }

                // ─── Страна ────────────────────────────
                if (s.card_country_mode !== 'none' && !$c.find('.country-label').length) {
                    var countries = movie.production_countries || movie.country || [];
                    if (!Array.isArray(countries)) countries = [countries];
                    if (countries.length) {
                        var c = countries[0];
                        var code = (c.iso_3166_1 || c.code || '').toUpperCase();
                        var name = c.name || c;
                        var content = s.card_country_mode === 'flag' ? countryCodeToEmoji(code) : name;
                        view.append(`<div class="country-label">${content}</div>`);
                    }
                }

                // ─── Следующая серия + статус ──────────
                if (s.card_next_episode_info && !$c.find('.next-ep-info').length && movie.next_episode_to_air) {
                    var next = movie.next_episode_to_air;
                    var air = next.air_date ? new Date(next.air_date) : null;
                    if (air && !isNaN(air)) {
                        var days = Math.ceil((air - new Date()) / 86400000);
                        var txt = days > 0 ? `через ${days} дн.` : (days === 0 ? 'сегодня' : 'вышло');
                        var st = movie.status || '';
                        var statusTxt = {
                            'Returning Series': 'продолжается',
                            'Ended': 'завершён',
                            'Canceled': 'отменён'
                        }[st] || st.toLowerCase();

                        view.append(`
                            <div class="next-ep-info">
                                <div class="status">${statusTxt}</div>
                                <div class="days">${txt}</div>
                            </div>
                        `);
                    }
                }
            });
        }

        updateCards();

        new MutationObserver(() => setTimeout(updateCards, 200))
            .observe(document.body, {childList:true, subtree:true});
    }

    // ────────────────────────────────────────────────
    //  Стили для новых элементов на карточках
    // ────────────────────────────────────────────────

    function injectCardStyles() {
        $('<style id="interface-mod-card-enhance">').html(`
            .season-badge {
                position: absolute;
                top: 8px; left: 8px;
                background: rgba(0,0,0,0.7);
                color: #fff;
                font-size: 11px;
                font-weight: bold;
                padding: 2px 7px;
                border-radius: 4px;
                z-index: 13;
            }
            .card-rating-badge {
                position: absolute;
                top: 8px; right: 8px;
                background: rgba(0,0,0,0.75);
                color: #ffeb3b;
                font-size: 12px;
                font-weight: bold;
                width: 32px; height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 13;
                box-shadow: 0 0 8px rgba(255,235,59,0.4);
            }
            .qy-label {
                position: absolute;
                bottom: 8px; right: 8px;
                background: rgba(0,0,0,0.65);
                color: #8bc34a;
                font-size: 10px;
                padding: 3px 7px;
                border-radius: 4px;
                z-index: 12;
            }
            .country-label {
                position: absolute;
                bottom: 8px; left: 8px;
                background: rgba(0,0,0,0.6);
                color: white;
                font-size: 11px;
                padding: 3px 7px;
                border-radius: 4px;
                z-index: 12;
            }
            .country-label:empty { display:none; }
            .next-ep-info {
                position: absolute;
                bottom: 8px; left: 8px; right: 8px;
                background: rgba(0,0,0,0.75);
                color: white;
                font-size: 10px;
                padding: 5px 7px;
                border-radius: 5px;
                text-align: center;
                line-height: 1.3;
                z-index: 12;
            }
            .next-ep-info .status { font-weight: bold; }
            .next-ep-info .days { color: #ffeb3b; }

            /* Hover scale */
            .card__view {
                transition: transform 0.16s ease-out;
            }
            .card.focus .card__view,
            .card:hover .card__view {
                transform: scale(${InterFaceMod.settings.card_hover_scale});
                z-index: 25;
            }
        `).appendTo('head');
    }

    // ────────────────────────────────────────────────
    //  Цветные рейтинги, статусы, возраст (было раньше)
    // ────────────────────────────────────────────────

    function colorizeRatingsAndElements() {
        if (InterFaceMod.settings.colored_ratings) {
            function colorVote(el) {
                var v = parseFloat($(el).text().replace(/[^0-9.]/g,''));
                if (isNaN(v)) return;
                var color = v >= 8 ? '#4caf50' :
                            v >= 6 ? '#2196f3' :
                            v >= 4 ? '#ff9800' : '#f44336';
                $(el).css('color', color);
            }

            $('.card__vote, .full-start__rate, .full-start-new__rate').each((i,el)=>colorVote(el));

            new MutationObserver(()=>setTimeout(()=>{
                $('.card__vote, .full-start__rate, .full-start-new__rate').each((i,el)=>colorVote(el));
            },100)).observe(document.body,{childList:true,subtree:true});
        }

        if (InterFaceMod.settings.colored_elements) {
            // статусы сериалов
            function colorStatus(el) {
                var t = $(el).text().trim().toLowerCase();
                var bg, col;
                if (t.includes('заверш') || t.includes('ended'))        {bg='#4caf50'; col='white';}
                else if (t.includes('отмен') || t.includes('canceled')) {bg='#f44336'; col='white';}
                else if (t.includes('выход') || t.includes('ongoing'))  {bg='#ff9800'; col='black';}
                else if (t.includes('произв') || t.includes('production')){bg='#2196f3';col='white';}
                else return;

                $(el).css({background:bg, color:col, borderRadius:'0.3em', padding:'0.2em 0.5em'});
            }
            $('.full-start__status').each((i,el)=>colorStatus(el));

            // возраст
            function colorAge(el) {
                var t = $(el).text().trim();
                var bg, col='white';
                if (/0\+|g|tv-y/i.test(t))           bg='#4caf50';
                else if (/6\+|7\+|pg/i.test(t))      bg='#2196f3';
                else if (/12\+|14\+|pg-13/i.test(t)) bg='#ffeb3b'; col='black';
                else if (/16\+|r/i.test(t))          bg='#ff9800';
                else if (/18\+|nc-17/i.test(t))      bg='#f44336';
                else return;

                $(el).css({background:bg, color:col, borderRadius:'0.3em', padding:'0.2em 0.5em'});
            }
            $('.full-start__pg').each((i,el)=>colorAge(el));
        }
    }

    // ────────────────────────────────────────────────
    //  Темы (оставил как было, только обновил)
    // ────────────────────────────────────────────────

    function applyTheme() {
        $('#interface_mod_theme').remove();
        var th = InterFaceMod.settings.theme;
        if (th === 'default') return;

        var css = {
            neon: `body{background:linear-gradient(135deg,#0d0221,#1f0c47);}.menu__item.focus,.full-start__button.focus{background:linear-gradient(#ff00ff,#00ffff);box-shadow:0 0 20px #ff00ff66;}`,
            // ... остальные темы по желанию, для краткости оставил только одну
        }[th] || '';

        $('<style id="interface_mod_theme">').html(css).appendTo('head');
    }

    // ────────────────────────────────────────────────
    //  Инициализация настроек и запуск
    // ────────────────────────────────────────────────

    function startPlugin() {
        // Загружаем сохранённые настройки
        Object.keys(InterFaceMod.settings).forEach(k => {
            if (Lampa.Storage.has(k)) {
                InterFaceMod.settings[k] = Lampa.Storage.get(k);
            }
        });

        // Регистрация в меню
        Lampa.SettingsApi.addComponent({
            component: 'season_info',
            name: 'Интерфейс MOD',
            icon: '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z" fill="currentColor"/></svg>'
        });

        // Добавляем все настройки
        const params = [
            {name:'seasons_info_mode', type:'select', values:{none:'Выкл', aired:'Актуально', total:'Всего'}, default:'aired', field:{name:'Инфо о сезонах'}},
            {name:'label_position', type:'select', values:{'top-right':'↑→','top-left':'↑←','bottom-right':'↓→','bottom-left':'↓←'}, default:'top-right', field:{name:'Позиция лейбла сезонов'}},
            {name:'show_buttons', type:'trigger', default:true, field:{name:'Все кнопки в ряд'}},
            {name:'show_movie_type', type:'trigger', default:true, field:{name:'Фильм / Сериал лейблы'}},
            {name:'colored_ratings', type:'trigger', default:true, field:{name:'Цветные рейтинги'}},
            {name:'colored_elements', type:'trigger', default:true, field:{name:'Цветные статусы и возраст'}},
            {name:'card_season_label', type:'trigger', default:true, field:{name:'S2/S3 на карточке'}},
            {name:'card_next_episode_info', type:'trigger', default:true, field:{name:'Дней до серии'}},
            {name:'card_quality_year', type:'trigger', default:true, field:{name:'Качество • Год'}},
            {name:'card_country_mode', type:'select', values:{none:'Выкл', flag:'Флаг', text:'Страна'}, default:'flag', field:{name:'Страна на карточке'}},
            {name:'card_rating_on_poster', type:'trigger', default:true, field:{name:'Рейтинг на постере'}},
            {name:'card_hover_scale', type:'select', values:{'1.10':'1.10','1.15':'1.15','1.18':'1.18','1.25':'1.25','1.30':'1.30'}, default:'1.18', field:{name:'Увеличение карточки'}}
        ];

        params.forEach(p => {
            Lampa.SettingsApi.addParam({
                component: 'season_info',
                param: {name: p.name, type: p.type, values: p.values, default: p.default},
                field: p.field,
                onChange: v => {
                    InterFaceMod.settings[p.name] = v;
                    Lampa.Storage.set(p.name, v);
                    if (p.name === 'theme') applyTheme();
                    if (['card_hover_scale'].includes(p.name)) {
                        $('#interface-mod-card-enhance').remove();
                        injectCardStyles();
                    }
                }
            });
        });

        // Запускаем фичи
        addSeasonInfo();
        showAllButtons();
        addContentTypeLabels();
        enhanceCardPosters();
        injectCardStyles();
        colorizeRatingsAndElements();
        applyTheme();

        console.log('[Interface MOD v'+InterFaceMod.version+'] загружен');
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', e => { if (e.type === 'ready') startPlugin(); });

    window.interface_mod = InterFaceMod;
})();
