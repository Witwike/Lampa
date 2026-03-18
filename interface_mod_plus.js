(function () {
    'use strict';

    var InterFaceMod = {
        name: 'interface_mod',
        version: '2.2.1',
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
            colored_elements: true
        }
    };

    // ──────────────────────────────────────────────────────────────
    // 1. Информация о сезонах на постере полной карточки (оставил почти как было)
    // ──────────────────────────────────────────────────────────────
    function addSeasonInfo() {
        Lampa.Listener.follow('full', function (data) {
            if (data.type !== 'complite' || !data.data.movie?.number_of_seasons) return;
            if (InterFaceMod.settings.seasons_info_mode === 'none') return;

            var movie = data.data.movie;
            var status = movie.status || '';
            var totalSeasons = movie.number_of_seasons || 0;
            var totalEpisodes = movie.number_of_episodes || 0;

            var airedSeasons = 0;
            var airedEpisodes = 0;
            var currentDate = new Date();

            if (movie.seasons) {
                movie.seasons.forEach(function(season) {
                    if (season.season_number === 0) return;
                    if (season.air_date) {
                        var airDate = new Date(season.air_date);
                        if (airDate <= currentDate) {
                            airedSeasons++;
                            if (season.episode_count) airedEpisodes += season.episode_count;
                        }
                    }
                });
            }

            if (movie.last_episode_to_air?.season_number) {
                airedSeasons = Math.max(airedSeasons, movie.last_episode_to_air.season_number);
            }

            if (airedSeasons === 0) airedSeasons = totalSeasons;
            if (airedEpisodes === 0) airedEpisodes = totalEpisodes;

            function plural(n, one, two, five) {
                n = Math.abs(n) % 100;
                if (n >= 5 && n <= 20) return five;
                n %= 10;
                if (n === 1) return one;
                if (n >= 2 && n <= 4) return two;
                return five;
            }

            function getStatusText(s) {
                const map = {
                    'Ended': 'Завершён',
                    'Canceled': 'Отменён',
                    'Returning Series': 'Выходит',
                    'In Production': 'В производстве'
                };
                return map[s] || s || '—';
            }

            var displaySeasons = InterFaceMod.settings.seasons_info_mode === 'aired' ? airedSeasons : totalSeasons;
            var displayEpisodes = InterFaceMod.settings.seasons_info_mode === 'aired' ? airedEpisodes : totalEpisodes;
            var seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
            var episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');

            var text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
            var isCompleted = (status === 'Ended' || status === 'Canceled');
            var bgColor = isCompleted ? 'rgba(46,204,113,0.85)' : 'rgba(244,67,54,0.85)';

            if (!isCompleted && InterFaceMod.settings.seasons_info_mode === 'aired' && totalEpisodes > airedEpisodes && totalEpisodes > 0) {
                text += ' из ' + totalEpisodes;
            }

            var infoElement = $('<div class="season-info-label"></div>').text(text);
            if (isCompleted) {
                infoElement.append($('<div></div>').text(getStatusText(status)));
            }

            var positionStyles = {
                'top-right':   { top: '1.4em', right: '-0.8em', left: 'auto', bottom: 'auto' },
                'top-left':    { top: '1.4em', left: '-0.8em', right: 'auto', bottom: 'auto' },
                'bottom-right':{ bottom: '1.4em', right: '-0.8em', top: 'auto', left: 'auto' },
                'bottom-left': { bottom: '1.4em', left: '-0.8em', top: 'auto', right: 'auto' }
            };

            var pos = InterFaceMod.settings.label_position || 'top-right';
            var styles = {
                ...{
                    'background-color': bgColor,
                    'color': 'white',
                    'padding': '0.5em 0.8em',
                    'border-radius': '0.4em',
                    'font-size': '0.82em',
                    'z-index': '999',
                    'text-align': 'center',
                    'white-space': 'nowrap',
                    'line-height': '1.25',
                    'backdrop-filter': 'blur(3px)',
                    'box-shadow': '0 3px 8px rgba(0,0,0,0.35)'
                },
                ...positionStyles[pos]
            };

            infoElement.css(styles);

            setTimeout(() => {
                var poster = $(data.object.activity.render()).find('.full-start-new__poster, .full-start__poster');
                if (poster.length) {
                    poster.css('position', 'relative').append(infoElement);
                }
            }, 120);
        });
    }

    // ──────────────────────────────────────────────────────────────
    // 2. Показ всех кнопок (оставил вашу логику, но добавил надёжные селекторы)
    // ──────────────────────────────────────────────────────────────
    function showAllButtons() {
        if (!$('#interface_mod_buttons_style').length) {
            $('<style id="interface_mod_buttons_style"></style>').html(`
                .full-start-new__buttons, .full-start__buttons, .buttons-container, .buttons--container {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 10px !important;
                    padding: 8px 0 !important;
                }
            `).appendTo('head');
        }

        // ... (ваша полная логика reorganizeButtons, MutationObserver и т.д. остаётся без изменений)
        // Если хотите — могу полностью переписать этот блок более стабильно, но пока оставляю как было
    }

    // ──────────────────────────────────────────────────────────────
    // 3. НОВЫЙ расширенный лейбл на карточках (то, что на скринах)
    // ──────────────────────────────────────────────────────────────
    function changeMovieTypeLabels() {
        if (!$('#movie_type_rich_styles').length) {
            $('<style id="movie_type_rich_styles"></style>').html(`
                .rich-card-label {
                    position: absolute;
                    top: 0.9em;
                    left: -0.5em;
                    z-index: 20;
                    background: rgba(0,0,0,0.78);
                    color: white;
                    padding: 0.45em 0.65em;
                    border-radius: 0.4em;
                    font-size: 0.76em;
                    line-height: 1.18;
                    max-width: 158px;
                    box-shadow: 0 2px 9px rgba(0,0,0,0.5);
                    backdrop-filter: blur(3.5px);
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    pointer-events: none;
                }
                .rich-card-label .type {
                    display: inline-block;
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-weight: bold;
                    font-size: 0.84em;
                }
                .rich-card-label .film  { background: #27ae60; }
                .rich-card-label .serial { background: #2980b9; }
                .rich-card-label .year,
                .rich-card-label .seasons { opacity: 0.93; font-size: 0.88em; }
                .rich-card-label .rating { font-weight: 700; font-size: 0.94em; }
                .rich-card-label .next-ep { font-size: 0.82em; color: #f1c40f; font-style: italic; }
            `).appendTo('head');
        }

        function plural(n, one, two, five) {
            n = Math.abs(n) % 100;
            if (n >= 5 && n <= 20) return five;
            n %= 10;
            if (n === 1) return one;
            if (n >= 2 && n <= 4) return two;
            return five;
        }

        function getRatingColor(v) {
            if (v >= 8) return '#4ade80';
            if (v >= 6) return '#60a5fa';
            if (v >= 4) return '#fb923c';
            return '#f87171';
        }

        function addRichLabel(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            if ($(card).find('.rich-card-label').length) return;

            var view = $(card).find('.card__view, .poster__view, .card-poster');
            if (!view.length) return;

            var data = {};
            try {
                let dc = $(card).attr('data-card') || $(card).attr('data-item');
                if (dc) data = JSON.parse(dc);
                data = { ...data, ...$(card).data() };
            } catch(e) {}

            var isSerial = !!(
                data.type === 'tv' || data.card_type === 'tv' ||
                data.seasons || data.number_of_seasons > 0 ||
                data.season_count > 0 || $(card).hasClass('card--tv') ||
                $(card).find('.card__type').text().match(/сериал|сезон|серии/i)
            );

            var typeText  = isSerial ? 'Сериал' : 'Фильм';
            var typeClass = isSerial ? 'serial' : 'film';

            var year = data.year ||
                       (data.release_date  ? data.release_date.substr(0,4)  : '') ||
                       (data.first_air_date ? data.first_air_date.substr(0,4) : '') || '—';

            var voteRaw = data.vote_average || data.vote || data.rating || data.imdb_rating || 0;
            var vote = parseFloat(voteRaw);
            var ratingText = vote > 0 ? vote.toFixed(1) : '';

            var seasonsText = '';
            if (isSerial) {
                let s = data.number_of_seasons || data.season_count || 0;
                let e = data.number_of_episodes || data.episode_count || 0;
                if (s > 0) {
                    seasonsText = s + ' ' + plural(s, 'сезон', 'сезона', 'сезонов');
                    if (e > 0) seasonsText += ' • ' + e + ' сер.';
                }
            }

            var nextText = '';
            if (isSerial && data.next_episode_to_air?.air_date) {
                let d = new Date(data.next_episode_to_air.air_date);
                if (!isNaN(d)) {
                    nextText = 'След. ' + d.getDate().toString().padStart(2,'0') + '.' +
                               (d.getMonth()+1).toString().padStart(2,'0') + '.' + d.getFullYear();
                }
            }

            var $label = $('<div class="rich-card-label"></div>');

            $label.append($('<span class="type ' + typeClass + '"></span>').text(typeText));
            $label.append($('<span class="year"></span>').text(year));

            if (ratingText) {
                var $rat = $('<span class="rating"></span>').text(ratingText);
                $rat.css('color', getRatingColor(vote));
                $label.append($rat);
            }

            if (seasonsText) $label.append($('<span class="seasons"></span>').text(seasonsText));
            if (nextText)    $label.append($('<span class="next-ep"></span>').text(nextText));

            view.css('position', 'relative').append($label);
        }

        function scanCards() {
            $('.card, .card-poster, .poster').each((i, el) => addRichLabel(el));
        }

        var obs = new MutationObserver(() => setTimeout(scanCards, 60));
        obs.observe(document.body, { childList: true, subtree: true, attributes: true });

        scanCards();
        setInterval(scanCards, 4000); // запасной вариант
    }

    // ──────────────────────────────────────────────────────────────
    // Инициализация (остальные ваши функции — темы, цветные элементы и т.д. — вставьте сюда)
    // ──────────────────────────────────────────────────────────────
    function startPlugin() {
        // ... ваша регистрация настроек Lampa.SettingsApi ...

        // Загрузка настроек
        InterFaceMod.settings.show_movie_type   = !!Lampa.Storage.get('season_info_show_movie_type', true);
        InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get('seasons_info_mode', 'aired');
        InterFaceMod.settings.label_position    = Lampa.Storage.get('label_position', 'top-right');
        InterFaceMod.settings.show_buttons      = !!Lampa.Storage.get('show_buttons', true);
        // ... остальные

        InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';

        if (InterFaceMod.settings.enabled) addSeasonInfo();
        showAllButtons();
        changeMovieTypeLabels();  // ← новый расширенный лейбл

        // ... вызов ваших applyTheme, colorizeSeriesStatus и т.д.
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', e => { if (e.type === 'ready') startPlugin(); });
    }

    Lampa.Manifest.plugins = {
        name: 'Интерфейс мод',
        version: InterFaceMod.version,
        description: 'Расширенные лейблы на карточках + сезоны + кнопки'
    };

    window.season_info = InterFaceMod;
})();
