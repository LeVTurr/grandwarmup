const cameraFeed = document.getElementById('camera-feed');
const handOverlay = document.getElementById('hand-overlay');
const handCtx = handOverlay.getContext('2d');
const mazeCanvas = document.getElementById('maze-canvas');
const mazeCtx = mazeCanvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const statusDiv = document.getElementById('status');
const timeDisplay = document.getElementById('time');
const movesDisplay = document.getElementById('moves');
const levelDisplay = document.getElementById('level');
const gestureCards = {
    up: document.getElementById('gesture-up'),
    down: document.getElementById('gesture-down'),
    left: document.getElementById('gesture-left'),
    right: document.getElementById('gesture-right')
};

let gameActive = false;
let gameStarted = false;
let startTime = 0;
let elapsedTime = 0;
let moves = 0;
let currentLevel = 1;
let gameInterval;

const cellSize = 40;
let mazeWidth, mazeHeight, cols, rows;
let maze = [];
let player = { x: 1, y: 1 };
let finish = { x: 0, y: 0 };

let hands = null;
let lastGesture = null;
let gestureCooldown = false;
let lastGestureTime = 0;
let currentHandPosition = { x: 0, y: 0 };
let previousHandPosition = { x: 0, y: 0 };

const SENSITIVITY = {
    LOW: 0.7,
    MEDIUM: 1.0,
    HIGH: 1.3,
    VERY_HIGH: 1.6
};
let sensitivity = SENSITIVITY.MEDIUM;

let arrowKeys = {
    up: false,
    down: false,
    left: false,
    right: false
};

let arrowMoveInterval = null;

// ========== СИСТЕМА ИМЕНИ ИГРОКА ==========
let playerName = 'Игрок';

// Создание окна имени игрока
function createPlayerNameModal() {
    // Проверяем, существует ли уже модальное окно
    if (document.getElementById('player-name-modal')) {
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'player-name-modal';
    modal.id = 'player-name-modal';
    modal.innerHTML = `
        <div class="player-name-content">
            <div class="player-name-header">
                <i class="fas fa-user-circle"></i>
                <h2>Добро пожаловать в GrandWarmUp!</h2>
            </div>
            <div class="player-name-body">
                <p>Введите ваше имя для таблицы лидеров:</p>
                <div class="player-name-input-group">
                    <i class="fas fa-user"></i>
                    <input type="text" id="player-name-input" placeholder="Ваше имя" maxlength="20" value="${playerName}">
                </div>
                <div class="player-name-hint">
                    <i class="fas fa-info-circle"></i>
                    <span>Имя можно будет изменить в любой момент через вкладку "Главное меню" → "Сменить имя"</span>
                </div>
            </div>
            <div class="player-name-footer">
                <button class="btn btn-save-name" id="save-player-name">
                    <i class="fas fa-check"></i> Начать игру
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Загружаем сохраненное имя
    const savedName = localStorage.getItem('grandwarmup-player-name');
    if (savedName) {
        playerName = savedName;
        const input = document.getElementById('player-name-input');
        if (input) input.value = savedName;
        modal.classList.add('hidden');
    } else {
        modal.classList.add('active');
    }
    
    // Обработчик сохранения имени
    const saveBtn = document.getElementById('save-player-name');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            const input = document.getElementById('player-name-input');
            let name = input.value.trim();
            
            if (name === '') {
                name = 'Игрок';
            }
            
            if (name.length > 20) {
                name = name.substring(0, 20);
            }
            
            playerName = name;
            localStorage.setItem('grandwarmup-player-name', playerName);
            
            const modal = document.getElementById('player-name-modal');
            modal.classList.add('hidden');
            modal.classList.remove('active');
            
            showNotification(`Добро пожаловать, ${playerName}!`, themes[currentTheme].primary);
            
            // Автоматически запускаем камеру и игру
            if (!gameStarted) {
                initCamera().then(cameraStarted => {
                    if (cameraStarted) {
                        initCanvasSizes();
                        generateMaze();
                        startGame();
                    }
                });
            }
        });
    }
}

// Открыть окно изменения имени
function openChangeNameModal() {
    let modal = document.getElementById('player-name-modal');
    
    if (!modal) {
        createPlayerNameModal();
        modal = document.getElementById('player-name-modal');
    }
    
    // Обновляем значение в поле ввода
    const input = document.getElementById('player-name-input');
    if (input) {
        input.value = playerName;
    }
    
    // Меняем заголовок для режима изменения
    const header = modal.querySelector('.player-name-header h2');
    if (header) {
        header.textContent = 'Изменить имя';
    }
    
    const hint = modal.querySelector('.player-name-hint span');
    if (hint) {
        hint.textContent = 'Измените имя и оно сохранится для всех достижений';
    }
    
    const saveBtn = modal.querySelector('#save-player-name');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

// ========== ТЕМЫ ОФОРМЛЕНИЯ ==========
const themes = {
    default: {
        primary: '#4cc9f0',
        secondary: '#4361ee',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        mazeBg: '#0d1b2a',
        mazeWall: '#1b3a4b',
        player: '#4cc9f0',
        finish: '#ff4757',
        text: '#ffffff',
        accent: '#00dbde'
    },
    dark: {
        primary: '#bb86fc',
        secondary: '#3700b3',
        background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        mazeBg: '#0a0a0a',
        mazeWall: '#2d2d2d',
        player: '#bb86fc',
        finish: '#cf6679',
        text: '#ffffff',
        accent: '#03dac6'
    },
    light: {
        primary: '#0693ff',
        secondary: '#0091ff',
        background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)',
        mazeBg: '#ffffff',
        mazeWall: '#85a4bc',
        player: '#0693ff',
        finish: '#b00020',
        text: '#5159fc',
        accent: '#018786'
    },
    neon: {
        primary: '#00ff00',
        secondary: '#ff00ff',
        background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)',
        mazeBg: '#001a00',
        mazeWall: '#00ff00',
        player: '#00ffff',
        finish: '#ff00ff',
        text: '#ffffff',
        accent: '#ffff00'
    }
};

let currentTheme = 'default';

// ========== ПРИМЕНЕНИЕ ТЕМЫ ==========
function applyTheme(themeName) {
    currentTheme = themeName;
    const theme = themes[themeName];
    
    document.body.style.background = theme.background;
    
    // Убираем все классы светлой темы
    document.body.classList.remove('light-theme-active');
    
    // Если выбрана светлая тема, добавляем класс для синего текста
    if (themeName === 'light') {
        document.body.classList.add('light-theme-active');
    }
    
    document.querySelector('h1').style.background = `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})`;
    document.querySelector('h1').style.webkitBackgroundClip = 'text';
    document.querySelector('h1').style.backgroundClip = 'text';
    
    document.querySelectorAll('.section-title').forEach(el => {
        el.style.color = theme.primary;
    });
    
    document.querySelectorAll('.gesture-text h3').forEach(el => {
        el.style.color = theme.primary;
    });
    
    document.querySelectorAll('.stat-value').forEach(el => {
        el.style.color = theme.primary;
    });
    
    document.querySelectorAll('.tab-icon').forEach(el => {
        el.style.color = theme.primary;
    });
    
    document.querySelectorAll('.tab.active').forEach(el => {
        el.style.background = `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`;
    });
    
    document.querySelectorAll('.panel-header h2').forEach(el => {
        el.style.color = theme.primary;
    });
    
    document.querySelectorAll('.menu-item i').forEach(el => {
        el.style.color = theme.primary;
    });
    
    drawMaze();
    
    localStorage.setItem('grandwarmup-theme', themeName);
    
    showNotification(`Тема изменена: ${themeName}`, theme.primary);
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, color = '#4cc9f0') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: ${color};
        padding: 15px 25px;
        border-radius: 50px;
        font-weight: bold;
        z-index: 9999;
        animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
        border-left: 5px solid ${color};
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

function initCanvasSizes() {
    const mazeContainer = document.querySelector('.maze-container');
    const cameraContainer = document.querySelector('.camera-container');
    
    mazeCanvas.width = mazeContainer.clientWidth;
    mazeCanvas.height = mazeContainer.clientHeight;
    
    handOverlay.width = cameraContainer.clientWidth;
    handOverlay.height = cameraContainer.clientHeight;
    
    cols = Math.floor(mazeCanvas.width / cellSize) - 2;
    rows = Math.floor(mazeCanvas.height / cellSize) - 2;
    mazeWidth = cols * cellSize;
    mazeHeight = rows * cellSize;
}

function generateMaze() {
    maze = [];
    for (let y = 0; y < rows; y++) {
        maze[y] = [];
        for (let x = 0; x < cols; x++) {
            maze[y][x] = 1;
        }
    }
    
    let stack = [];
    let startX = 1;
    let startY = 1;
    
    maze[startY][startX] = 0;
    stack.push([startX, startY]);
    
    let maxIterations = Math.min(cols * rows, 500);
    let iterations = 0;
    
    while (stack.length > 0 && iterations < maxIterations) {
        let [x, y] = stack[stack.length - 1];
        iterations++;
        
        let neighbors = [];
        
        if (y > 1 && maze[y-2][x] === 1) neighbors.push([x, y-2, x, y-1]);
        if (y < rows-2 && maze[y+2][x] === 1) neighbors.push([x, y+2, x, y+1]);
        if (x > 1 && maze[y][x-2] === 1) neighbors.push([x-2, y, x-1, y]);
        if (x < cols-2 && maze[y][x+2] === 1) neighbors.push([x+2, y, x+1, y]);
        
        if (neighbors.length > 0) {
            let [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[ny][nx] = 0;
            maze[wy][wx] = 0;
            stack.push([nx, ny]);
        } else {
            stack.pop();
        }
    }
    
    player.x = 1;
    player.y = 1;
    
    finish.x = cols - 2;
    finish.y = rows - 2;
    maze[finish.y][finish.x] = 0;
    
    for (let i = 0; i < Math.floor(cols * rows / 30); i++) {
        let x = Math.floor(Math.random() * (cols - 2)) + 1;
        let y = Math.floor(Math.random() * (rows - 2)) + 1;
        maze[y][x] = 0;
    }
    
    drawMaze();
}

function drawMaze() {
    const theme = themes[currentTheme];
    
    mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    
    mazeCtx.fillStyle = theme.mazeBg;
    mazeCtx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    
    const offsetX = (mazeCanvas.width - mazeWidth) / 2;
    const offsetY = (mazeCanvas.height - mazeHeight) / 2;
    
    mazeCtx.fillStyle = theme.mazeWall;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (maze[y][x] === 1) {
                mazeCtx.fillRect(
                    offsetX + x * cellSize, 
                    offsetY + y * cellSize, 
                    cellSize, 
                    cellSize
                );
            }
        }
    }
    
    mazeCtx.fillStyle = theme.finish;
    mazeCtx.beginPath();
    mazeCtx.arc(
        offsetX + finish.x * cellSize + cellSize/2,
        offsetY + finish.y * cellSize + cellSize/2,
        cellSize/2 - 2,
        0,
        Math.PI * 2
    );
    mazeCtx.fill();
    
    mazeCtx.fillStyle = theme.player;
    mazeCtx.beginPath();
    mazeCtx.arc(
        offsetX + player.x * cellSize + cellSize/2,
        offsetY + player.y * cellSize + cellSize/2,
        cellSize/2 - 4,
        0,
        Math.PI * 2
    );
    mazeCtx.fill();
    
    mazeCtx.fillStyle = '#2ecc71';
    mazeCtx.beginPath();
    mazeCtx.arc(
        offsetX + cellSize + cellSize/2,
        offsetY + cellSize + cellSize/2,
        cellSize/4,
        0,
        Math.PI * 2
    );
    mazeCtx.fill();
}

function movePlayer(dx, dy) {
    if (!gameActive) return false;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (newX >= 0 && newX < cols && newY >= 0 && newY < rows && maze[newY][newX] === 0) {
        player.x = newX;
        player.y = newY;
        moves++;
        movesDisplay.textContent = moves;
        
        drawPlayerOnly();
        
        if (player.x === finish.x && player.y === finish.y) {
            levelComplete();
        }
        
        return true;
    }
    
    return false;
}

function drawPlayerOnly() {
    const theme = themes[currentTheme];
    const offsetX = (mazeCanvas.width - mazeWidth) / 2;
    const offsetY = (mazeCanvas.height - mazeHeight) / 2;
    
    mazeCtx.fillStyle = theme.mazeBg;
    mazeCtx.fillRect(
        offsetX + (player.x - 1) * cellSize, 
        offsetY + (player.y - 1) * cellSize, 
        cellSize * 3, 
        cellSize * 3
    );
    
    mazeCtx.fillStyle = theme.mazeWall;
    for (let y = Math.max(0, player.y - 2); y < Math.min(rows, player.y + 3); y++) {
        for (let x = Math.max(0, player.x - 2); x < Math.min(cols, player.x + 3); x++) {
            if (maze[y][x] === 1) {
                mazeCtx.fillRect(
                    offsetX + x * cellSize, 
                    offsetY + y * cellSize, 
                    cellSize, 
                    cellSize
                );
            }
        }
    }
    
    if (Math.abs(finish.x - player.x) <= 2 && Math.abs(finish.y - player.y) <= 2) {
        mazeCtx.fillStyle = theme.finish;
        mazeCtx.beginPath();
        mazeCtx.arc(
            offsetX + finish.x * cellSize + cellSize/2,
            offsetY + finish.y * cellSize + cellSize/2,
            cellSize/2 - 2,
            0,
            Math.PI * 2
        );
        mazeCtx.fill();
    }
    
    mazeCtx.fillStyle = theme.player;
    mazeCtx.beginPath();
    mazeCtx.arc(
        offsetX + player.x * cellSize + cellSize/2,
        offsetY + player.y * cellSize + cellSize/2,
        cellSize/2 - 4,
        0,
        Math.PI * 2
    );
    mazeCtx.fill();
}

// ========== РАЗНООБРАЗНЫЕ ЭФФЕКТЫ ПРАЗДНОВАНИЯ С УВЕЛИЧЕННОЙ ДЛИТЕЛЬНОСТЬЮ ==========
function celebrateWithEffects() {
    // Случайно выбираем тип эффекта
    const effectType = Math.floor(Math.random() * 4); // 0-3
    
    switch(effectType) {
        case 0:
            createConfettiEffect();
            break;
        case 1:
            createFireworksEffect();
            break;
        case 2:
            createGiftsEffect();
            break;
        case 3:
            createHeartsEffect();
            break;
    }
}

// Эффект конфетти (увеличен с 6 до 15 секунд)
function createConfettiEffect() {
    let canvas = document.getElementById('celebration-canvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'celebration-canvas';
        document.body.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const colors = [
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
        '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', 
        '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', 
        '#FF5722', '#795548', '#9E9E9E', '#607D8B', '#4cc9f0',
        '#ffd700', '#ff6b6b', '#6bff6b', '#6b6bff', '#ff6bff'
    ];
    
    const shapes = ['rect', 'circle', 'triangle', 'star'];
    const particleCount = 300; // Увеличено количество частиц для более насыщенного эффекта
    
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 15 + 5, // Увеличен размер
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 6 + 3, // Немного медленнее для плавности
            angle: Math.random() * Math.PI * 2,
            rotation: Math.random() * 0.2 - 0.1,
            wobble: Math.random() * 0.3 - 0.15,
            opacity: Math.random() * 0.9 + 0.1,
            shape: shapes[Math.floor(Math.random() * shapes.length)]
        });
    }
    
    animateEffect(canvas, ctx, particles, 15000); // Увеличено до 15 секунд
}

// Эффект салюта (фейерверк) - увеличен с ~4 секунд до 10 секунд
function createFireworksEffect() {
    let canvas = document.getElementById('celebration-canvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'celebration-canvas';
        document.body.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const fireworkCount = 25; // Увеличено количество фейерверков
    
    for (let f = 0; f < fireworkCount; f++) {
        // Разнесем фейерверки по времени
        setTimeout(() => {
            const centerX = Math.random() * canvas.width;
            const centerY = Math.random() * canvas.height * 0.7;
            const color = `hsl(${Math.random() * 360}, 100%, 60%)`;
            const particleCount = 50; // Увеличено количество частиц на фейерверк
            
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const speed = Math.random() * 10 + 3;
                
                particles.push({
                    x: centerX,
                    y: centerY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 8 + 3,
                    color: color,
                    opacity: 1,
                    life: 1,
                    maxLife: Math.random() * 80 + 50 // Увеличена продолжительность жизни
                });
            }
        }, f * 300); // Задержка между фейерверками 0.3 секунды
    }
    
    let frame = 0;
    const maxFrames = 300; // Увеличено с 120 до 300 кадров (примерно 10 секунд при 30fps)
    
    function animateFireworks() {
        if (frame >= maxFrames) {
            if (canvas && canvas.parentNode) {
                canvas.remove();
            }
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Добавляем эффект звездного неба
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // Меньше гравитация для более плавного падения
            p.life -= 0.003; // Медленнее затухание
            p.opacity = p.life;
            
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        
        frame++;
        requestAnimationFrame(animateFireworks);
    }
    
    animateFireworks();
}

// Эффект подарков - увеличен с 6 до 15 секунд
function createGiftsEffect() {
    let canvas = document.getElementById('celebration-canvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'celebration-canvas';
        document.body.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const gifts = [];
    const giftCount = 60; // Увеличено количество подарков
    const giftEmojis = ['🎁', '🎀', '🎄', '🎅', '🤶', '🦌', '⭐', '🌟', '✨', '🎊', '🎉', '🧸', '🍬', '🍭', '🧁', '🎈'];
    
    for (let i = 0; i < giftCount; i++) {
        gifts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            emoji: giftEmojis[Math.floor(Math.random() * giftEmojis.length)],
            size: Math.random() * 50 + 30, // Увеличен размер
            speed: Math.random() * 3 + 1, // Медленнее для плавности
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.01,
            wobble: Math.random() * 2
        });
    }
    
    let frame = 0;
    const maxFrames = 450; // Увеличено с 180 до 450 кадров (15 секунд при 30fps)
    
    function animateGifts() {
        if (frame >= maxFrames) {
            if (canvas && canvas.parentNode) {
                canvas.remove();
            }
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        gifts.forEach(g => {
            g.y += g.speed;
            g.x += Math.sin(g.y * 0.02 + frame * 0.01) * g.wobble;
            g.rotation += g.rotationSpeed;
            
            if (g.y > canvas.height + 100) {
                g.y = -100;
                g.x = Math.random() * canvas.width;
            }
            
            ctx.save();
            ctx.translate(g.x, g.y);
            ctx.rotate(g.rotation);
            ctx.font = `${g.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            ctx.shadowBlur = 15;
            ctx.fillText(g.emoji, 0, 0);
            ctx.restore();
        });
        
        frame++;
        requestAnimationFrame(animateGifts);
    }
    
    animateGifts();
}

// Эффект сердечек - увеличен с 5 до 12 секунд
function createHeartsEffect() {
    let canvas = document.getElementById('celebration-canvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'celebration-canvas';
        document.body.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const hearts = [];
    const heartCount = 80; // Увеличено количество сердечек
    const colors = ['#ff6b6b', '#ff4757', '#ff3838', '#ff5252', '#ff6b8b', '#ff8b8b', '#ff9b9b', '#ffabab'];
    
    function drawHeart(ctx, x, y, size, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 20, size / 20);
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(255, 100, 100, 0.5)';
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(-5, -5, -15, -5, -15, 5);
        ctx.bezierCurveTo(-15, 15, 0, 25, 0, 25);
        ctx.bezierCurveTo(0, 25, 15, 15, 15, 5);
        ctx.bezierCurveTo(15, -5, 5, -5, 0, 5);
        ctx.fill();
        ctx.restore();
    }
    
    for (let i = 0; i < heartCount; i++) {
        hearts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 40 + 20, // Увеличен размер
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 1, // Медленнее
            wobble: Math.random() * 0.8,
            angle: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.7 + 0.3
        });
    }
    
    let frame = 0;
    const maxFrames = 360; // Увеличено с 150 до 360 кадров (12 секунд при 30fps)
    
    function animateHearts() {
        if (frame >= maxFrames) {
            if (canvas && canvas.parentNode) {
                canvas.remove();
            }
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Добавляем легкую дымку
        ctx.fillStyle = 'rgba(255, 200, 220, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        hearts.forEach(h => {
            h.y += h.speed;
            h.x += Math.sin(h.y * 0.02 + h.angle) * h.wobble;
            
            if (h.y > canvas.height + 100) {
                h.y = -100;
                h.x = Math.random() * canvas.width;
            }
            
            ctx.globalAlpha = h.opacity * (1 - frame / maxFrames * 0.3); // Плавное затухание
            drawHeart(ctx, h.x, h.y, h.size, h.color);
        });
        
        frame++;
        requestAnimationFrame(animateHearts);
    }
    
    animateHearts();
}

// Общая функция анимации для простых эффектов - увеличена длительность
function animateEffect(canvas, ctx, particles, duration) {
    let startTime = Date.now();
    
    function animate() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        
        if (elapsed > duration) {
            if (canvas && canvas.parentNode) {
                canvas.remove();
            }
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Плавное затухание в конце
        const opacity = 1 - Math.max(0, (elapsed - duration * 0.7) / (duration * 0.3));
        
        particles.forEach(p => {
            p.y += p.speed;
            p.x += Math.sin(p.y * 0.01 + p.angle) * (p.wobble || 0.5);
            p.rotation += p.wobble || 0;
            
            if (p.y > canvas.height + 50) {
                p.y = -50;
                p.x = Math.random() * canvas.width;
            }
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation || 0);
            ctx.globalAlpha = (p.opacity || 1) * opacity;
            ctx.fillStyle = p.color;
            
            if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(0, -p.size/2);
                ctx.lineTo(p.size/2, p.size/2);
                ctx.lineTo(-p.size/2, p.size/2);
                ctx.closePath();
                ctx.fill();
            } else if (p.shape === 'star') {
                drawStar(ctx, 0, 0, 5, p.size/2, p.size/4);
            } else {
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            }
            
            ctx.restore();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// Функция для рисования звезды
function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;
    
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerR;
        let y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;
        
        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.closePath();
    ctx.fill();
}

// Функция для показа праздничного сообщения (увеличено до 5 секунд)
function showCelebrationMessage() {
    const message = document.createElement('div');
    message.className = 'celebration-message';
    
    const messages = [
        '🎉 УРОВЕНЬ {level} ПРОЙДЕН! 🎉',
        '⭐ ПОБЕДА! УРОВЕНЬ {level} ⭐',
        '🏆 ТЫ ПРОШЕЛ УРОВЕНЬ {level}! 🏆',
        '✨ УРОВЕНЬ {level} ЗАВЕРШЕН! ✨',
        '🎊 ОТЛИЧНО! УРОВЕНЬ {level} 🎊',
        '💫 ПРОГРЕСС! УРОВЕНЬ {level} 💫'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    message.innerHTML = randomMessage.replace('{level}', currentLevel);
    
    document.body.appendChild(message);
    
    // Увеличено с 3 до 5 секунд
    setTimeout(() => {
        if (document.body.contains(message)) {
            document.body.removeChild(message);
        }
    }, 5000); // 5 секунд
}

// Обновленная функция levelComplete
function levelComplete() {
    gameActive = false;
    clearInterval(gameInterval);
    stopArrowMovement();
    
    elapsedTime += (Date.now() - startTime) / 1000;
    
    // Сохраняем результат с текущим именем игрока
    saveLeaderboardResult(currentLevel, moves, elapsedTime);
    
    // Добавляем эффект свечения для камеры
    const cameraContainer = document.querySelector('.camera-container');
    const statsPanel = document.querySelector('.stats-panel');
    
    // Проверяем, кратен ли пройденный уровень 3
    if (currentLevel % 3 === 0) {
        celebrateWithEffects();
        showCelebrationMessage();
        
        if (cameraContainer) {
            cameraContainer.classList.add('celebrate');
        }
        if (statsPanel) {
            statsPanel.classList.add('celebrate');
        }
    }
    
    setTimeout(() => {
        showNotification(`Уровень ${currentLevel} пройден!`, themes[currentTheme].primary);
        
        currentLevel++;
        levelDisplay.textContent = currentLevel;
        
        initCanvasSizes();
        generateMaze();
        startGame();
        
        // Убираем эффекты после запуска нового уровня
        if (cameraContainer) {
            cameraContainer.classList.remove('celebrate');
        }
        if (statsPanel) {
            statsPanel.classList.remove('celebrate');
        }
    }, 500);
}

// Функция для воспроизведения звука победы
function playVictorySound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Выбираем случайную мелодию
        const melodyType = Math.floor(Math.random() * 3);
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2); // Увеличено затухание
        
        if (melodyType === 0) {
            // Веселая мелодия
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // До
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15); // Ми
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.3); // Соль
            oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.45); // До (высокая)
            oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.8); // Повтор
        } else if (melodyType === 1) {
            // Победная
            oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // Ре
            oscillator.frequency.setValueAtTime(698.46, audioContext.currentTime + 0.2); // Фа
            oscillator.frequency.setValueAtTime(880.00, audioContext.currentTime + 0.4); // Ля
            oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.6); // Ре (высокая)
            oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 1.0); // Повтор
        } else {
            // Фанфара
            oscillator.frequency.setValueAtTime(415.30, audioContext.currentTime); // Соль-диез
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.15); // До
            oscillator.frequency.setValueAtTime(622.25, audioContext.currentTime + 0.3); // Ре-диез
            oscillator.frequency.setValueAtTime(830.61, audioContext.currentTime + 0.45); // Соль-диез (высокий)
            oscillator.frequency.setValueAtTime(830.61, audioContext.currentTime + 0.9); // Повтор
        }
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 2); // Увеличено до 2 секунд
    } catch (e) {
        console.log('Аудио эффект не поддерживается');
    }
}

// ========== ТАБЛИЦА ЛИДЕРОВ ==========
let leaderboard = [];

function loadLeaderboard() {
    const saved = localStorage.getItem('grandwarmup-leaderboard');
    if (saved) {
        leaderboard = JSON.parse(saved);
    }
    displayLeaderboard();
}

function saveLeaderboardResult(level, moves, time) {
    // Используем текущее имя игрока без запроса
    const result = {
        name: playerName,
        level: level,
        moves: moves,
        time: time,
        date: new Date().toLocaleDateString()
    };
    
    leaderboard.push(result);
    
    // Сортируем по уровню (выше уровень - лучше), затем по ходам (меньше - лучше), затем по времени (меньше - лучше)
    leaderboard.sort((a, b) => {
        //if (a.level !== b.level) return b.level - a.level;
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
    });
    
    // Оставляем только топ-10
    leaderboard = leaderboard.slice(0, 10);
    
    localStorage.setItem('grandwarmup-leaderboard', JSON.stringify(leaderboard));
    displayLeaderboard();
    showNotification(`Результат сохранен для ${playerName}!`, themes[currentTheme].primary);
}

function displayLeaderboard() {
    const panel = document.getElementById('panel-leaderboard');
    if (!panel) return;
    
    const body = panel.querySelector('.panel-body');
    if (!body) return;
    
    if (leaderboard.length === 0) {
        body.innerHTML = `
            <div class="leaderboard-empty">
                <i class="fas fa-trophy fa-3x"></i>
                <p>Таблица лидеров пока пуста</p>
                <span>Сыграйте игру, чтобы появились результаты</span>
            </div>
        `;
    } else {
        let html = `
            <div class="leaderboard-header-small">
                <span><i class="fas fa-user"></i> Текущий игрок: <strong>${playerName}</strong></span>
                <button class="btn-change-name" id="change-name-from-leaderboard">
                    <i class="fas fa-edit"></i> Сменить имя
                </button>
            </div>
            <div class="leaderboard-list">
                <div class="leaderboard-header">
                    <span>#</span>
                    <span>Игрок</span>
                    <span>Уровень</span>
                    <span>Ходы</span>
                    <span>Время</span>
                </div>
        `;
        
        leaderboard.forEach((entry, index) => {
            const isCurrentPlayer = entry.name === playerName;
            html += `
                <div class="leaderboard-entry ${index < 3 ? 'top-' + (index + 1) : ''} ${isCurrentPlayer ? 'current-player' : ''}">
                    <span class="rank">${index + 1}</span>
                    <span class="name">${entry.name} ${isCurrentPlayer ? '<i class="fas fa-crown"></i>' : ''}</span>
                    <span class="level">${entry.level}</span>
                    <span class="moves">${entry.moves}</span>
                    <span class="time">${formatTime(entry.time)}</span>
                </div>
            `;
        });
        
        html += `<button class="btn btn-reset-leaderboard"><i class="fas fa-trash"></i> Очистить таблицу</button>`;
        body.innerHTML = html;
        
        // Добавляем обработчик для кнопки смены имени
        const changeNameBtn = body.querySelector('#change-name-from-leaderboard');
        if (changeNameBtn) {
            changeNameBtn.addEventListener('click', function() {
                openChangeNameModal();
            });
        }
        
        // Добавляем обработчик для кнопки очистки
        const resetBtn = body.querySelector('.btn-reset-leaderboard');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('Очистить таблицу лидеров?')) {
                    leaderboard = [];
                    localStorage.removeItem('grandwarmup-leaderboard');
                    displayLeaderboard();
                    showNotification('Таблица лидеров очищена', themes[currentTheme].primary);
                }
            });
        }
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimer() {
    if (!gameActive) return;
    
    const currentTime = Date.now();
    const totalSeconds = elapsedTime + (currentTime - startTime) / 1000;
    timeDisplay.textContent = formatTime(totalSeconds);
}

function startGame() {
    if (!gameStarted) {
        alert("Сначала активируйте камеру, нажав 'Начать игру'");
        return;
    }
    
    gameActive = true;
    startTime = Date.now();
    moves = 0;
    movesDisplay.textContent = moves;
    
    clearInterval(gameInterval);
    gameInterval = setInterval(updateTimer, 1000);
    
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Игра активна. Используйте жесты или стрелки';
    statusDiv.className = 'status status-active';
    
    showNotification(`Игра началась, ${playerName}!`, themes[currentTheme].primary);
}

function resetGame() {
    gameActive = false;
    clearInterval(gameInterval);
    stopArrowMovement();
    
    elapsedTime = 0;
    currentLevel = 1;
    moves = 0;
    
    timeDisplay.textContent = '00:00';
    movesDisplay.textContent = '0';
    levelDisplay.textContent = '1';
    
    initCanvasSizes();
    generateMaze();
    
    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Игра сброшена. Нажмите "Начать игру"';
    statusDiv.className = 'status status-inactive';
    
    showNotification('Игра сброшена', themes[currentTheme].primary);
}

function detectGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    
    const isHandRaised = 
        indexTip.y < indexBase.y &&
        middleTip.y < middleBase.y &&
        ringTip.y < landmarks[13].y &&
        pinkyTip.y < landmarks[17].y;
    
    if (isHandRaised) return 'up';
    
    const isFist = 
        indexTip.y > indexBase.y &&
        middleTip.y > middleBase.y &&
        ringTip.y > landmarks[13].y &&
        pinkyTip.y > landmarks[17].y;
    
    if (isFist) return 'right';
    
    const isOpenHand = 
        Math.abs(indexTip.x - middleTip.x) < 0.2 &&
        Math.abs(middleTip.x - ringTip.x) < 0.2 &&
        Math.abs(ringTip.x - pinkyTip.x) < 0.2 &&
        indexTip.y < indexBase.y &&
        middleTip.y < middleBase.y;
    
    if (isOpenHand) return 'left';
    
    const isOneFingerUp = 
        indexTip.y < indexBase.y &&
        middleTip.y > middleBase.y &&
        ringTip.y > landmarks[13].y &&
        pinkyTip.y > landmarks[17].y;
    
    if (isOneFingerUp) return 'down';
    
    return null;
}

function smoothPosition(x, y) {
    const smoothedX = previousHandPosition.x * 0.3 + x * 0.7;
    const smoothedY = previousHandPosition.y * 0.3 + y * 0.7;
    
    previousHandPosition = { x: smoothedX, y: smoothedY };
    return { x: smoothedX, y: smoothedY };
}

function drawHandLandmarks(landmarks, gesture) {
    handCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);
    
    if (landmarks && landmarks.length > 0) {
        const pointsToDraw = [0, 5, 8, 9, 12, 13, 16, 17, 20];
        
        pointsToDraw.forEach(i => {
            const x = landmarks[i].x * handOverlay.width;
            const y = landmarks[i].y * handOverlay.height;
            
            handCtx.beginPath();
            handCtx.arc(x, y, 6, 0, 2 * Math.PI);
            
            if (i === 0) {
                handCtx.fillStyle = themes[currentTheme].primary;
            } else if (i === 8) {
                handCtx.fillStyle = gesture ? '#00ff00' : '#ff6b6b';
            } else {
                handCtx.fillStyle = '#ffffff';
            }
            
            handCtx.fill();
            handCtx.strokeStyle = '#000000';
            handCtx.stroke();
        });
        
        if (gesture && gameActive) {
            const centerX = handOverlay.width / 2;
            
            handCtx.fillStyle = themes[currentTheme].primary;
            handCtx.font = 'bold 24px Arial';
            handCtx.textAlign = 'center';
            handCtx.textBaseline = 'top';
            
            let gestureText = '';
            switch(gesture) {
                case 'up': gestureText = '↑ ВВЕРХ'; break;
                case 'down': gestureText = '↓ ВНИЗ'; break;
                case 'left': gestureText = '← ВЛЕВО'; break;
                case 'right': gestureText = '→ ВПРАВО'; break;
            }
            
            handCtx.fillText(gestureText, centerX, 20);
        }
    }
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const gesture = detectGesture(landmarks);
        
        if (gameActive && gesture && !gestureCooldown) {
            processGesture(gesture);
        }
        
        drawHandLandmarks(landmarks, gesture);
        
        if (landmarks[0]) {
            currentHandPosition = {
                x: landmarks[0].x * handOverlay.width,
                y: landmarks[0].y * handOverlay.height
            };
            currentHandPosition = smoothPosition(currentHandPosition.x, currentHandPosition.y);
        }
    } else {
        handCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);
    }
}

function processGesture(gesture) {
    if (!gesture || gestureCooldown) return;
    
    const now = Date.now();
    if (now - lastGestureTime < 150) return;
    
    Object.values(gestureCards).forEach(card => {
        card.classList.remove('gesture-active');
    });
    
    let moved = false;
    
    switch(gesture) {
        case 'up':
            moved = movePlayer(0, -1);
            if (gestureCards.up) gestureCards.up.classList.add('gesture-active');
            break;
        case 'down':
            moved = movePlayer(0, 1);
            if (gestureCards.down) gestureCards.down.classList.add('gesture-active');
            break;
        case 'left':
            moved = movePlayer(-1, 0);
            if (gestureCards.left) gestureCards.left.classList.add('gesture-active');
            break;
        case 'right':
            moved = movePlayer(1, 0);
            if (gestureCards.right) gestureCards.right.classList.add('gesture-active');
            break;
    }
    
    if (moved) {
        lastGesture = gesture;
        lastGestureTime = now;
        
        gestureCooldown = true;
        setTimeout(() => {
            gestureCooldown = false;
            setTimeout(() => {
                Object.values(gestureCards).forEach(card => {
                    card.classList.remove('gesture-active');
                });
            }, 100);
        }, 150);
    }
}

function startArrowMovement() {
    if (!gameActive) return;
    
    stopArrowMovement();
    
    arrowMoveInterval = setInterval(() => {
        let moved = false;
        
        if (arrowKeys.up) moved = movePlayer(0, -1) || moved;
        if (arrowKeys.down) moved = movePlayer(0, 1) || moved;
        if (arrowKeys.left) moved = movePlayer(-1, 0) || moved;
        if (arrowKeys.right) moved = movePlayer(1, 0) || moved;
        
        Object.keys(gestureCards).forEach(key => {
            if (arrowKeys[key]) {
                gestureCards[key].classList.add('gesture-active');
            } else {
                gestureCards[key].classList.remove('gesture-active');
            }
        });
        
    }, 80);
}

function stopArrowMovement() {
    if (arrowMoveInterval) {
        clearInterval(arrowMoveInterval);
        arrowMoveInterval = null;
    }
    
    Object.values(gestureCards).forEach(card => {
        card.classList.remove('gesture-active');
    });
}

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
                frameRate: { ideal: 30 }
            } 
        });
        
        cameraFeed.srcObject = stream;
        gameStarted = true;
        
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onResults);
        
        const camera = new Camera(cameraFeed, {
            onFrame: async () => {
                if (hands) {
                    await hands.send({image: cameraFeed});
                }
            },
            width: 640,
            height: 480
        });
        
        camera.start();
        
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Камера активна. Начните игру';
        statusDiv.className = 'status status-active';

        // Синхронизируем чекбокс в настройках
        syncCameraToggle();
        
        return true;
    } catch (err) {
        console.error("Ошибка доступа к камере:", err);
        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка доступа к камере';
        statusDiv.className = 'status status-inactive';
        return false;
    }
}

// Новая функция остановки камеры
function stopCamera() {
    if (cameraFeed.srcObject) {
        const tracks = cameraFeed.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        cameraFeed.srcObject = null;
    }
    gameStarted = false;
    gameActive = false;
    clearInterval(gameInterval);
    stopArrowMovement();
    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Камера остановлена';
    statusDiv.className = 'status status-inactive';
    
    // Обновить чекбокс в настройках
    syncCameraToggle();
}

// Синхронизация чекбокса камеры
function syncCameraToggle() {
    const camToggle = document.getElementById('camera-toggle');
    if (camToggle) camToggle.checked = gameStarted;
}

function setSensitivity(level) {
    switch(level) {
        case 1: sensitivity = SENSITIVITY.LOW; break;
        case 2: sensitivity = SENSITIVITY.MEDIUM; break;
        case 3: sensitivity = SENSITIVITY.HIGH; break;
        case 4: sensitivity = SENSITIVITY.VERY_HIGH; break;
        default: sensitivity = SENSITIVITY.MEDIUM;
    }
    
    const sensitivityText = ['НИЗКАЯ', 'СРЕДНЯЯ', 'ВЫСОКАЯ', 'ОЧЕНЬ ВЫСОКАЯ'][level-1];
    showNotification(`Чувствительность: ${sensitivityText}`, themes[currentTheme].primary);
}

startBtn.addEventListener('click', async () => {
    if (!gameStarted) {
        const cameraStarted = await initCamera();
        if (cameraStarted) {
            initCanvasSizes();
            generateMaze();
            startGame();
        }
    } else {
        startGame();
    }
});

resetBtn.addEventListener('click', resetGame);

document.addEventListener('keydown', (e) => {
    if (!gameActive && e.key !== '1' && e.key !== '2' && e.key !== '3' && e.key !== '4') return;
    
    switch(e.key) {
        case 'ArrowUp':
            e.preventDefault();
            arrowKeys.up = true;
            startArrowMovement();
            break;
        case 'ArrowDown':
            e.preventDefault();
            arrowKeys.down = true;
            startArrowMovement();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            arrowKeys.left = true;
            startArrowMovement();
            break;
        case 'ArrowRight':
            e.preventDefault();
            arrowKeys.right = true;
            startArrowMovement();
            break;
        case '1': setSensitivity(1); break;
        case '2': setSensitivity(2); break;
        case '3': setSensitivity(3); break;
        case '4': setSensitivity(4); break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowUp': arrowKeys.up = false; break;
        case 'ArrowDown': arrowKeys.down = false; break;
        case 'ArrowLeft': arrowKeys.left = false; break;
        case 'ArrowRight': arrowKeys.right = false; break;
    }
    
    if (!arrowKeys.up && !arrowKeys.down && !arrowKeys.left && !arrowKeys.right) {
        stopArrowMovement();
    }
});

window.addEventListener('load', () => {
    initCanvasSizes();
    generateMaze();
    
    window.addEventListener('resize', () => {
        initCanvasSizes();
        generateMaze();
    });
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    // Загружаем сохраненное имя
    const savedName = localStorage.getItem('grandwarmup-player-name');
    if (savedName) {
        playerName = savedName;
    }
    
    // Создаем модальное окно имени
    createPlayerNameModal();
    
    // Загружаем таблицу лидеров
    loadLeaderboard();
    
    // Загружаем сохраненную тему
    const savedTheme = localStorage.getItem('grandwarmup-theme');
    if (savedTheme && themes[savedTheme]) {
        applyTheme(savedTheme);
    }

    // Синхронизируем чекбокс камеры при загрузке
    syncCameraToggle();
});

// ========== ПОЛНАЯ ЛОГИКА РАБОТЫ ВКЛАДОК ==========
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    const closeButtons = document.querySelectorAll('.close-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const panelId = this.id.replace('tab', 'panel');
            const targetPanel = document.getElementById(panelId);
            
            panels.forEach(panel => panel.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            if (targetPanel) {
                targetPanel.classList.add('active');
                this.classList.add('active');
            }
        });
    });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const panel = this.closest('.tab-panel');
            if (panel) {
                panel.classList.remove('active');
                const tabId = panel.id.replace('panel', 'tab');
                const tab = document.getElementById(tabId);
                if (tab) tab.classList.remove('active');
            }
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tab-panel') && !e.target.closest('.tab')) {
            panels.forEach(panel => panel.classList.remove('active'));
            tabs.forEach(tab => tab.classList.remove('active'));
        }
    });

    // ========== ГЛАВНОЕ МЕНЮ - ПОЛНАЯ НАВИГАЦИЯ ==========
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const action = this.querySelector('span').textContent;
            
            menuItems.forEach(i => i.classList.remove('menu-item-active'));
            this.classList.add('menu-item-active');
            
            switch(action) {
                case 'Новая игра':
                    if (gameStarted) {
                        resetGame();
                        startGame();
                    } else {
                        alert('Сначала активируйте камеру');
                    }
                    break;
                    
                case 'Сменить имя':
                    openChangeNameModal();
                    break;
                    
                case 'Настройки':
                    // Открыть панель настроек
                    panels.forEach(p => p.classList.remove('active'));
                    tabs.forEach(t => t.classList.remove('active'));
                    document.getElementById('panel-settings').classList.add('active');
                    document.getElementById('tab-settings').classList.add('active');
                    break;
                    
                case 'Обучение':
                    showNotification('Обучение: используйте жесты для управления', themes[currentTheme].primary);
                    break;
                    
                case 'О программе':
                    alert(`GrandWarmUp v2.0\nУправление жестами для игр\nРазработано в 2025-2026\n\nТекущий игрок: ${playerName}`);
                    break;
            }
        });
    });

    // ========== ОТТЕНОК САЙТА - ПОЛНАЯ СМЕНА ТЕМ ==========
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const theme = this.dataset.theme;
            
            themeOptions.forEach(opt => {
                opt.classList.remove('theme-active');
                opt.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            
            this.classList.add('theme-active');
            this.style.background = 'rgba(76, 201, 240, 0.25)';
            
            applyTheme(theme);
        });
    });

    // ========== ТАБЛИЦА ЛИДЕРОВ ==========
    loadLeaderboard();
    
    // Добавляем кнопку обновления таблицы
    const leaderboardPanel = document.getElementById('panel-leaderboard');
    if (leaderboardPanel) {
        const header = leaderboardPanel.querySelector('.panel-header');
        if (header) {
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'close-panel';
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            refreshBtn.style.marginRight = '10px';
            refreshBtn.title = 'Обновить таблицу';
            refreshBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                loadLeaderboard();
                showNotification('Таблица лидеров обновлена', themes[currentTheme].primary);
            });
            header.appendChild(refreshBtn);
        }
    }

    // ========== НАСТРОЙКИ ==========
    const cameraToggle = document.getElementById('camera-toggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('change', function(e) {
            if (this.checked) {
                if (!gameStarted) initCamera();
            } else {
                if (gameStarted) stopCamera();
            }
        });
    }

    // Чувствительность жестов
    const sensitivityRadios = document.querySelectorAll('input[name="sensitivity"]');
    sensitivityRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const val = this.value;
                let level;
                switch(val) {
                    case 'low': level = 1; break;
                    case 'medium': level = 2; break;
                    case 'high': level = 3; break;
                    case 'very_high': level = 4; break;
                    default: level = 2;
                }
                setSensitivity(level);
                // Сохранить выбор в localStorage
                localStorage.setItem('grandwarmup-sensitivity', val);
            }
        });
    });

    // Звук
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', function() {
            localStorage.setItem('grandwarmup-sound', this.checked ? 'on' : 'off');
            showNotification(this.checked ? 'Звук включён' : 'Звук выключен', themes[currentTheme].primary);
        });
    }

    // Сброс настроек
    const resetSettingsBtn = document.getElementById('reset-settings');
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', function() {
            // Сброс камеры (включить)
            if (!gameStarted) {
                initCamera();
            }
            cameraToggle.checked = true;
            
            // Сброс чувствительности на среднюю
            document.querySelector('input[name="sensitivity"][value="medium"]').checked = true;
            setSensitivity(2);
            localStorage.setItem('grandwarmup-sensitivity', 'medium');
            
            // Сброс звука (включить)
            soundToggle.checked = true;
            localStorage.setItem('grandwarmup-sound', 'on');
            
            showNotification('Настройки сброшены', themes[currentTheme].primary);
        });
    }

    // Загрузка сохранённых настроек
    const savedSensitivity = localStorage.getItem('grandwarmup-sensitivity');
    if (savedSensitivity) {
        const radio = document.querySelector(`input[name="sensitivity"][value="${savedSensitivity}"]`);
        if (radio) {
            radio.checked = true;
            // Применить
            let level;
            switch(savedSensitivity) {
                case 'low': level = 1; break;
                case 'medium': level = 2; break;
                case 'high': level = 3; break;
                case 'very_high': level = 4; break;
            }
            setSensitivity(level);
        }
    }

    const savedSound = localStorage.getItem('grandwarmup-sound');
    if (savedSound === 'off') {
        soundToggle.checked = false;
    } else {
        soundToggle.checked = true;
    }
});
