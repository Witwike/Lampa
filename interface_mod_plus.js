(function () {
    'use strict';

    // Основной объект плагина
    var InterFaceMod = {
        name: 'interface_mod',
        version: '2.2.1',  // обновил версию для ясности
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
    // 1. Информация о сезонах на постере полной карточки
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

            if (!isCompleted && InterFaceMod.settings.seasons_info_mode === 'aired' && totalEpisodes > airedEpisodes) {
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
    // 2. Показ всех кнопок + их сортировка
    // ──────────────────────────────────────────────────────────────
    function showAllButtons() {
        // Базовые стили для контейнера кнопок
        if (!$('#interface_mod_buttons_style').length) {
            $('<style id="interface_mod_buttons_style"></style>').html(`
                .full-start-new__buttons, .full-start__buttons, .buttons-container {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 10px !important;
                    padding: 8px 0 !important;
                }
            `).appendTo('head');
        }

        function findButtonsContainer(el) {
            return el.find('.full-start-new__buttons, .full-start__buttons, .buttons-container, .buttons--container').first();
        }

        function reorganizeButtons(container) {
            if (!container.length) return;

            var allButtons = [];
            var selectors = [
                '.full-start__button', '.button', '[data-action]'
            ];

            selectors.forEach(sel => {
                container.find(sel).each(function() {
                    var $btn = $(this);
                    if ($btn.text().trim() && !$btn.hasClass('organized')) {
                        allButtons.push($btn[0]);
                        $btn.addClass('organized');
                    }
                });
            });

            if (!allButtons.length) return;

            var categories = { online: [], torrent: [], trailer: [], other: [] };

            allButtons.forEach(btn => {
                var $b = $(btn);
                var text = $b.text().trim().toLowerCase();
                var cls = ($b.attr('class') || '').toLowerCase();

                if (text.includes('смотр') || text.includes('online') || cls.includes('play') || cls.includes('online')) {
                    categories.online.push(btn);
                } else if (text.includes('торрент') || cls.includes('torrent') || cls.includes('download')) {
                    categories.torrent.push(btn);
                } else if (text.includes('трейлер') || cls.includes('trailer') || cls.includes('video')) {
                    categories.trailer.push(btn);
                } else {
                    categories.other.push(btn);
                }
            });

            var order = ['online', 'torrent', 'trailer', 'other'];
            container.empty();

            order.forEach(cat => {
                categories[cat].forEach(btn => container.append(btn));
            });
        }

        Lampa.Listener.follow('full', e => {
            if (e.type !== 'complite' || !InterFaceMod.settings.show_buttons) return;

            setTimeout(() => {
                var render = e.object?.activity?.render?.();
                if (!render) return;
                var cont = findButtonsContainer($(render));
                if (cont.length) reorganizeButtons(cont);
            }, 200);
        });
    }

    // ──────────────────────────────────────────────────────────────
    // 3. Расширенный лейбл на карточках (тип + год + рейтинг + сезоны + следующая серия)
    // ──────────────────────────────────────────────────────────────
    function changeMovieTypeLabels() {
        if (!$('#movie_type_styles').length) {
            $('<style id="movie_type_styles"></style>').html(`
                .content-label {
                    position: absolute;
                    top: 1.1em;
                    left: -0.6em;
                    z-index: 15;
                    background: rgba(0,0,0,0.78);
                    color: white;
                    padding: 0.5em 0.7em;
                    border-radius: 0.45em;
                    font-size: 0.78em;
                    line-height: 1.2;
                    max-width: 160px;
                    box-shadow: 0 2px 9px rgba(0,0,0,0.45);
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    backdrop-filter: blur(3px);
                }
                .content-label .type-badge {
                    display: inline-block;
                    padding: 2px 7px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 0.85em;
                }
                .content-label .serial { background: #3498db; }
                .content-label .movie  { background: #2ecc71; }
                .content-label .year,
                .content-label .season { opacity: 0.92; font-size: 0.9em; }
                .content-label .rating { font-weight: bold; font-size: 0.96em; }
                .content-label .next   { font-size: 0.84em; color: #ffeb3b; font-style: italic; }
            `).appendTo('head');
        }

        $('body').attr('data-movie-labels', InterFaceMod.settings.show_movie_type ? 'on' : 'off');

        function plural(n, one, two, five) {
            n = Math.abs(n) % 100;
            if (n >= 5 && n <= 20) return five;
            n %= 10;
            if (n === 1) return one;
            if (n >= 2 && n <= 4) return two;
            return five;
        }

        function getRatingColor(vote) {
            if (vote >= 8) return '#4ade80';
            if (vote >= 6) return '#60a5fa';
            if (vote >= 4) return '#fb923c';
            return '#f87171';
        }

        function addLabelToCard(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            if ($(card).find('.content-label').length) return;

            var view = $(card).find('.card__view');
            if (!view.length) return;

            var data = {};
            try {
                let dc = $(card).attr('data-card');
                if (dc) data = JSON.parse(dc);
                data = { ...data, ...$(card).data() };
            } catch(e) {}

            var is_tv = !!(
                data.type === 'tv' || data.card_type === 'tv' ||
                data.seasons || data.number_of_seasons > 0 ||
                data.season_count > 0 || $(card).hasClass('card--tv')
            );

            var typeText  = is_tv ? 'Сериал' : 'Фильм';
            var typeClass = is_tv ? 'serial' : 'movie';

            var year = data.year ||
                       (data.release_date  ? data.release_date.substring(0,4)  : '') ||
                       (data.first_air_date ? data.first_air_date.substring(0,4) : '') || '—';

            var vote = parseFloat(data.vote_average || data.vote || data.rating || 0);
            var rating = vote > 0 ? vote.toFixed(1) : '';

            var seasonInfo = '';
            if (is_tv) {
                let s = data.number_of_seasons || data.season_count || 0;
                let e = data.number_of_episodes || data.episode_count || 0;
                if (s > 0) {
                    seasonInfo = s + ' ' + plural(s, 'сезон', 'сезона', 'сезонов');
                    if (e > 0) seasonInfo += ' • ' + e + ' сер.';
                }
            }

            var nextInfo = '';
            if (is_tv && data.next_episode_to_air?.air_date) {
                let d = new Date(data.next_episode_to_air.air_date);
                nextInfo = 'След. серия: ' +
                           d.getDate().toString().padStart(2,'0') + '.' +
                           (d.getMonth()+1).toString().padStart(2,'0') + '.' +
                           d.getFullYear();
            }

            var $label = $('<div class="content-label"></div>');

            $label.append($('<span class="type-badge ' + typeClass + '"></span>').text(typeText));
            $label.append($('<span class="year"></span>').text(year));

            if (rating) {
                var $r = $('<span class="rating"></span>').text(rating);
                $r.css('color', getRatingColor(vote));
                $label.append($r);
            }

            if (seasonInfo) $label.append($('<span class="season"></span>').text(seasonInfo));
            if (nextInfo)   $label.append($('<span class="next"></span>').text(nextInfo));

            view.css('position','relative').append($label);
        }

        function processCards() {
            if (!InterFaceMod.settings.show_movie_type) return;
            $('.card').each((i, el) => addLabelToCard(el));
        }

        var observer = new MutationObserver(() => setTimeout(processCards, 80));
        observer.observe(document.body, { childList: true, subtree: true });

        processCards();
        setInterval(processCards, 3000);
    }

    // ──────────────────────────────────────────────────────────────
    // Остальные функции (темы, цветные рейтинги, статусы и т.д.)
    // ──────────────────────────────────────────────────────────────
    // ... (оставляем как было в вашем исходном коде)
    // applyTheme, updateVoteColors, colorizeSeriesStatus, colorizeAgeRating и т.д.

    // ──────────────────────────────────────────────────────────────
    // Инициализация плагина
    // ──────────────────────────────────────────────────────────────
    function startPlugin() {
        // Регистрация в настройках Lampa
        Lampa.SettingsApi.addComponent({
            component: 'season_info',
            name: 'Интерфейс мод',
            icon: '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z"/></svg>'
        });

        // Здесь добавьте все ваши Lampa.SettingsApi.addParam({...}) как было раньше

        // Применение сохранённых настроек
        InterFaceMod.settings.show_movie_type   = Lampa.Storage.get('season_info_show_movie_type', true);
        InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get('seasons_info_mode', 'aired');
        InterFaceMod.settings.label_position    = Lampa.Storage.get('label_position', 'top-right');
        InterFaceMod.settings.show_buttons      = Lampa.Storage.get('show_buttons', true);
        // ... остальные настройки

        InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';

        // Запуск модулей
        if (InterFaceMod.settings.enabled)        addSeasonInfo();
        if (InterFaceMod.settings.show_buttons)   showAllButtons();
        changeMovieTypeLabels();  // ← расширенный лейбл на карточках

        // ... запуск тем, цветных рейтингов, статусов и т.д.
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', e => {
            if (e.type === 'ready') startPlugin();
        });
    }

    // Манифест плагина
    Lampa.Manifest.plugins = {
        name: 'Интерфейс мод',
        version: InterFaceMod.version,
        description: 'Расширенный интерфейс для Lampa с информацией на карточках'
    };

    window.season_info = InterFaceMod;
})();
