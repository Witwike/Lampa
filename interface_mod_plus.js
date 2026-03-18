(function () {
    'use strict';

    // Основной объект плагина
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

    // Вспомогательная функция склонения слов
    function plural(number, one, two, five) {
        let n = Math.abs(number);
        n %= 100;
        if (n >= 5 && n <= 20) return five;
        n %= 10;
        if (n === 1) return one;
        if (n >= 2 && n <= 4) return two;
        return five;
    }

    // Функция для добавления информации о сезонах и сериях на постер (в карточке фильма)
    function addSeasonInfo() {
        Lampa.Listener.follow('full', function (data) {
            if (data.type === 'complite' && data.data.movie.number_of_seasons) {
                if (InterFaceMod.settings.seasons_info_mode === 'none') return;
                
                var movie = data.data.movie;
                var status = movie.status;
                var totalSeasons = movie.number_of_seasons || 0;
                var totalEpisodes = movie.number_of_episodes || 0;
                
                var airedSeasons = 0;
                var airedEpisodes = 0;
                var currentDate = new Date();
                
                if (movie.seasons) {
                    movie.seasons.forEach(function(season) {
                        if (season.season_number === 0) return;
                        
                        var seasonAired = false;
                        var seasonEpisodes = 0;
                        
                        if (season.air_date) {
                            var airDate = new Date(season.air_date);
                            if (airDate <= currentDate) {
                                seasonAired = true;
                                airedSeasons++;
                            }
                        }
                        
                        if (season.episodes) {
                            season.episodes.forEach(function(episode) {
                                if (episode.air_date) {
                                    var epAirDate = new Date(episode.air_date);
                                    if (epAirDate <= currentDate) {
                                        seasonEpisodes++;
                                        airedEpisodes++;
                                    }
                                }
                            });
                        } else if (seasonAired && season.episode_count) {
                            seasonEpisodes = season.episode_count;
                            airedEpisodes += seasonEpisodes;
                        }
                    });
                } else if (movie.last_episode_to_air) {
                    airedSeasons = movie.last_episode_to_air.season_number || 0;
                    if (movie.seasons) {
                        var lastSeason = movie.last_episode_to_air.season_number;
                        var lastEpisode = movie.last_episode_to_air.episode_number;
                        airedEpisodes = 0;
                        movie.seasons.forEach(function(season) {
                            if (season.season_number === 0) return;
                            if (season.season_number < lastSeason) {
                                airedEpisodes += season.episode_count || 0;
                            } else if (season.season_number === lastSeason) {
                                airedEpisodes += lastEpisode;
                            }
                        });
                    }
                }
                
                if (airedSeasons === 0) airedSeasons = totalSeasons;
                if (airedEpisodes === 0) airedEpisodes = totalEpisodes;
                
                if (totalEpisodes > 0 && airedEpisodes > totalEpisodes) {
                    airedEpisodes = totalEpisodes;
                }
                
                var displaySeasons, displayEpisodes, seasonsText, episodesText;
                var isCompleted = (status === 'Ended' || status === 'Canceled');
                var bgColor = isCompleted ? 'rgba(33, 150, 243, 0.8)' : 'rgba(244, 67, 54, 0.8)';
                
                if (InterFaceMod.settings.seasons_info_mode === 'aired') {
                    displaySeasons = airedSeasons;
                    displayEpisodes = airedEpisodes;
                    seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
                    episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');
                } else if (InterFaceMod.settings.seasons_info_mode === 'total') {
                    displaySeasons = totalSeasons;
                    displayEpisodes = totalEpisodes;
                    seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
                    episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');
                } else {
                    return;
                }
                
                var infoElement = $('<div class="season-info-label"></div>');
                
                if (isCompleted) {
                    var seasonEpisodeText = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
                    var statusText = 'Завершён';
                    if (status === 'Canceled') statusText = 'Отменён';
                    
                    infoElement.append($('<div></div>').text(seasonEpisodeText));
                    infoElement.append($('<div></div>').text(statusText));
                } else {
                    var text = '';
                    if (InterFaceMod.settings.seasons_info_mode === 'aired') {
                        if (totalEpisodes > 0 && airedEpisodes < totalEpisodes) {
                             text = displaySeasons + ' ' + seasonsText + ' ' + airedEpisodes + ' ' + episodesText + ' из ' + totalEpisodes;
                        } else {
                             text = displaySeasons + ' ' + seasonsText + ' ' + airedEpisodes + ' ' + episodesText;
                        }
                    } else {
                        text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
                    }
                    infoElement.append($('<div></div>').text(text));
                }
                
                var position = InterFaceMod.settings.label_position || 'top-right';
                var positions = {
                    'top-right': { 'top': '1.4em', 'right': '-0.8em', 'bottom': 'auto', 'left': 'auto' },
                    'top-left': { 'top': '1.4em', 'left': '-0.8em', 'bottom': 'auto', 'right': 'auto' },
                    'bottom-right': { 'bottom': '1.4em', 'right': '-0.8em', 'top': 'auto', 'left': 'auto' },
                    'bottom-left': { 'bottom': '1.4em', 'left': '-0.8em', 'top': 'auto', 'right': 'auto' }
                };
                var posStyle = positions[position] || positions['top-right'];
                
                infoElement.css({
                    'position': 'absolute',
                    'background-color': bgColor,
                    'color': 'white',
                    'padding': '0.4em 0.6em',
                    'border-radius': '0.3em',
                    'font-size': '0.8em',
                    'z-index': '999',
                    'text-align': 'center',
                    'white-space': 'nowrap',
                    'line-height': '1.2em',
                    'backdrop-filter': 'blur(2px)',
                    'box-shadow': '0 2px 5px rgba(0, 0, 0, 0.2)'
                }).css(posStyle);
                
                setTimeout(function() {
                    var poster = $(data.object.activity.render()).find('.full-start-new__poster');
                    if (!poster.length) poster = $(data.object.activity.render()).find('.full-start__poster');
                    if (poster.length) {
                        poster.css('position', 'relative');
                        poster.append(infoElement);
                    }
                }, 100);
            }
        });
    }

    // Функция для отображения всех кнопок в карточке
    function showAllButtons() {
        var buttonStyle = document.createElement('style');
        buttonStyle.id = 'interface_mod_buttons_style';
        buttonStyle.innerHTML = `
            .full-start-new__buttons, .full-start__buttons {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 10px !important;
            }
        `;
        document.head.appendChild(buttonStyle);
        
        // Безопасное переопределение через Listener вместо подмены Lampa.FullCard.build
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object && e.object.activity) {
                if (InterFaceMod.settings.show_buttons) {
                    setTimeout(function() {
                        var fullContainer = e.object.activity.render();
                        var targetContainer = fullContainer.find('.full-start-new__buttons');
                        if (!targetContainer.length) targetContainer = fullContainer.find('.full-start__buttons');
                        if (!targetContainer.length) targetContainer = fullContainer.find('.buttons-container');
                        if (!targetContainer.length) return;
                        
                        targetContainer.css({
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '10px'
                        });
                        
                        var allButtons = [];
                        var buttonSelectors = [
                            '.buttons--container .full-start__button',
                            '.full-start-new__buttons .full-start__button', 
                            '.full-start__buttons .full-start__button',
                            '.buttons-container .button',
                            '.full-start-new__buttons .button',
                            '.full-start__buttons .button'
                        ];
                        
                        buttonSelectors.forEach(function(selector) {
                            fullContainer.find(selector).each(function() {
                                allButtons.push(this);
                            });
                        });
                        
                        if (allButtons.length === 0) return;
                        
                        var categories = { online: [], torrent: [], trailer: [], other: [] };
                        var addedButtonTexts = {};
                        
                        $(allButtons).each(function() {
                            var button = this;
                            var buttonText = $(button).text().trim();
                            var className = button.className || '';
                            
                            if (!buttonText || addedButtonTexts[buttonText]) return;
                            addedButtonTexts[buttonText] = true;
                            
                            if (className.includes('online')) categories.online.push(button);
                            else if (className.includes('torrent')) categories.torrent.push(button);
                            else if (className.includes('trailer')) categories.trailer.push(button);
                            else categories.other.push(button);
                        });
                        
                        var buttonSortOrder = ['online', 'torrent', 'trailer', 'other'];
                        
                        var needToggle = Lampa.Controller.enabled().name === 'full_start';
                        if (needToggle) Lampa.Controller.toggle('settings_component');
                        
                        // Переносим кнопки в нужном порядке
                        buttonSortOrder.forEach(function(category) {
                            categories[category].forEach(function(button) {
                                targetContainer.append(button);
                            });
                        });
                        
                        if (needToggle) {
                            setTimeout(function() {
                                Lampa.Controller.toggle('full_start');
                            }, 100);
                        }
                    }, 300);
                }
            }
        });
    }

    // Функция для изменения лейблов TV и добавления детальной информации на карточку
    function changeMovieTypeLabels() {
        var styleTag = $('<style id="movie_type_styles"></style>').html(`
            /* Скрываем стандартный лейбл TV */
            body[data-movie-labels="on"] .card--tv .card__type {
                display: none !important;
            }

            /* Контейнер для всей информации поверх постера */
            .card-info-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 60%, transparent 100%);
                padding: 2.5em 0.6em 0.6em 0.6em;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                z-index: 10;
                pointer-events: none;
                min-height: 45%;
            }

            /* Блок с годом и качеством */
            .card-meta-row {
                display: flex;
                align-items: center;
                gap: 0.4em;
                margin-bottom: 0.3em;
                font-size: 0.75em;
            }

            .meta-badge {
                background-color: rgba(255, 255, 255, 0.2);
                color: #fff;
                padding: 0.2em 0.5em;
                border-radius: 0.2em;
                text-shadow: 0 1px 1px rgba(0,0,0,0.5);
            }

            .meta-badge--quality {
                background-color: #2196f3;
                font-weight: bold;
                text-transform: uppercase;
            }

            /* Лейбл СЕРИАЛ / ФИЛЬМ */
            .content-label {
                position: absolute;
                top: 0.5em !important;
                right: 0.5em !important;
                left: auto !important;
                color: white !important;
                padding: 0.3em 0.6em !important;
                border-radius: 0.3em !important;
                font-size: 0.7em !important;
                font-weight: bold;
                z-index: 11 !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            
            .serial-label { background-color: #3498db !important; }
            .movie-label { background-color: #2ecc71 !important; }

            /* Информация о сериале */
            .series-status-info {
                font-size: 0.75em;
                color: #fff;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                line-height: 1.3;
            }
            
            .series-status-info span { display: block; }
            .status-highlight {
                color: #ffeb3b;
                font-weight: bold;
            }
        `);
        $('head').append(styleTag);
        
        if (InterFaceMod.settings.show_movie_type) $('body').attr('data-movie-labels', 'on');
        else $('body').attr('data-movie-labels', 'off');
        
        function formatDateLeft(dateStr) {
            if (!dateStr) return '';
            var date = new Date(dateStr);
            var now = new Date();
            var diff = date - now;
            if (diff < 0) return '';
            var days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return 'сегодня';
            if (days === 1) return 'завтра';
            return 'через ' + days + ' ' + plural(days, 'день', 'дня', 'дней');
        }
        
        function addLabelToCard(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            
            // Избегаем повторной обработки
            if ($(card).find('.card-info-overlay').length) return;
            
            var view = $(card).find('.card__view');
            if (!view.length) return;
            
            // Сбор метаданных
            var metaData = {};
            try {
                var cardData = $(card).data('card') || $(card).data('card-data');
                if (cardData) {
                    metaData = (typeof cardData === 'string') ? JSON.parse(cardData) : cardData;
                }
            } catch (e) { /* ignore */ }

            var is_tv = false;
            if (metaData.type === 'tv' || metaData.type === 'serial' || $(card).hasClass('card--tv')) {
                is_tv = true;
            }
            
            var overlay = $('<div class="card-info-overlay"></div>');
            var metaRow = $('<div class="card-meta-row"></div>');
            
            // Год
            var year = metaData.year || 
                       (metaData.release_date ? metaData.release_date.substring(0, 4) : null) ||
                       (metaData.first_air_date ? metaData.first_air_date.substring(0, 4) : null);
            if (year) metaRow.append($('<div class="meta-badge"></div>').text(year));

            // Качество (скрыто, т.к. данные редко доступны в списке)
            // if (metaData.quality) { ... }

            var seriesInfoHtml = '';
            
            if (is_tv && metaData.number_of_seasons) {
                var seasons = metaData.number_of_seasons;
                var episodes = metaData.number_of_episodes;
                var status = metaData.status;
                
                var lines = [];
                
                if (status === 'Ended' || status === 'Canceled') {
                    lines.push('<span style="opacity: 0.8;">Сериал завершен</span>');
                } else if (status === 'Returning Series' || status === 'In Production') {
                    if (metaData.next_episode_to_air && metaData.next_episode_to_air.air_date) {
                        var nextDate = formatDateLeft(metaData.next_episode_to_air.air_date);
                        if (nextDate) {
                            lines.push('<span class="status-highlight">Новая серия ' + nextDate + '</span>');
                        }
                    }
                }

                var sText = plural(seasons, 'сезон', 'сезона', 'сезонов');
                var epText = '';
                if (episodes) {
                    epText = ', ' + episodes + ' ' + plural(episodes, 'серия', 'серии', 'серий');
                }
                lines.push('<span>' + seasons + ' ' + sText + epText + '</span>');

                seriesInfoHtml = '<div class="series-status-info">' + lines.join('') + '</div>';
            } else if (!is_tv && year) {
                // Для фильмов можно добавить продолжительность, если есть, но оставим чистым
            }

            overlay.append(metaRow);
            if (seriesInfoHtml) overlay.append(seriesInfoHtml);
            
            view.append(overlay);
            
            var typeLabel = $('<div class="content-label"></div>');
            if (is_tv) typeLabel.addClass('serial-label').text('Сериал');
            else typeLabel.addClass('movie-label').text('Фильм');
            view.append(typeLabel);
        }
        
        // Наблюдатель за изменениями (без setInterval)
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if ($(node).hasClass('card')) addLabelToCard(node);
                        else if ($(node).find('.card').length) {
                            $(node).find('.card').each(function() { addLabelToCard(this); });
                        }
                    }
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Первичная обработка
        $('.card').each(function() { addLabelToCard(this); });
        
        Lampa.Settings.listener.follow('change', function(e) {
            if (e.name === 'season_info_show_movie_type') {
                if (e.value) {
                    $('body').attr('data-movie-labels', 'on');
                    $('.card').each(function() { addLabelToCard(this); });
                } else {
                    $('body').attr('data-movie-labels', 'off');
                    $('.card-info-overlay, .content-label').remove();
                }
            }
        });
    }

    // Функция для применения тем
    function applyTheme(theme) {
        $('#interface_mod_theme').remove();
        if (theme === 'default') return;

        const style = $('<style id="interface_mod_theme"></style>');
        const themes = {
            neon: `body { background: linear-gradient(135deg, #0d0221 0%, #150734 50%, #1f0c47 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #ff00ff, #00ffff); color: #fff; box-shadow: 0 0 20px rgba(255, 0, 255, 0.4); text-shadow: 0 0 10px rgba(255, 255, 255, 0.5); border: none; } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #ff00ff; box-shadow: 0 0 20px #00ffff; } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #ff00ff, #00ffff); box-shadow: 0 0 15px rgba(255, 0, 255, 0.3); } .full-start__background { opacity: 0.7; filter: brightness(1.2) saturate(1.3); } .settings__content, .settings-input__content, .selectbox__content, .modal__content { background: rgba(15, 2, 33, 0.95); border: 1px solid rgba(255, 0, 255, 0.1); }`,
            dark_night: `body { background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #8a2387, #e94057, #f27121); color: #fff; box-shadow: 0 0 30px rgba(233, 64, 87, 0.3); animation: night-pulse 2s infinite; } @keyframes night-pulse { 0% { box-shadow: 0 0 20px rgba(233, 64, 87, 0.3); } 50% { box-shadow: 0 0 30px rgba(242, 113, 33, 0.3); } 100% { box-shadow: 0 0 20px rgba(138, 35, 135, 0.3); } } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #e94057; box-shadow: 0 0 30px rgba(242, 113, 33, 0.5); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #8a2387, #f27121); animation: night-pulse 2s infinite; } .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); } .settings__content, .settings-input__content, .selectbox__content, .modal__content { background: rgba(10, 10, 10, 0.95); border: 1px solid rgba(233, 64, 87, 0.1); box-shadow: 0 0 30px rgba(242, 113, 33, 0.1); }`,
            blue_cosmos: `body { background: linear-gradient(135deg, #0b365c 0%, #144d80 50%, #0c2a4d 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #12c2e9, #c471ed, #f64f59); color: #fff; box-shadow: 0 0 30px rgba(18, 194, 233, 0.3); animation: cosmos-pulse 2s infinite; } @keyframes cosmos-pulse { 0% { box-shadow: 0 0 20px rgba(18, 194, 233, 0.3); } 50% { box-shadow: 0 0 30px rgba(196, 113, 237, 0.3); } 100% { box-shadow: 0 0 20px rgba(246, 79, 89, 0.3); } } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #12c2e9; box-shadow: 0 0 30px rgba(196, 113, 237, 0.5); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #12c2e9, #f64f59); animation: cosmos-pulse 2s infinite; } .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); } .settings__content, .settings-input__content, .selectbox__content, .modal__content { background: rgba(11, 54, 92, 0.95); border: 1px solid rgba(18, 194, 233, 0.1); box-shadow: 0 0 30px rgba(196, 113, 237, 0.1); }`,
            sunset: `body { background: linear-gradient(135deg, #2d1f3d 0%, #614385 50%, #516395 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #ff6e7f, #bfe9ff); color: #2d1f3d; box-shadow: 0 0 15px rgba(255, 110, 127, 0.3); font-weight: bold; } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #ff6e7f; box-shadow: 0 0 15px rgba(255, 110, 127, 0.5); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #ff6e7f, #bfe9ff); color: #2d1f3d; } .full-start__background { opacity: 0.8; filter: saturate(1.2) contrast(1.1); }`,
            emerald: `body { background: linear-gradient(135deg, #1a2a3a 0%, #2C5364 50%, #203A43 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #43cea2, #185a9d); color: #fff; box-shadow: 0 4px 15px rgba(67, 206, 162, 0.3); border-radius: 5px; } .card.focus .card__view::after, .card.hover .card__view::after { border: 3px solid #43cea2; box-shadow: 0 0 20px rgba(67, 206, 162, 0.4); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #43cea2, #185a9d); } .full-start__background { opacity: 0.85; filter: brightness(1.1) saturate(1.2); } .settings__content, .settings-input__content, .selectbox__content, .modal__content { background: rgba(26, 42, 58, 0.98); border: 1px solid rgba(67, 206, 162, 0.1); }`,
            aurora: `body { background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #aa4b6b, #6b6b83, #3b8d99); color: #fff; box-shadow: 0 0 20px rgba(170, 75, 107, 0.3); transform: scale(1.02); transition: all 0.3s ease; } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #aa4b6b; box-shadow: 0 0 25px rgba(170, 75, 107, 0.5); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #aa4b6b, #3b8d99); transform: scale(1.05); } .full-start__background { opacity: 0.75; filter: contrast(1.1) brightness(1.1); }`,
            bywolf_mod: `body { background: linear-gradient(135deg, #090227 0%, #170b34 50%, #261447 100%); color: #ffffff; } .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus { background: linear-gradient(to right, #fc00ff, #00dbde); color: #fff; box-shadow: 0 0 30px rgba(252, 0, 255, 0.3); animation: cosmic-pulse 2s infinite; } @keyframes cosmic-pulse { 0% { box-shadow: 0 0 20px rgba(252, 0, 255, 0.3); } 50% { box-shadow: 0 0 30px rgba(0, 219, 222, 0.3); } 100% { box-shadow: 0 0 20px rgba(252, 0, 255, 0.3); } } .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #fc00ff; box-shadow: 0 0 30px rgba(0, 219, 222, 0.5); } .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #fc00ff, #00dbde); animation: cosmic-pulse 2s infinite; } .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); } .settings__content, .settings-input__content, .selectbox__content, .modal__content { background: rgba(9, 2, 39, 0.95); border: 1px solid rgba(252, 0, 255, 0.1); box-shadow: 0 0 30px rgba(0, 219, 222, 0.1); }`
        };

        style.html(themes[theme] || '');
        $('head').append(style);
    }

    // Функция для изменения цвета рейтинга
    function updateVoteColors() {
        if (!InterFaceMod.settings.colored_ratings) return;
        
        function applyColor(element) {
            const voteText = $(element).text().trim();
            const match = voteText.match(/(\d+(\.\d+)?)/);
            if (!match) return;
            const vote = parseFloat(match[0]);
            
            if (vote >= 0 && vote <= 3) $(element).css('color', "red");
            else if (vote > 3 && vote < 6) $(element).css('color', "orange");
            else if (vote >= 6 && vote < 8) $(element).css('color', "cornflowerblue");
            else if (vote >= 8 && vote <= 10) $(element).css('color', "lawngreen");
        }
        
        $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate").each(function() {
            applyColor(this);
        });
    }

    function setupVoteColorsObserver() {
        if (!InterFaceMod.settings.colored_ratings) return;
        setTimeout(updateVoteColors, 500);
        const observer = new MutationObserver(function() { setTimeout(updateVoteColors, 100); });
        observer.observe(document.body, { childList: true, subtree: true });
        
        Lampa.Listener.follow('full', function (data) {
            if (data.type === 'complite') setTimeout(updateVoteColors, 100);
        });
    }

    // Функция для изменения цвета статусов сериалов
    function colorizeSeriesStatus() {
        if (!InterFaceMod.settings.colored_elements) return;
        
        function applyColor(statusElement) {
            var statusText = $(statusElement).text().trim();
            var colors = {
                'completed': { bg: 'rgba(46, 204, 113, 0.8)', text: 'white' },
                'canceled': { bg: 'rgba(231, 76, 60, 0.8)', text: 'white' },
                'ongoing': { bg: 'rgba(243, 156, 18, 0.8)', text: 'black' },
                'production': { bg: 'rgba(52, 152, 219, 0.8)', text: 'white' }
            };
            
            var style = null;
            if (statusText.includes('Заверш') || statusText.includes('Ended')) style = colors.completed;
            else if (statusText.includes('Отмен') || statusText.includes('Canceled')) style = colors.canceled;
            else if (statusText.includes('Онгоинг') || statusText.includes('Выход') || statusText.includes('В процессе') || statusText.includes('Return')) style = colors.ongoing;
            else if (statusText.includes('производстве') || statusText.includes('Production')) style = colors.production;
            
            if (style) {
                $(statusElement).css({
                    'background-color': style.bg,
                    'color': style.text,
                    'border-radius': '0.3em',
                    'border': '0px',
                    'font-size': '1.3em',
                    'display': 'inline-block',
                    'padding': '0.1em 0.5em'
                });
            }
        }
        
        $('.full-start__status').each(function() { applyColor(this); });
        
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.addedNodes) {
                    $(m.addedNodes).find('.full-start__status').each(function() { applyColor(this); });
                    if ($(m.addedNodes).hasClass('full-start__status')) applyColor(m.addedNodes);
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Функция для изменения цвета возрастных ограничений
    function colorizeAgeRating() {
        if (!InterFaceMod.settings.colored_elements) return;
        
        function applyColor(ratingElement) {
            var ratingText = $(ratingElement).text().trim();
            var ageRatings = {
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
            for (var g in ageRatings) {
                if (ageRatings[g].includes(ratingText)) { group = g; break; }
            }
            
            if (group) {
                $(ratingElement).css({
                    'background-color': colors[group].bg,
                    'color': colors[group].text,
                    'border-radius': '0.3em',
                    'font-size': '1.3em',
                    'border': '0px',
                    'padding': '0.1em 0.4em'
                });
            }
        }
        
        $('.full-start__pg').each(function() { applyColor(this); });
        
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.addedNodes) {
                    $(m.addedNodes).find('.full-start__pg').each(function() { applyColor(this); });
                    if ($(m.addedNodes).hasClass('full-start__pg')) applyColor(m.addedNodes);
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Функция показа окна "О плагине" (Расшифрованная версия)
    function showAbout() {
        // Стили для модального окна
        $('#about-plugin-styles').remove();
        var style = $('<style id="about-plugin-styles"></style>');
        style.html(`
            .about-plugin { background: rgba(9, 2, 39, 0.95); border-radius: 15px; overflow: hidden; padding: 10px; box-shadow: 0 0 15px rgba(0, 219, 222, 0.1); }
            .about-plugin__title { background: linear-gradient(90deg, #fc00ff, #00dbde); padding: 15px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
            .about-plugin__title h1 { margin: 0; color: white; font-size: 24px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
            .about-plugin__description { padding: 15px; background: rgba(15, 2, 33, 0.8); border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(252, 0, 255, 0.2); }
            .about-plugin__description ul { color: #fff; font-size: 14px; line-height: 1.5; list-style-type: none; padding-left: 10px; margin: 10px 0; }
            .about-plugin__description li { margin-bottom: 6px; padding-left: 20px; position: relative; }
            .about-plugin__description li span { position: absolute; left: 0; color: #fc00ff; }
            .about-plugin__footer { padding: 15px; background: linear-gradient(90deg, #fc00ff, #00dbde); border-radius: 10px; text-align: center; }
            .about-plugin__footer h3 { margin-top: 0; color: white; font-size: 18px; font-weight: bold; }
            .credits-container { display: flex; justify-content: space-between; margin-top: 20px; }
            .credits-column { width: 48%; background: rgba(15, 2, 33, 0.8); border-radius: 10px; padding: 10px; position: relative; height: 150px; overflow: hidden; border: 1px solid rgba(252, 0, 255, 0.2); }
            .credits-title { color: #fc00ff; font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 10px; }
            .credits-list { color: white; font-size: 12px; text-align: center; }
        `);
        $('head').append(style);

        // Контент окна
        var html = `
        <div class="about-plugin">
            <div class="about-plugin__title">
                <h1>Интерфейс MOD v${InterFaceMod.version}</h1>
            </div>
            <div class="about-plugin__footer">
                <h3>Поддержать разработку</h3>
                <div style="color: white; font-size: 14px; margin-bottom: 5px;">OZON Банк</div>
                <div style="color: white; font-size: 18px; font-weight: bold; margin-bottom: 5px;">+7 953 235 00 02</div>
                <div style="color: #ffffff; font-size: 12px;">Владелец: Иван Л.</div>
            </div>
            <div class="credits-container">
                <div class="credits-column">
                    <div class="credits-title">Благодарность в поддержке:</div>
                    <div class="credits-list supporters-list">Загрузка...</div>
                </div>
                <div class="credits-column">
                    <div class="credits-title">Спасибо за идеи:</div>
                    <div class="credits-list contributors-list">Загрузка...</div>
                </div>
            </div>
            <div class="about-plugin__description" style="margin-top: 20px;">
                <div style="color: #fff; font-size: 15px; margin-bottom: 10px;">Версия 2.2.1</div>
                <ul>
                    <li><span>✦</span> Восстановлена работа с кнопками</li>
                    <li><span>✦</span> Функция цветных статусов и возрастных ограничений</li>
                    <li><span>✦</span> Оптимизирована работа интерфейса (удален setInterval)</li>
                    <li><span>✦</span> Добавлены информативные карточки (год, статус, серии)</li>
                    <li><span>✦</span> Улучшена безопасность (удалена обфускация)</li>
                </ul>
            </div>
        </div>`;

        var content = $('<div></div>').html(html);

        Lampa.Modal.open({
            title: '',
            html: content,
            onBack: function() {
                $('#about-plugin-styles').remove();
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings');
            },
            size: 'medium'
        });

        // Загрузка списка спонсоров
        var url = 'https://bywolf88.github.io/lampa-plugins/usersupp.json?nocache=' + Math.random();
        fetch(url).then(r => r.json()).then(data => {
            if(data && data.supporters) {
                var sHtml = '';
                data.supporters.forEach(i => { sHtml += '<div>' + i.name + ' (' + i.contribution + ')</div>'; });
                content.find('.supporters-list').html(sHtml);
            }
            if(data && data.contributors) {
                var cHtml = '';
                data.contributors.forEach(i => { cHtml += '<div>' + i.name + '</div>'; });
                content.find('.contributors-list').html(cHtml);
            }
        }).catch(e => {
            content.find('.supporters-list').html('Ошибка загрузки');
            content.find('.contributors-list').html('Ошибка загрузки');
        });
    }

    // Функция инициализации плагина
    function startPlugin() {
        Lampa.SettingsApi.addComponent({
            component: 'season_info',
            name: 'Интерфейс мод',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/><path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/><path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.4477 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/></svg>'
        });
        
        Lampa.SettingsApi.addParam({ component: 'season_info', param: { type: 'button', component: 'about' }, field: { name: 'О плагине', description: 'Информация и поддержка' }, onChange: showAbout });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'seasons_info_mode', type: 'select', values: { 'none': 'Выключить', 'aired': 'Актуальная информация', 'total': 'Полное количество' }, default: 'aired' },
            field: { name: 'Информация о сериях', description: 'Выберите как отображать информацию о сериях и сезонах' },
            onChange: function (v) { InterFaceMod.settings.seasons_info_mode = v; InterFaceMod.settings.enabled = (v !== 'none'); Lampa.Settings.update(); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'label_position', type: 'select', values: { 'top-right': 'Верхний правый', 'top-left': 'Верхний левый', 'bottom-right': 'Нижний правый', 'bottom-left': 'Нижний левый' }, default: 'top-right' },
            field: { name: 'Позиция лейбла серий', description: 'Где отображать информацию в карточке фильма' },
            onChange: function (v) { InterFaceMod.settings.label_position = v; Lampa.Settings.update(); Lampa.Noty.show('Для применения откройте карточку заново'); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'show_buttons', type: 'trigger', default: true },
            field: { name: 'Показывать все кнопки', description: 'Отображать все кнопки действий в карточке' },
            onChange: function (v) { InterFaceMod.settings.show_buttons = v; Lampa.Settings.update(); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'season_info_show_movie_type', type: 'trigger', default: true },
            field: { name: 'Изменить лейблы типа', description: 'Изменить "TV" на "Сериал" и добавить детальную информацию' },
            onChange: function (v) { InterFaceMod.settings.show_movie_type = v; Lampa.Settings.update(); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'theme_select', type: 'select', values: { default: 'Нет', bywolf_mod: 'Bywolf_mod', dark_night: 'Dark Night', blue_cosmos: 'Blue Cosmos', neon: 'Neon', sunset: 'Dark MOD', emerald: 'Emerald', aurora: 'Aurora' }, default: 'default' },
            field: { name: 'Тема интерфейса', description: 'Выберите тему оформления' },
            onChange: function(v) { InterFaceMod.settings.theme = v; Lampa.Settings.update(); applyTheme(v); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'colored_ratings', type: 'trigger', default: true },
            field: { name: 'Цветные рейтинги', description: 'Изменять цвет рейтинга в зависимости от оценки' },
            onChange: function (v) { InterFaceMod.settings.colored_ratings = v; Lampa.Settings.update(); if(v) updateVoteColors(); else $(".card__vote, .full-start__rate").css("color", ""); }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'season_info', param: { name: 'colored_elements', type: 'trigger', default: true },
            field: { name: 'Цветные элементы', description: 'Статусы сериалов и возрастные ограничения цветом' },
            onChange: function (v) { InterFaceMod.settings.colored_elements = v; Lampa.Settings.update(); }
        });

        // Применение настроек
        InterFaceMod.settings.show_buttons = Lampa.Storage.get('show_buttons', true);
        InterFaceMod.settings.show_movie_type = Lampa.Storage.get('season_info_show_movie_type', true);
        InterFaceMod.settings.theme = Lampa.Storage.get('theme_select', 'default');
        InterFaceMod.settings.colored_ratings = Lampa.Storage.get('colored_ratings', true);
        InterFaceMod.settings.colored_elements = Lampa.Storage.get('colored_elements', true);
        InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get('seasons_info_mode', 'aired');
        InterFaceMod.settings.label_position = Lampa.Storage.get('label_position', 'top-right');
        InterFaceMod.settings.enabled = (InterFaceMod.settings.seasons_info_mode !== 'none');
        
        applyTheme(InterFaceMod.settings.theme);
        
        if (InterFaceMod.settings.enabled) addSeasonInfo();
        showAllButtons();
        changeMovieTypeLabels();
        if (InterFaceMod.settings.colored_ratings) setupVoteColorsObserver();
        if (InterFaceMod.settings.colored_elements) {
            colorizeSeriesStatus();
            colorizeAgeRating();
        }

        // Перемещение пункта меню настроек
        Lampa.Settings.listener.follow('open', function () {
            setTimeout(function() {
                var im = $('.settings-folder[data-component="season_info"]');
                var is = $('.settings-folder[data-component="interface"]');
                if (im.length && is.length) im.insertAfter(is);
            }, 100);
        });
    }

    // Запуск
    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') startPlugin(); });

    Lampa.Manifest.plugins = { name: 'Интерфейс мод', version: '2.2.1', description: 'Улучшенный интерфейс для Lampa' };
    window.season_info = InterFaceMod;
})(); 
