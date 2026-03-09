// Lampa Premium UI 2026 by LEX for FOIL
// Один файл — всё в одном. Добавляй по URL.

(function() {
    'use strict';

    console.log('%c[Lampa Premium UI 2026] Загружено. Наслаждайся, сука.', 'color:#00ff9d; font-weight:bold');

    // 1. HD Постеры
    const originalPoster = Lampa.Utils.cardPoster;
    Lampa.Utils.cardPoster = function(item) {
        if (item.poster_path) {
            item.poster = 'https://image.tmdb.org/t/p/w780' + item.poster_path;
            item.background = 'https://image.tmdb.org/t/p/original' + (item.backdrop_path || item.poster_path);
        }
        return originalPoster ? originalPoster(item) : item.poster;
    };

    // 2. Стильный Netflix-интерфейс + glassmorphism
    const style = document.createElement('style');
    style.innerHTML = `
        .card { 
            border-radius: 20px !important; 
            overflow: hidden; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.6) !important; 
            transition: all 0.4s cubic-bezier(0.23,1,0.32,1) !important;
        }
        .card:hover { transform: scale(1.08) translateY(-8px); }
        .card__img { border-radius: 20px !important; }
        
        body, .activity { 
            background: linear-gradient(135deg, #0a0a0a, #1a1a2e, #16213e) !important; 
        }
        
        .menu__item, .settings__item {
            border-radius: 16px !important;
            backdrop-filter: blur(12px) !important;
            background: rgba(255,255,255,0.06) !important;
        }
        
        .player__title { font-size: 1.4em !important; font-weight: 700; }
    `;
    document.head.appendChild(style);

    // 3. Горячие клавиши
    Lampa.Key.add('Escape', () => Lampa.Activity.back());
    Lampa.Key.add('KeyF', () => Lampa.Player.fullscreen());
    Lampa.Key.add('Space', () => Lampa.Player.playPause());
    Lampa.Key.add('ArrowLeft', () => Lampa.Player.seek(-10));
    Lampa.Key.add('ArrowRight', () => Lampa.Player.seek(10));
    Lampa.Key.add('Digit1', () => Lampa.Player.seek(30));
    Lampa.Key.add('Digit2', () => Lampa.Player.seek(60));

    // 4. Кнопка Выход в главное меню
    Lampa.Listener.follow('menu_open', function() {
        if (!document.querySelector('.exit-button')) {
            const exitBtn = document.createElement('div');
            exitBtn.className = 'menu__item exit-button';
            exitBtn.innerHTML = `<div class="menu__ico">✕</div><div class="menu__name">Выход из приложения</div>`;
            exitBtn.onclick = () => {
                if (confirm('Выйти из Lampa?')) window.close();
            };
            document.querySelector('.menu__list').appendChild(exitBtn);
        }
    });

    // 5. Настройки плагина (размер карточек + анимации)
    Lampa.SettingsApi.add({
        component: 'plugin_premium_ui',
        name: 'Premium UI',
        description: 'Настройки интерфейса',
        icon: 'settings',
        onSelect: function() {
            Lampa.Settings.create({
                title: 'Premium UI настройки',
                items: [
                    {
                        name: 'card_size',
                        type: 'select',
                        values: { small: 'Маленькие', medium: 'Средние (по умолчанию)', large: 'Большие' },
                        default: 'medium',
                        onchange: function(val) {
                            document.documentElement.style.setProperty('--card-scale', val === 'small' ? '0.85' : val === 'large' ? '1.15' : '1');
                        }
                    },
                    {
                        name: 'animation_speed',
                        type: 'select',
                        values: { fast: 'Быстро', normal: 'Нормально', slow: 'Медленно' },
                        default: 'normal',
                        onchange: function(val) {
                            const speed = val === 'fast' ? '0.2s' : val === 'slow' ? '0.6s' : '0.4s';
                            document.documentElement.style.setProperty('--transition-speed', speed);
                        }
                    }
                ]
            });
        }
    });

    // 6. Авто-очистка интерфейса (убираем лишние элементы для скорости)
    setTimeout(() => {
        const toHide = document.querySelectorAll('.banner, .ad-block, .promo');
        toHide.forEach(el => el.style.display = 'none');
        
        // Ускоряем рендер карточек
        Lampa.Template.add('card', function(data) {
            return originalCardTemplate ? originalCardTemplate(data) : '';
        });
    }, 1500);

    // Глобальные CSS переменные для настроек
    const root = document.documentElement;
    root.style.setProperty('--card-scale', '1');
    root.style.setProperty('--transition-speed', '0.4s');

    // Финальный хук — перерисовка после загрузки
    Lampa.Listener.follow('app_ready', () => {
        console.log('%c[Lampa Premium UI] Всё красиво, брат. Наслаждайся.', 'color:#00ff9d');
    });
})();
