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

    // 1. Информация о сезонах на постере полной карточки
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
                    if (movie.last_episode_to_air.episode_number) {
                        var lastSeason = movie.last_episode_to_air.season_number;
                        var lastEpisode = movie.last_episode_to_air.episode_number;

                        if (movie.seasons) {
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
                }

                if (airedSeasons === 0) airedSeasons = totalSeasons;
                if (airedEpisodes === 0) airedEpisodes = totalEpisodes;

                if (movie.next_episode_to_air && totalEpisodes > 0) {
                    var nextSeason = movie.next_episode_to_air.season_number;
                    var nextEpisode = movie.next_episode_to_air.episode_number;
                    var remainingEpisodes = 0;

                    if (movie.seasons) {
                        movie.seasons.forEach(function(season) {
                            if (season.season_number === nextSeason) {
                                remainingEpisodes = (season.episode_count || 0) - nextEpisode + 1;
                            } else if (season.season_number > nextSeason) {
                                remainingEpisodes += season.episode_count || 0;
                            }
                        });
                    }

                    if (remainingEpisodes > 0) {
                        var calculatedAired = totalEpisodes - remainingEpisodes;
                        if (calculatedAired >= 0 && calculatedAired <= totalEpisodes) {
                            airedEpisodes = calculatedAired;
                        }
                    }
                }

                if (totalEpisodes > 0 && airedEpisodes > totalEpisodes) {
                    airedEpisodes = totalEpisodes;
                }

                function plural(number, one, two, five) {
                    let n = Math.abs(number);
                    n %= 100;
                    if (n >= 5 && n <= 20) return five;
                    n %= 10;
                    if (n === 1) return one;
                    if (n >= 2 && n <= 4) return two;
                    return five;
                }

                function getStatusText(status) {
                    if (status === 'Ended') return 'Завершён';
                    if (status === 'Canceled') return 'Отменён';
                    if (status === 'Returning Series') return 'Выходит';
                    if (status === 'In Production') return 'В производстве';
                    return status || 'Неизвестно';
                }

                var displaySeasons, displayEpisodes;
                var isCompleted = (status === 'Ended' || status === 'Canceled');
                var bgColor = isCompleted ? 'rgba(46, 204, 113, 0.85)' : 'rgba(244, 67, 54, 0.85)';

                if (InterFaceMod.settings.seasons_info_mode === 'aired') {
                    displaySeasons = airedSeasons;
                    displayEpisodes = airedEpisodes;
                } else if (InterFaceMod.settings.seasons_info_mode === 'total') {
                    displaySeasons = totalSeasons;
                    displayEpisodes = totalEpisodes;
                } else {
                    return;
                }

                var seasonsText = plural(displaySeasons, 'сезон', 'сезона', 'сезонов');
                var episodesText = plural(displayEpisodes, 'серия', 'серии', 'серий');

                var text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
                if (!isCompleted && InterFaceMod.settings.seasons_info_mode === 'aired' && totalEpisodes > airedEpisodes && totalEpisodes > 0) {
                    text += ' из ' + totalEpisodes;
                }

                var infoElement = $('<div class="season-info-label"></div>');
                infoElement.append($('<div></div>').text(text));

                if (isCompleted) {
                    infoElement.append($('<div></div>').text(getStatusText(status)));
                }

                var positionStyles = {
                    'top-right':   { top: '1.4em', right: '-0.8em' },
                    'top-left':    { top: '1.4em', left: '-0.8em'  },
                    'bottom-right':{ bottom: '1.4em', right: '-0.8em' },
                    'bottom-left': { bottom: '1.4em', left: '-0.8em'  }
                };

                var position = InterFaceMod.settings.label_position || 'top-right';
                var posStyle = positionStyles[position] || positionStyles['top-right'];

                var commonStyles = {
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
                };

                infoElement.css($.extend({}, commonStyles, posStyle));

                setTimeout(function() {
                    var poster = $(data.object.activity.render()).find('.full-start-new__poster');
                    if (poster.length) {
                        poster.css('position', 'relative');
                        poster.append(infoElement);
                    }
                }, 100);
            }
        });
    }

    // 2. Показ всех кнопок в карточке (полностью ваш оригинальный код)
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

        var originFullCard;

        if (Lampa.FullCard) {
            originFullCard = Lampa.FullCard.build;

            Lampa.FullCard.build = function(data) {
                var card = originFullCard(data);

                card.organizeButtons = function() {
                    var activity = card.activity;
                    if (!activity) return;

                    var element = activity.render();
                    if (!element) return;

                    var targetContainer = element.find('.full-start-new__buttons');
                    if (!targetContainer.length) {
                        targetContainer = element.find('.full-start__buttons');
                    }
                    if (!targetContainer.length) {
                        targetContainer = element.find('.buttons-container');
                    }
                    if (!targetContainer.length) return;

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
                        element.find(selector).each(function() {
                            allButtons.push(this);
                        });
                    });

                    if (allButtons.length === 0) return;

                    var categories = {
                        online: [],
                        torrent: [],
                        trailer: [],
                        other: []
                    };

                    var addedButtonTexts = {};

                    $(allButtons).each(function() {
                        var button = this;
                        var buttonText = $(button).text().trim();
                        var className = button.className || '';

                        if (!buttonText || addedButtonTexts[buttonText]) return;
                        addedButtonTexts[buttonText] = true;

                        if (className.includes('online')) {
                            categories.online.push(button);
                        } else if (className.includes('torrent')) {
                            categories.torrent.push(button);
                        } else if (className.includes('trailer')) {
                            categories.trailer.push(button);
                        } else {
                            categories.other.push(button);
                        }
                    });

                    var buttonSortOrder = ['online', 'torrent', 'trailer', 'other'];

                    var needToggle = Lampa.Controller.enabled().name === 'full_start';
                    if (needToggle) Lampa.Controller.toggle('settings_component');

                    targetContainer.css({
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px'
                    });

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
                };

                card.onCreate = function() {
                    if (InterFaceMod.settings.show_buttons) {
                        setTimeout(function() {
                            card.organizeButtons();
                        }, 300);
                    }
                };

                return card;
            };
        }

        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && e.object && e.object.activity) {
                if (InterFaceMod.settings.show_buttons && !Lampa.FullCard) {
                    setTimeout(function() {
                        var fullContainer = e.object.activity.render();
                        var targetContainer = fullContainer.find('.full-start-new__buttons');
                        if (!targetContainer.length) {
                            targetContainer = fullContainer.find('.full-start__buttons');
                        }
                        if (!targetContainer.length) {
                            targetContainer = fullContainer.find('.buttons-container');
                        }
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

                        var categories = {
                            online: [],
                            torrent: [],
                            trailer: [],
                            other: []
                        };

                        var addedButtonTexts = {};

                        $(allButtons).each(function() {
                            var button = this;
                            var buttonText = $(button).text().trim();
                            var className = button.className || '';

                            if (!buttonText || addedButtonTexts[buttonText]) return;
                            addedButtonTexts[buttonText] = true;

                            if (className.includes('online')) {
                                categories.online.push(button);
                            } else if (className.includes('torrent')) {
                                categories.torrent.push(button);
                            } else if (className.includes('trailer')) {
                                categories.trailer.push(button);
                            } else {
                                categories.other.push(button);
                            }
                        });

                        var buttonSortOrder = ['online', 'torrent', 'trailer', 'other'];

                        var needToggle = Lampa.Controller.enabled().name === 'full_start';
                        if (needToggle) Lampa.Controller.toggle('settings_component');

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

        var buttonObserver = new MutationObserver(function(mutations) {
            if (!InterFaceMod.settings.show_buttons) return;

            let needReorganize = false;

            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' &&
                    (mutation.target.classList.contains('full-start-new__buttons') ||
                     mutation.target.classList.contains('full-start__buttons') ||
                     mutation.target.classList.contains('buttons-container'))) {
                    needReorganize = true;
                }
            });

            if (needReorganize) {
                setTimeout(function() {
                    if (Lampa.FullCard && Lampa.Activity.active() && Lampa.Activity.active().activity.card) {
                        if (typeof Lampa.Activity.active().activity.card.organizeButtons === 'function') {
                            Lampa.Activity.active().activity.card.organizeButtons();
                        }
                    }
                }, 100);
            }
        });

        buttonObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 3. Расширенные лейблы на карточках
    function changeMovieTypeLabels() {
        if (!$('#rich_card_labels').length) {
            $('<style id="rich_card_labels"></style>').html(`
                .rich-label {
                    position: absolute;
                    top: 0.9em;
                    left: -0.5em;
                    z-index: 22;
                    background: rgba(0,0,0,0.76);
                    color: #fff;
                    padding: 0.42em 0.62em;
                    border-radius: 0.38em;
                    font-size: 0.76em;
                    line-height: 1.18;
                    max-width: 162px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.48);
                    backdrop-filter: blur(3.2px);
                    pointer-events: none;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .rich-label .type-badge {
                    display: inline-block;
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-weight: bold;
                    font-size: 0.86em;
                }
                .rich-label .film  { background: #27ae60; }
                .rich-label .serial{ background: #2980b9; }
                .rich-label .year,
                .rich-label .se-info { opacity: 0.94; font-size: 0.89em; }
                .rich-label .rating  { font-weight: 700; font-size: 0.95em; }
                .rich-label .next    { font-size: 0.83em; color: #f1c40f; font-style: italic; }
            `).appendTo('head');
        }

        $('body').attr('data-movie-labels', InterFaceMod.settings.show_movie_type ? 'on' : 'off');

        const plural = (n, w1, w2, w5) => {
            n = Math.abs(n) % 100;
            if (n > 4 && n < 21) return w5;
            n %= 10;
            if (n === 1) return w1;
            if (n > 1 && n < 5) return w2;
            return w5;
        };

        const ratingColor = v => {
            if (v >= 8) return '#4ade80';
            if (v >= 6) return '#60a5fa';
            if (v >= 4) return '#fb923c';
            return '#f87171';
        };

        function addRichLabel(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            if ($(card).find('.rich-label').length) return;

            const $view = $(card).find('.card__view');
            if (!$view.length) return;

            let data = {};
            try {
                const dc = $(card).attr('data-card');
                if (dc) data = JSON.parse(dc);
                Object.assign(data, $(card).data());
            } catch(e) {}

            const isSerial = !!(
                data.type === 'tv' || data.type === 'serial' ||
                data.card_type === 'tv' || data.card_type === 'serial' ||
                data.seasons || data.number_of_seasons > 0 ||
                data.season_count > 0 || $(card).hasClass('card--tv') ||
                $(card).find('.card__type').text().match(/сериал|сезон|серии/i)
            );

            const typeText  = isSerial ? 'Сериал' : 'Фильм';
            const typeClass = isSerial ? 'serial' : 'film';

            const year = data.year ||
                         (data.release_date?.slice(0,4)) ||
                         (data.first_air_date?.slice(0,4)) || '—';

            const vote = parseFloat(data.vote_average || data.vote || data.rating || 0);
            const rating = vote > 0 ? vote.toFixed(1) : '';

            let seTxt = '';
            if (isSerial) {
                const s = data.number_of_seasons || data.season_count || 0;
                const e = data.number_of_episodes || data.episode_count || 0;
                if (s > 0) {
                    seTxt = s + ' ' + plural(s,'сезон','сезона','сезонов');
                    if (e > 0) seTxt += ' • ' + e + ' сер.';
                }
            }

            let nextTxt = '';
            if (isSerial && data.next_episode_to_air?.air_date) {
                const d = new Date(data.next_episode_to_air.air_date);
                if (!isNaN(d.getTime())) {
                    nextTxt = 'След. ' +
                        d.getDate().toString().padStart(2,'0') + '.' +
                        (d.getMonth()+1).toString().padStart(2,'0') + '.' +
                        d.getFullYear();
                }
            }

            const $l = $('<div class="rich-label"></div>');

            $l.append($('<span class="type-badge '+typeClass+'"></span>').text(typeText));
            $l.append($('<span class="year"></span>').text(year));

            if (rating) {
                const $r = $('<span class="rating"></span>').text(rating);
                $r.css('color', ratingColor(vote));
                $l.append($r);
            }

            if (seTxt)  $l.append($('<span class="se-info"></span>').text(seTxt));
            if (nextTxt) $l.append($('<span class="next"></span>').text(nextTxt));

            $view.css('position','relative').append($l);
        }

        function scanAllCards() {
            if (!InterFaceMod.settings.show_movie_type) return;
            $('.card').each((_, el) => addRichLabel(el));
        }

        const obs = new MutationObserver(() => setTimeout(scanAllCards, 70));
        obs.observe(document.body, { childList:true, subtree:true });

        scanAllCards();
        setInterval(scanAllCards, 3500);
    }

    // 4. Применение тем
    function applyTheme(theme) {
        $('#interface_mod_theme').remove();
        if (theme === 'default') return;

        const style = $('<style id="interface_mod_theme"></style>');

        const themes = {
            neon: `
                body { background: linear-gradient(135deg, #0d0221 0%, #150734 50%, #1f0c47 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #ff00ff, #00ffff); color: #fff;
                    box-shadow: 0 0 20px rgba(255, 0, 255, 0.4); text-shadow: 0 0 10px rgba(255, 255, 255, 0.5); border: none;
                }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #ff00ff; box-shadow: 0 0 20px #00ffff; }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #ff00ff, #00ffff); box-shadow: 0 0 15px rgba(255, 0, 255, 0.3); }
                .full-start__background { opacity: 0.7; filter: brightness(1.2) saturate(1.3); }
                .settings__content, .settings-input__content, .selectbox__content, .modal__content {
                    background: rgba(15, 2, 33, 0.95); border: 1px solid rgba(255, 0, 255, 0.1);
                }
            `,
            dark_night: `
                body { background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #8a2387, #e94057, #f27121); color: #fff;
                    box-shadow: 0 0 30px rgba(233, 64, 87, 0.3); animation: night-pulse 2s infinite;
                }
                @keyframes night-pulse { 0% { box-shadow: 0 0 20px rgba(233, 64, 87, 0.3); } 50% { box-shadow: 0 0 30px rgba(242, 113, 33, 0.3); } 100% { box-shadow: 0 0 20px rgba(138, 35, 135, 0.3); } }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #e94057; box-shadow: 0 0 30px rgba(242, 113, 33, 0.5); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #8a2387, #f27121); animation: night-pulse 2s infinite; }
                .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); }
                .settings__content, .settings-input__content, .selectbox__content, .modal__content {
                    background: rgba(10, 10, 10, 0.95); border: 1px solid rgba(233, 64, 87, 0.1); box-shadow: 0 0 30px rgba(242, 113, 33, 0.1);
                }
            `,
            blue_cosmos: `
                body { background: linear-gradient(135deg, #0b365c 0%, #144d80 50%, #0c2a4d 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #12c2e9, #c471ed, #f64f59); color: #fff;
                    box-shadow: 0 0 30px rgba(18, 194, 233, 0.3); animation: cosmos-pulse 2s infinite;
                }
                @keyframes cosmos-pulse { 0% { box-shadow: 0 0 20px rgba(18, 194, 233, 0.3); } 50% { box-shadow: 0 0 30px rgba(196, 113, 237, 0.3); } 100% { box-shadow: 0 0 20px rgba(246, 79, 89, 0.3); } }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #12c2e9; box-shadow: 0 0 30px rgba(196, 113, 237, 0.5); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #12c2e9, #f64f59); animation: cosmos-pulse 2s infinite; }
                .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); }
                .settings__content, .settings-input__content, .selectbox__content, .modal__content {
                    background: rgba(11, 54, 92, 0.95); border: 1px solid rgba(18, 194, 233, 0.1); box-shadow: 0 0 30px rgba(196, 113, 237, 0.1);
                }
            `,
            sunset: `
                body { background: linear-gradient(135deg, #2d1f3d 0%, #614385 50%, #516395 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #ff6e7f, #bfe9ff); color: #2d1f3d;
                    box-shadow: 0 0 15px rgba(255, 110, 127, 0.3); font-weight: bold;
                }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #ff6e7f; box-shadow: 0 0 15px rgba(255, 110, 127, 0.5); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #ff6e7f, #bfe9ff); color: #2d1f3d; }
                .full-start__background { opacity: 0.8; filter: saturate(1.2) contrast(1.1); }
            `,
            emerald: `
                body { background: linear-gradient(135deg, #1a2a3a 0%, #2C5364 50%, #203A43 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #43cea2, #185a9d); color: #fff;
                    box-shadow: 0 4px 15px rgba(67, 206, 162, 0.3); border-radius: 5px;
                }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 3px solid #43cea2; box-shadow: 0 0 20px rgba(67, 206, 162, 0.4); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #43cea2, #185a9d); }
                .full-start__background { opacity: 0.85; filter: brightness(1.1) saturate(1.2); }
                .settings__content, .settings-input__content, .selectbox__content, .modal__content {
                    background: rgba(26, 42, 58, 0.98); border: 1px solid rgba(67, 206, 162, 0.1);
                }
            `,
            aurora: `
                body { background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #aa4b6b, #6b6b83, #3b8d99); color: #fff;
                    box-shadow: 0 0 20px rgba(170, 75, 107, 0.3); transform: scale(1.02); transition: all 0.3s ease;
                }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #aa4b6b; box-shadow: 0 0 25px rgba(170, 75, 107, 0.5); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #aa4b6b, #3b8d99); transform: scale(1.05); }
                .full-start__background { opacity: 0.75; filter: contrast(1.1) brightness(1.1); }
            `,
            bywolf_mod: `
                body { background: linear-gradient(135deg, #090227 0%, #170b34 50%, #261447 100%); color: #ffffff; }
                .menu__item.focus, .menu__item.traverse, .menu__item.hover, .settings-folder.focus, .settings-param.focus,
                .selectbox-item.focus, .full-start__button.focus, .full-descr__tag.focus, .player-panel .button.focus {
                    background: linear-gradient(to right, #fc00ff, #00dbde); color: #fff;
                    box-shadow: 0 0 30px rgba(252, 0, 255, 0.3); animation: cosmic-pulse 2s infinite;
                }
                @keyframes cosmic-pulse { 0% { box-shadow: 0 0 20px rgba(252, 0, 255, 0.3); } 50% { box-shadow: 0 0 30px rgba(0, 219, 222, 0.3); } 100% { box-shadow: 0 0 20px rgba(252, 0, 255, 0.3); } }
                .card.focus .card__view::after, .card.hover .card__view::after { border: 2px solid #fc00ff; box-shadow: 0 0 30px rgba(0, 219, 222, 0.5); }
                .head__action.focus, .head__action.hover { background: linear-gradient(45deg, #fc00ff, #00dbde); animation: cosmic-pulse 2s infinite; }
                .full-start__background { opacity: 0.8; filter: saturate(1.3) contrast(1.1); }
                .settings__content, .settings-input__content, .selectbox__content, .modal__content {
                    background: rgba(9, 2, 39, 0.95); border: 1px solid rgba(252, 0, 255, 0.1); box-shadow: 0 0 30px rgba(0, 219, 222, 0.1);
                }
            `
        };

        style.html(themes[theme] || '');
        $('head').append(style);
    }

    // 7. Цветные рейтинги
    function updateVoteColors() {
        if (!InterFaceMod.settings.colored_ratings) return;

        function applyColorByRating(element) {
            const voteText = $(element).text().trim();
            const match = voteText.match(/(\d+(\.\d+)?)/);
            if (!match) return;

            const vote = parseFloat(match[0]);

            if (vote >= 0 && vote <= 3) $(element).css('color', "red");
            else if (vote > 3 && vote < 6) $(element).css('color', "orange");
            else if (vote >= 6 && vote < 8) $(element).css('color', "cornflowerblue");
            else if (vote >= 8 && vote <= 10) $(element).css('color', "lawngreen");
        }

        $(".card__vote").each(function() { applyColorByRating(this); });
        $(".full-start__rate, .full-start-new__rate").each(function() { applyColorByRating(this); });
        $(".info__rate, .card__imdb-rate, .card__kinopoisk-rate").each(function() { applyColorByRating(this); });
    }

    function setupVoteColorsObserver() {
        if (!InterFaceMod.settings.colored_ratings) return;
        setTimeout(updateVoteColors, 500);

        const observer = new MutationObserver(function(mutations) {
            setTimeout(updateVoteColors, 100);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupVoteColorsForDetailPage() {
        if (!InterFaceMod.settings.colored_ratings) return;

        Lampa.Listener.follow('full', function (data) {
            if (data.type === 'complite') {
                setTimeout(updateVoteColors, 100);
            }
        });
    }

    // 8. Цветные статусы сериалов
    function colorizeSeriesStatus() {
        if (!InterFaceMod.settings.colored_elements) return;

        function applyStatusColor(statusElement) {
            var statusText = $(statusElement).text().trim();

            var statusColors = {
                'completed':    { bg: 'rgba(46, 204, 113, 0.8)', text: 'white' },
                'canceled':     { bg: 'rgba(231, 76, 60, 0.8)',  text: 'white' },
                'ongoing':      { bg: 'rgba(243, 156, 18, 0.8)', text: 'black' },
                'production':   { bg: 'rgba(52, 152, 219, 0.8)', text: 'white' },
                'planned':      { bg: 'rgba(155, 89, 182, 0.8)', text: 'white' },
                'pilot':        { bg: 'rgba(230, 126, 34, 0.8)', text: 'white' },
                'released':     { bg: 'rgba(26, 188, 156, 0.8)', text: 'white' },
                'rumored':      { bg: 'rgba(149, 165, 166, 0.8)',text: 'white' },
                'post':         { bg: 'rgba(0, 188, 212, 0.8)',  text: 'white' }
            };

            let bgColor = '', textColor = '';

            if (statusText.includes('Заверш') || statusText.includes('Ended')) {
                bgColor = statusColors.completed.bg; textColor = statusColors.completed.text;
            } else if (statusText.includes('Отмен') || statusText.includes('Canceled')) {
                bgColor = statusColors.canceled.bg; textColor = statusColors.canceled.text;
            } else if (statusText.includes('Онгоинг') || statusText.includes('Выход') || statusText.includes('В процессе') || statusText.includes('Return')) {
                bgColor = statusColors.ongoing.bg; textColor = statusColors.ongoing.text;
            } else if (statusText.includes('производстве') || statusText.includes('Production')) {
                bgColor = statusColors.production.bg; textColor = statusColors.production.text;
            } else if (statusText.includes('Запланировано') || statusText.includes('Planned')) {
                bgColor = statusColors.planned.bg; textColor = statusColors.planned.text;
            } else if (statusText.includes('Пилотный') || statusText.includes('Pilot')) {
                bgColor = statusColors.pilot.bg; textColor = statusColors.pilot.text;
            } else if (statusText.includes('Выпущенный') || statusText.includes('Released')) {
                bgColor = statusColors.released.bg; textColor = statusColors.released.text;
            } else if (statusText.includes('слухам') || statusText.includes('Rumored')) {
                bgColor = statusColors.rumored.bg; textColor = statusColors.rumored.text;
            } else if (statusText.includes('Скоро') || statusText.includes('Post')) {
                bgColor = statusColors.post.bg; textColor = statusColors.post.text;
            }

            if (bgColor) {
                $(statusElement).css({
                    'background-color': bgColor,
                    'color': textColor,
                    'border-radius': '0.3em',
                    'border': '0px',
                    'font-size': '1.3em',
                    'display': 'inline-block'
                });
            }
        }

        $('.full-start__status').each(function() { applyStatusColor(this); });

        var statusObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        $(node).find('.full-start__status').each(function() { applyStatusColor(this); });
                        if ($(node).hasClass('full-start__status')) applyStatusColor(node);
                    }
                }
            });
        });

        statusObserver.observe(document.body, { childList: true, subtree: true });

        Lampa.Listener.follow('full', function(data) {
            if (data.type === 'complite' && data.data.movie) {
                setTimeout(function() {
                    $(data.object.activity.render()).find('.full-start__status').each(function() {
                        applyStatusColor(this);
                    });
                }, 100);
            }
        });
    }

    // 9. Цветные возрастные ограничения
    function colorizeAgeRating() {
        if (!InterFaceMod.settings.colored_elements) return;

        function applyAgeRatingColor(ratingElement) {
            var ratingText = $(ratingElement).text().trim();

            var ageRatings = {
                kids: ['G', 'TV-Y', 'TV-G', '0+', '3+', '0', '3'],
                children: ['PG', 'TV-PG', 'TV-Y7', '6+', '7+', '6', '7'],
                teens: ['PG-13', 'TV-14', '12+', '13+', '14+', '12', '13', '14'],
                almostAdult: ['R', 'TV-MA', '16+', '17+', '16', '17'],
                adult: ['NC-17', '18+', '18', 'X']
            };

            var colors = {
                kids:        { bg: '#2ecc71', text: 'white' },
                children:    { bg: '#3498db', text: 'white' },
                teens:       { bg: '#f1c40f', text: 'black' },
                almostAdult: { bg: '#e67e22', text: 'white' },
                adult:       { bg: '#e74c3c', text: 'white' }
            };

            var group = null;

            for (var groupKey in ageRatings) {
                if (ageRatings[groupKey].includes(ratingText) ||
                    ageRatings[groupKey].some(r => ratingText.includes(r))) {
                    group = groupKey;
                    break;
                }
            }

            if (group) {
                $(ratingElement).css({
                    'background-color': colors[group].bg,
                    'color': colors[group].text,
                    'border-radius': '0.3em',
                    'font-size': '1.3em',
                    'border': '0px'
                });
            }
        }

        $('.full-start__pg').each(function() { applyAgeRatingColor(this); });

        var ratingObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        $(node).find('.full-start__pg').each(function() { applyAgeRatingColor(this); });
                        if ($(node).hasClass('full-start__pg')) applyAgeRatingColor(node);
                    }
                }
            });
        });

        ratingObserver.observe(document.body, { childList: true, subtree: true });

        Lampa.Listener.follow('full', function(data) {
            if (data.type === 'complite' && data.data.movie) {
                setTimeout(function() {
                    $(data.object.activity.render()).find('.full-start__pg').each(function() {
                        applyAgeRatingColor(this);
                    });
                }, 100);
            }
        });
    }

    // 10. О плагине
    function showAbout() {
        if ($('#about-plugin-styles').length) $('#about-plugin-styles').remove();

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
            .credits-column { width: 48%; background: rgba(15, 2, 33, 0.8); border-radius: 10px; padding: 10px; position: relative; height: 200px; overflow: hidden; border: 1px solid rgba(252, 0, 255, 0.2); }
            .credits-title { color: #fc00ff; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 10px; text-shadow: 0 0 5px rgba(252, 0, 255, 0.3); position: relative; z-index: 10; background: rgba(15, 2, 33, 0.95); padding: 8px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border-bottom: 1px solid rgba(252, 0, 255, 0.3); }
            .credits-list { position: absolute; width: 100%; left: 0; padding: 0 10px; box-sizing: border-box; animation: scrollCredits 30s linear infinite; padding-top: 60px; margin-top: 20px; }
            .credits-item { text-align: center; margin-bottom: 15px; color: white; }
            .credits-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
            .credits-contribution { font-size: 12px; opacity: 0.8; }
            @keyframes scrollCredits { 0% { transform: translateY(50%); } 100% { transform: translateY(-100%); } }
        `);
        $('head').append(style);

        var html = `
            <div class="about-plugin">
                <div class="about-plugin__title">
                    <h1>Интерфейс MOD v${InterFaceMod.version}</h1>
                </div>
                <div class="about-plugin__description">
                    <div style="color:#fff;font-size:15px;margin-bottom:10px;">New versions 2.2.1</div>
                    <ul>
                        <li><span>✦</span> Восстановлена работа с кнопками</li>
                        <li><span>✦</span> Новая функция цветные статусы и возрастные ограничения</li>
                        <li><span>✦</span> Расширенные лейблы на карточках (год, рейтинг, сезоны, следующая серия)</li>
                        <li><span>✦</span> Мелкие исправления и улучшения</li>
                    </ul>
                </div>
                <div class="about-plugin__footer">
                    <h3>Поддержать разработку</h3>
                    <div style="color:white;font-size:14px;margin-bottom:5px;">OZON Банк</div>
                    <div style="color:white;font-size:18px;font-weight:bold;margin-bottom:5px;">+7 953 235 00 02</div>
                    <div style="color:#ffffff;font-size:12px;">Владелец: Иван Л.</div>
                </div>
            </div>
        `;

        Lampa.Modal.open({
            title: '',
            html: html,
            onBack: function() {
                $('#about-plugin-styles').remove();
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings');
            },
            size: 'full'
        });
    }

    // 11. Запуск плагина
    function startPlugin() {
        Lampa.SettingsApi.addComponent({
            component: 'season_info',
            name: 'Интерфейс мод',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/><path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/><path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.4477 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: { type: 'button', component: 'about' },
            field: { name: 'О плагине', description: 'Информация и поддержка' },
            onChange: showAbout
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: {
                name: 'seasons_info_mode',
                type: 'select',
                values: { 'none': 'Выключить', 'aired': 'Актуальная информация', 'total': 'Полное количество' },
                default: 'aired'
            },
            field: { name: 'Информация о сериях', description: 'Выберите как отображать информацию о сериях и сезонах' },
            onChange: function (value) {
                InterFaceMod.settings.seasons_info_mode = value;
                InterFaceMod.settings.enabled = value !== 'none';
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: {
                name: 'label_position',
                type: 'select',
                values: {
                    'top-right': 'Верхний правый угол',
                    'top-left': 'Верхний левый угол',
                    'bottom-right': 'Нижний правый угол',
                    'bottom-left': 'Нижний левый угол'
                },
                default: 'top-right'
            },
            field: { name: 'Расположение лейбла о сериях', description: 'Выберите позицию лейбла на постере' },
            onChange: function (value) {
                InterFaceMod.settings.label_position = value;
                Lampa.Settings.update();
                Lampa.Noty.show('Для применения изменений откройте карточку сериала заново');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: { name: 'show_buttons', type: 'trigger', default: true },
            field: { name: 'Показывать все кнопки', description: 'Отображать все кнопки действий в карточке' },
            onChange: function (value) {
                InterFaceMod.settings.show_buttons = value;
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: { name: 'season_info_show_movie_type', type: 'trigger', default: true },
            field: { name: 'Расширенные лейблы на карточках', description: 'Показывать год, рейтинг, сезоны и следующую серию' },
            onChange: function (value) {
                InterFaceMod.settings.show_movie_type = value;
                Lampa.Settings.update();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: {
                name: 'theme_select',
                type: 'select',
                values: {
                    default: 'Нет',
                    bywolf_mod: 'Bywolf_mod',
                    dark_night: 'Dark Night bywolf',
                    blue_cosmos: 'Blue Cosmos',
                    neon: 'Neon',
                    sunset: 'Dark MOD',
                    emerald: 'Emerald V1',
                    aurora: 'Aurora'
                },
                default: 'default'
            },
            field: { name: 'Тема интерфейса', description: 'Выберите тему оформления интерфейса' },
            onChange: function(value) {
                InterFaceMod.settings.theme = value;
                Lampa.Settings.update();
                applyTheme(value);
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: { name: 'colored_ratings', type: 'trigger', default: true },
            field: { name: 'Цветные рейтинги', description: 'Изменять цвет рейтинга в зависимости от оценки' },
            onChange: function (value) {
                InterFaceMod.settings.colored_ratings = value;
                Lampa.Settings.update();
                setTimeout(() => {
                    if (value) {
                        setupVoteColorsObserver();
                        setupVoteColorsForDetailPage();
                    } else {
                        $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate").css("color", "");
                    }
                }, 0);
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'season_info',
            param: { name: 'colored_elements', type: 'trigger', default: true },
            field: { name: 'Цветные элементы', description: 'Отображать статусы сериалов и возрастные ограничения цветными' },
            onChange: function (value) {
                InterFaceMod.settings.colored_elements = value;
                Lampa.Settings.update();
                if (value) {
                    colorizeSeriesStatus();
                    colorizeAgeRating();
                } else {
                    $('.full-start__status').css({ 'background-color':'', 'color':'', 'padding':'', 'border-radius':'', 'font-weight':'', 'display':'' });
                    $('.full-start__pg').css({ 'background-color':'', 'color':'', 'font-weight':'' });
                }
            }
        });

        // Применение сохранённых настроек
        InterFaceMod.settings.show_buttons      = Lampa.Storage.get('show_buttons', true);
        InterFaceMod.settings.show_movie_type   = Lampa.Storage.get('season_info_show_movie_type', true);
        InterFaceMod.settings.theme             = Lampa.Storage.get('theme_select', 'default');
        InterFaceMod.settings.colored_ratings   = Lampa.Storage.get('colored_ratings', true);
        InterFaceMod.settings.colored_elements  = Lampa.Storage.get('colored_elements', true);
        InterFaceMod.settings.seasons_info_mode = Lampa.Storage.get('seasons_info_mode', 'aired');
        InterFaceMod.settings.label_position    = Lampa.Storage.get('label_position', 'top-right');

        InterFaceMod.settings.enabled = InterFaceMod.settings.seasons_info_mode !== 'none';

        applyTheme(InterFaceMod.settings.theme);

        if (InterFaceMod.settings.enabled) addSeasonInfo();
        showAllButtons();
        changeMovieTypeLabels();

        if (InterFaceMod.settings.colored_ratings) {
            setupVoteColorsObserver();
            setupVoteColorsForDetailPage();
        }

        if (InterFaceMod.settings.colored_elements) {
            colorizeSeriesStatus();
            colorizeAgeRating();
        }

        Lampa.Settings.listener.follow('open', function () {
            setTimeout(() => {
                const mod  = $('.settings-folder[data-component="season_info"]');
                const base = $('.settings-folder[data-component="interface"]');
                if (mod.length && base.length) mod.insertAfter(base);
            }, 100);
        });
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                startPlugin();
            }
        });
    }

    Lampa.Manifest.plugins = {
        name: 'Интерфейс мод',
        version: InterFaceMod.version,
        description: 'Улучшенный интерфейс для приложения Lampa'
    };

    window.season_info = InterFaceMod;
})();
