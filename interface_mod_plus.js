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

    // Функция для добавления информации о сезонах и сериях на постер (оставлена ваша)
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
                
                if (movie.next_episode_to_air) {
                    var nextSeason = movie.next_episode_to_air.season_number;
                    var nextEpisode = movie.next_episode_to_air.episode_number;
                    
                    if (totalEpisodes > 0) {
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
                var bgColor = isCompleted ? 'rgba(33, 150, 243, 0.8)' : 'rgba(244, 67, 54, 0.8)';
                
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
                
                var infoElement = $('<div class="season-info-label"></div>');
                
                var text = displaySeasons + ' ' + seasonsText + ' ' + displayEpisodes + ' ' + episodesText;
                if (!isCompleted && InterFaceMod.settings.seasons_info_mode === 'aired' && totalEpisodes > airedEpisodes) {
                    text += ' из ' + totalEpisodes;
                }
                
                infoElement.append($('<div></div>').text(text));
                
                if (isCompleted) {
                    infoElement.append($('<div></div>').text(getStatusText(status)));
                }
                
                var positionStyles = {
                    'top-right': { 'top': '1.4em', 'right': '-0.8em', 'left': 'auto', 'bottom': 'auto' },
                    'top-left': { 'top': '1.4em', 'left': '-0.8em', 'right': 'auto', 'bottom': 'auto' },
                    'bottom-right': { 'bottom': '1.4em', 'right': '-0.8em', 'top': 'auto', 'left': 'auto' },
                    'bottom-left': { 'bottom': '1.4em', 'left': '-0.8em', 'top': 'auto', 'right': 'auto' }
                };
                
                var position = InterFaceMod.settings.label_position || 'top-right';
                var positionStyle = positionStyles[position] || positionStyles['top-right'];
                
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
                
                infoElement.css($.extend({}, commonStyles, positionStyle));
                
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

    // 2. Показ всех кнопок (ваша полная функция)
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

    // 3. НОВАЯ расширенная функция лейблов на карточках (как на вашем первом скрине)
    function changeMovieTypeLabels() {
        if (!$('#rich_card_labels').length) {
            $('<style id="rich_card_labels"></style>').html(`
                .rich-label {
                    position: absolute !important;
                    top: 0.8em !important;
                    left: -0.4em !important;
                    z-index: 25 !important;
                    background: rgba(0,0,0,0.72) !important;
                    color: white !important;
                    padding: 0.38em 0.58em !important;
                    border-radius: 0.35em !important;
                    font-size: 0.75em !important;
                    line-height: 1.16 !important;
                    max-width: 170px !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.55) !important;
                    backdrop-filter: blur(3px) !important;
                    pointer-events: none !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 1px !important;
                }
                .rich-label .type-badge {
                    display: inline-block !important;
                    padding: 1px 7px !important;
                    border-radius: 3px !important;
                    font-weight: bold !important;
                    font-size: 0.88em !important;
                }
                .rich-label .serial { background: #2980b9 !important; }
                .rich-label .film   { background: #27ae60 !important; }
                .rich-label .year,
                .rich-label .se-info { opacity: 0.95; font-size: 0.9em; }
                .rich-label .rating  { font-weight: bold; font-size: 0.97em; }
                .rich-label .next,
                .rich-label .status  { font-size: 0.84em; color: #f1c40f; font-style: italic; }
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

        function ratingColor(v) {
            if (v >= 8) return '#27ae60';
            if (v >= 6.5) return '#f39c12';
            if (v >= 5) return '#e67e22';
            return '#c0392b';
        }

        function addRichLabel(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            if ($(card).find('.rich-label').length) return;

            var $view = $(card).find('.card__view, .poster-view, .card-poster-view');
            if (!$view.length) return;

            var data = {};
            try {
                var dc = $(card).attr('data-card') || $(card).attr('data-item');
                if (dc) data = JSON.parse(dc);
                Object.assign(data, $(card).data());
            } catch (e) {}

            var isSerial = !!(
                data.type === 'tv' || data.type === 'serial' ||
                data.card_type === 'tv' || data.card_type === 'serial' ||
                data.seasons || data.number_of_seasons > 0 ||
                data.season_count > 0 || $(card).hasClass('card--tv') ||
                $(card).find('.card__type').text().match(/сериал|сезон|серии/i)
            );

            var typeText  = isSerial ? 'Сериал' : 'Фильм';
            var typeClass = isSerial ? 'serial' : 'film';

            var year = data.year || 
                       (data.release_date  ? data.release_date.slice(0,4) : '') ||
                       (data.first_air_date ? data.first_air_date.slice(0,4) : '') || '';

            var vote = parseFloat(data.vote_average || data.vote || data.rating || data.imdb || 0);
            var rating = vote > 0 ? vote.toFixed(1) : '';

            var seTxt = '';
            if (isSerial) {
                var s = data.number_of_seasons || data.season_count || 0;
                var e = data.number_of_episodes || data.episode_count || 0;
                if (s > 0) {
                    seTxt = s + ' ' + plural(s, 'сезон', 'сезона', 'сезонов');
                    if (e > 0) seTxt += ' ' + e + '/' + (data.total_episodes || '?');
                }
            }

            var nextOrStatus = '';
            if (isSerial) {
                if (data.next_episode_to_air?.air_date) {
                    var d = new Date(data.next_episode_to_air.air_date);
                    if (!isNaN(d)) {
                        var daysLeft = Math.ceil((d - new Date()) / (1000*60*60*24));
                        if (daysLeft > 0) {
                            nextOrStatus = daysLeft === 1 ? 'Завтра' : 'Через ' + daysLeft + ' дн';
                        } else if (daysLeft === 0) {
                            nextOrStatus = 'Сегодня';
                        }
                    }
                } else if (data.status === 'Returning Series' || data.status === 'In Production') {
                    nextOrStatus = 'Продолжается';
                }
            }

            var $label = $('<div class="rich-label"></div>');

            $label.append($('<span class="type-badge ' + typeClass + '"></span>').text(typeText));
            if (year) $label.append($('<span class="year"></span>').text(year));
            if (rating) {
                var $r = $('<span class="rating"></span>').text(rating);
                $r.css('color', ratingColor(vote));
                $label.append($r);
            }
            if (seTxt) $label.append($('<span class="se-info"></span>').text(seTxt));
            if (nextOrStatus) $label.append($('<span class="next"></span>').text(nextOrStatus));

            $view.css('position', 'relative').append($label);
        }

        function scanCards() {
            if (!InterFaceMod.settings.show_movie_type) return;
            $('.card, .card-item, .poster').each(function() {
                addRichLabel(this);
            });
        }

        var observer = new MutationObserver(() => setTimeout(scanCards, 80));
        observer.observe(document.body, { childList: true, subtree: true });

        scanCards();
        setInterval(scanCards, 3000);
    }

    // ... (все остальные ваши функции: applyTheme, updateVoteColors, colorizeSeriesStatus, colorizeAgeRating, showAbout и т.д. остаются без изменений)

    // Инициализация (ваша)
    function startPlugin() {
        // Ваши настройки (addComponent, addParam) — оставьте как есть

        InterFaceMod.settings.show_movie_type = Lampa.Storage.get('season_info_show_movie_type', true);
        // ... остальные настройки

        if (InterFaceMod.settings.show_movie_type) {
            changeMovieTypeLabels();  // ← именно здесь включается новый лейбл
        }

        // ... остальной запуск: addSeasonInfo(), showAllButtons(), applyTheme и т.д.
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
        version: '2.2.1',
        description: 'Улучшенный интерфейс для приложения Lampa'
    };

    window.season_info = InterFaceMod;
})();
