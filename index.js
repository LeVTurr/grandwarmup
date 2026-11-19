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
    right: document.getElementById('gesture-right'),
    defuse: document.getElementById('gesture-defuse')
};

let gameMode = 'warmup';
let gameActive = false;
let gameStarted = false;
let startTime = 0;
let elapsedTime = 0;
let moves = 0;
let currentLevel = 1;
let gameInterval;

let userCellSize = 40;
let cellSize = 40;
let mazeWidth = 0, mazeHeight = 0, cols = 0, rows = 0;
let maze = [];
let player = { x: 1, y: 1 };
let finish = { x: 0, y: 0 };
let mines = [];

let hands = null;
let lastGesture = null;
let gestureCooldown = false;
let lastGestureTime = 0;
let lastDefuseTime = 0;
let currentHandPosition = { x: 0, y: 0 };
let previousHandPosition = { x: 0, y: 0 };
let showHandSkeleton = true;

const SENSITIVITY = { LOW: 0.7, MEDIUM: 1.0, HIGH: 1.3, VERY_HIGH: 1.6 };
let sensitivity = SENSITIVITY.MEDIUM;

let arrowKeys = { up: false, down: false, left: false, right: false };
let arrowMoveInterval = null;

let compTimer = 0;
let compTimerInterval = null;
let difficultyTier = 0;
let competitionRun = null;
let defuseCharges = 3;

let achCurrentMode = 'warmup';
let greetingsScheduled = false;

const DIFFICULTY_TIERS = [
    { name: 'Лёгкий',   cellSize: 40, time: 60, mines: 0 },
    { name: 'Средний',  cellSize: 34, time: 55, mines: 0 },
    { name: 'Сложный',  cellSize: 32, time: 50, mines: 3 },
    { name: 'Опасный',  cellSize: 28, time: 45, mines: 5 },
    { name: 'Безумный', cellSize: 26, time: 40, mines: 7 },
    { name: 'Адский',   cellSize: 24, time: 35, mines: 10 }
];

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 44;
const COMPETITION_MIN_LEVEL = 6;

function getTierForLevel(level) {
    const idx = Math.floor((level - 1) / 3);
    return DIFFICULTY_TIERS[Math.min(idx, DIFFICULTY_TIERS.length - 1)];
}
function getTierIndexForLevel(level) {
    const idx = Math.floor((level - 1) / 3);
    return Math.min(idx, DIFFICULTY_TIERS.length - 1);
}

// ═══════════ ИГРОК И ТЕМЫ ═══════════
let playerName = 'Игрок';

const themes = {
    purple: { label: 'Фиолетовый', primary: '#a855f7', accent: '#a855f7', accent2: '#d946ef', rgb: '168, 85, 247', rgb2: '217, 70, 239', light: '#c4b5fd', mazeBg: '#1a1228', mazeWall: 'rgba(168, 85, 247, 0.5)', player: '#a855f7', finish: '#fb7185' },
    blue:   { label: 'Синий', primary: '#3b82f6', accent: '#3b82f6', accent2: '#06b6d4', rgb: '59, 130, 246', rgb2: '6, 182, 212', light: '#93c5fd', mazeBg: '#0a1830', mazeWall: 'rgba(59, 130, 246, 0.5)', player: '#3b82f6', finish: '#fb7185' },
    green:  { label: 'Зелёный', primary: '#10b981', accent: '#10b981', accent2: '#14b8a6', rgb: '16, 185, 129', rgb2: '20, 184, 166', light: '#6ee7b7', mazeBg: '#0a2018', mazeWall: 'rgba(16, 185, 129, 0.5)', player: '#10b981', finish: '#fb7185' },
    pink:   { label: 'Розовый', primary: '#ec4899', accent: '#ec4899', accent2: '#f43f5e', rgb: '236, 72, 153', rgb2: '244, 63, 94', light: '#f9a8d4', mazeBg: '#241028', mazeWall: 'rgba(236, 72, 153, 0.5)', player: '#ec4899', finish: '#fbbf24' }
};
let currentTheme = 'purple';

function applyTheme(themeName) {
    if (!themes[themeName]) themeName = 'purple';
    currentTheme = themeName;
    const t = themes[themeName];
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2);
    root.style.setProperty('--accent-rgb', t.rgb);
    root.style.setProperty('--accent-2-rgb', t.rgb2);
    root.style.setProperty('--accent-light', t.light);
    drawMaze();
    localStorage.setItem('grandwarmup-theme', themeName);
    showNotification(`Тема: ${t.label}`, t.primary);
}

function showNotification(message, color = '#a855f7') {
    const n = document.createElement('div');
    n.className = 'notification';
    n.style.borderLeft = `4px solid ${color}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => {
        if (document.body.contains(n)) document.body.removeChild(n);
    }, 3000);
}

// ═══════════ SUPABASE AUTH ═══════════
const SUPABASE_URL = 'https://kwodxtruvyylwvczgkyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AJmWk3jnGNdg6UVrH2ZqYg_qFppgDPa';
const SESSION_KEY = 'gw-supabase-session';

const authUI = {
    overlay:     document.getElementById('authOverlay'),
    form:        document.getElementById('authForm'),
    title:       document.getElementById('authTitle'),
    subtitle:    document.getElementById('authSubtitle'),
    nameField:   document.getElementById('authNameField'),
    name:        document.getElementById('authName'),
    email:       document.getElementById('authEmail'),
    password:    document.getElementById('authPassword'),
    error:       document.getElementById('authError'),
    submit:      document.getElementById('authSubmit'),
    switchText:  document.getElementById('authSwitchText'),
    switchBtn:   document.getElementById('authSwitchBtn'),
    togglePass:  document.getElementById('authTogglePass'),
    userbar:     document.getElementById('authUserbar'),
    userInitial: document.getElementById('authUserInitial'),
    userName:    document.getElementById('authUserName'),
    logout:      document.getElementById('authLogout')
};

let authMode = 'login';
let currentUser = null;
let authBound = false;

function sbHeaders(extra = {}) {
    return { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8', ...extra };
}

function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function translateError(data) {
    const msg = (data && (data.error_description || data.msg || data.message)) || '';
    if (msg.includes('already registered') || msg.includes('already exists')) return 'Пользователь с таким email уже зарегистрирован';
    if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль';
    if (msg.includes('Email not confirmed')) return 'Сначала подтвердите почту';
    if (msg.includes('Password should be')) return 'Пароль слишком простой (минимум 6 символов)';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'Слишком много попыток. Попробуйте позже';
    if (msg) return msg;
    return 'Неизвестная ошибка сервера';
}

async function sbRegister({ email, password, name }) {
    email = (email || '').trim().toLowerCase();
    name = (name || '').trim();
    if (!email || !password) return { ok: false, error: 'Заполните все поля' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Некорректный email' };
    if (password.length < 6) return { ok: false, error: 'Пароль минимум 6 символов' };
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ email, password, data: { name: name || email.split('@')[0] } })
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: translateError(data) };
        const userObj = data.user || data;
        const accessToken = data.access_token || (data.session && data.session.access_token);
        const refreshToken = data.refresh_token || (data.session && data.session.refresh_token);
        if (!accessToken) {
            return {
                ok: true,
                needVerification: true,
                user: { id: userObj.id, email: userObj.email, name: userObj.user_metadata?.name || email.split('@')[0] }
            };
        }
        const user = { id: userObj.id, email: userObj.email, name: userObj.user_metadata?.name || email.split('@')[0] };
        saveSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: Date.now() + (data.expires_in || 3600) * 1000, user });
        return { ok: true, user };
    } catch (err) {
        return { ok: false, error: 'Ошибка сети: ' + err.message };
    }
}

async function sbLogin({ email, password }) {
    email = (email || '').trim().toLowerCase();
    if (!email || !password) return { ok: false, error: 'Заполните все поля' };
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: translateError(data) };
        const user = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || email.split('@')[0] };
        saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000, user });
        return { ok: true, user };
    } catch (err) {
        return { ok: false, error: 'Ошибка сети: ' + err.message };
    }
}

async function sbLogout() {
    const session = loadSession();
    if (session && session.access_token) {
        try {
            await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                method: 'POST',
                headers: sbHeaders({ 'Authorization': `Bearer ${session.access_token}` })
            });
        } catch {}
    }
    saveSession(null);
    return { ok: true };
}

async function sbGetUser() {
    const session = loadSession();
    if (!session) return { ok: true, user: null };
    if (session.expires_at > Date.now() + 60 * 1000) return { ok: true, user: session.user };
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) { saveSession(null); return { ok: true, user: null }; }
        const data = await res.json();
        const user = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email.split('@')[0] };
        saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000, user });
        return { ok: true, user };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

function setAuthMode(mode) {
    authMode = mode;
    if (!authUI.title) return;
    const isLogin = mode === 'login';
    authUI.title.textContent = isLogin ? 'Вход' : 'Регистрация';
    if (authUI.subtitle) authUI.subtitle.textContent = isLogin ? 'Войдите в свой аккаунт Траектория' : 'Создайте аккаунт для игры';
    if (authUI.submit) authUI.submit.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
    if (authUI.switchText) authUI.switchText.textContent = isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
    if (authUI.switchBtn) authUI.switchBtn.textContent = isLogin ? 'Зарегистрироваться' : 'Войти';
    if (authUI.nameField) authUI.nameField.style.display = isLogin ? 'none' : 'flex';
    if (authUI.password) authUI.password.autocomplete = isLogin ? 'current-password' : 'new-password';
    hideAuthError();
    if (authUI.email) authUI.email.focus();
}

function showAuthError(msg) {
    if (!authUI.error) return;
    authUI.error.textContent = msg;
    authUI.error.classList.add('show');
}
function hideAuthError() { if (authUI.error) authUI.error.classList.remove('show'); }
function showAuthOverlay() { if (authUI.overlay) authUI.overlay.classList.add('active'); }
function hideAuthOverlay() { if (authUI.overlay) authUI.overlay.classList.remove('active'); }

function showUserbar(user) {
    if (!authUI.userbar) return;
    authUI.userbar.classList.add('show');
    if (authUI.userInitial) authUI.userInitial.textContent = (user.name || user.email || '?').charAt(0).toUpperCase();
    if (authUI.userName) authUI.userName.textContent = user.name || user.email || 'Игрок';
}
function hideUserbar() { if (authUI.userbar) authUI.userbar.classList.remove('show'); }

function openAccountModal() {
    if (!currentUser) return;
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    const avatar = document.getElementById('accountAvatar');
    const name = document.getElementById('accountName');
    const email = document.getElementById('accountEmail');
    const id = document.getElementById('accountId');
    const stats = document.getElementById('accountStats');
    if (avatar) avatar.textContent = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();
    if (name) name.textContent = currentUser.name || currentUser.email || 'Игрок';
    if (email) email.textContent = currentUser.email || '—';
    if (id) id.textContent = currentUser.id || '—';
    if (stats) stats.textContent = leaderboard.filter(e => e.name === playerName).length;
    modal.classList.add('active');
}
function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.remove('active');
}
function bindAccountModal() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    const closeBtn = document.getElementById('accountModalClose');
    const logoutBtn = document.getElementById('accountLogoutBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeAccountModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAccountModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeAccountModal(); });
}

async function submitAuth(e) {
    e.preventDefault();
    hideAuthError();
    const email = authUI.email.value.trim();
    const password = authUI.password.value;
    const name = authUI.name.value.trim();
    if (!email || !password) { showAuthError('Заполните все поля'); return; }
    if (authMode === 'register' && !name) { showAuthError('Введите ваше имя'); return; }
    authUI.submit.disabled = true;
    const orig = authUI.submit.textContent;
    authUI.submit.textContent = 'Подождите...';
    try {
        const res = authMode === 'login'
            ? await sbLogin({ email, password })
            : await sbRegister({ email, password, name });
        if (res.ok) {
            if (res.needVerification) {
                showAuthError('Мы отправили письмо на ' + email + '. Подтвердите почту и войдите.');
                setAuthMode('login');
                return;
            }
            await enterApp(res.user);
        } else {
            showAuthError(res.error || 'Ошибка');
        }
    } catch (err) {
        console.error('Ошибка авторизации:', err);
        showAuthError('Ошибка: ' + err.message);
    } finally {
        authUI.submit.disabled = false;
        authUI.submit.textContent = orig;
    }
}

async function enterApp(user) {
    currentUser = user;
    playerName = user.name || user.email.split('@')[0];
    localStorage.setItem('grandwarmup-player-name', playerName);
    showUserbar(user);
    hideAuthOverlay();
    if (authUI.form) authUI.form.reset();
    hideAuthError();
    scheduleGreetings();
    displayLeaderboard();
}

async function logout() {
    closeAccountModal();
    try { await sbLogout(); } catch (err) { console.warn('logout error:', err); }
    currentUser = null;
    playerName = 'Игрок';
    hideUserbar();
    displayLeaderboard();
    setAuthMode('login');
    showAuthOverlay();
    if (authUI.email) authUI.email.value = '';
    if (authUI.password) authUI.password.value = '';
    if (authUI.name) authUI.name.value = '';
}

async function initAuthFlow() {
    if (!authUI.form || !authUI.overlay) return;
    if (!authBound) {
        authBound = true;
        authUI.form.addEventListener('submit', submitAuth);
        authUI.switchBtn.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
        authUI.togglePass.addEventListener('click', () => {
            const isPass = authUI.password.type === 'password';
            authUI.password.type = isPass ? 'text' : 'password';
            authUI.togglePass.innerHTML = isPass ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
        authUI.logout.addEventListener('click', (e) => { e.stopPropagation(); logout(); });
        if (authUI.userbar) {
            authUI.userbar.addEventListener('click', (e) => { if (e.target.closest('#authLogout')) return; openAccountModal(); });
        }
        bindAccountModal();
    }
    try {
        const res = await sbGetUser();
        if (res.ok && res.user) { await enterApp(res.user); return; }
    } catch (err) { console.warn('currentUser error:', err); }
    setAuthMode('login');
    showAuthOverlay();
}

// ═══════════ ПРИВЕТСТВИЯ ═══════════
function showActionNotification(message, icon, actionLabel, actionFn) {
    const n = document.createElement('div');
    n.className = 'notification notification-clickable';
    n.innerHTML = `
        <div class="notif-flex">
            <div class="notif-icon">${icon}</div>
            <div class="notif-body">
                <div class="notif-title">${message}</div>
                <div class="notif-action">${actionLabel} <i class="fas fa-arrow-right" style="font-size:.62rem;"></i></div>
            </div>
            <i class="fas fa-chevron-right notif-arrow"></i>
        </div>
    `;
    n.addEventListener('click', () => {
        actionFn();
        n.style.animation = 'fadeOut 0.25s ease forwards';
        setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
    });
    document.body.appendChild(n);
    setTimeout(() => {
        if (n.parentNode) {
            n.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 320);
        }
    }, 6000);
}

function scheduleGreetings() {
    if (greetingsScheduled) return;
    greetingsScheduled = true;
    setTimeout(() => {
        showActionNotification('Пройди обучение — это займёт 30 секунд', '<i class="fas fa-graduation-cap"></i>', 'Открыть обучение', () => { if (typeof openTutorialPanel === 'function') openTutorialPanel(); });
    }, 2000);
    setTimeout(() => {
        showActionNotification('Загляни в документацию — там всё о приложении', '<i class="fas fa-book-open"></i>', 'Открыть документацию', () => { if (typeof openAboutPanel === 'function') openAboutPanel(); });
    }, 9000);
}

// ═══════════ TOAST УРОВНЯ ═══════════
function showLevelToast(level, isTierUp = false) {
    const old = document.querySelector('.level-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'level-toast' + (isTierUp ? ' tier-up' : '');
    const starsCount = isTierUp ? 3 : 1;
    let stars = '';
    for (let i = 0; i < starsCount; i++) stars += `<i class="fas fa-star" style="animation-delay:${0.05 + i * 0.08}s"></i>`;
    const subtitle = isTierUp ? 'Новая сложность!' : 'Отлично!';
    const title = isTierUp ? `Раунд ${level} пройден` : (gameMode === 'competition' ? `Раунд ${level}` : `Уровень ${level} пройден`);
    toast.innerHTML = `<div class="level-toast-check"><i class="fas fa-check"></i></div><div class="level-toast-body"><div class="level-toast-stars">${stars}</div><div class="level-toast-title">${title}</div><div class="level-toast-sub">${subtitle}</div></div>`;
    const mazeContainer = document.querySelector('.maze-container');
    if (mazeContainer) mazeContainer.appendChild(toast);
    else { toast.style.position = 'fixed'; toast.style.zIndex = '9999'; document.body.appendChild(toast); }
    setTimeout(() => {
        toast.classList.add('level-toast-out');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 450);
    }, 1300);
}

// ═══════════ ЛАБИРИНТ ═══════════
function initCanvasSizes() {
    const width = cameraFeed.videoWidth || 640;
    const height = cameraFeed.videoHeight || 480;
    handOverlay.width = width;
    handOverlay.height = height;
    const mazeContainer = document.querySelector('.maze-container');
    if (!mazeContainer) return;
    const cw = mazeContainer.clientWidth || 600;
    const ch = mazeContainer.clientHeight || 400;
    mazeCanvas.width = cw;
    mazeCanvas.height = ch;
    let c = Math.floor(cw / cellSize) - 2;
    let r = Math.floor(ch / cellSize) - 2;
    if (c < 7) c = 7;
    if (r < 7) r = 7;
    if (c % 2 === 0) c--;
    if (r % 2 === 0) r--;
    cols = c;
    rows = r;
    mazeWidth = cols * cellSize;
    mazeHeight = rows * cellSize;
}

function generateMaze() {
    if (cols < 7 || rows < 7) {
        initCanvasSizes();
        if (cols < 7 || rows < 7) return;
    }
    maze = [];
    for (let y = 0; y < rows; y++) {
        maze[y] = [];
        for (let x = 0; x < cols; x++) maze[y][x] = 1;
    }
    const stack = [];
    const startX = 1, startY = 1;
    maze[startY][startX] = 0;
    stack.push([startX, startY]);
    const maxIterations = Math.min(cols * rows, 500);
    let iterations = 0;
    while (stack.length > 0 && iterations < maxIterations) {
        const top = stack[stack.length - 1];
        if (!top) break;
        const [x, y] = top;
        iterations++;
        const neighbors = [];
        if (y > 1 && maze[y-2][x] === 1) neighbors.push([x, y-2, x, y-1]);
        if (y < rows-2 && maze[y+2][x] === 1) neighbors.push([x, y+2, x, y+1]);
        if (x > 1 && maze[y][x-2] === 1) neighbors.push([x-2, y, x-1, y]);
        if (x < cols-2 && maze[y][x+2] === 1) neighbors.push([x+2, y, x+1, y]);
        if (neighbors.length > 0) {
            const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[ny][nx] = 0;
            maze[wy][wx] = 0;
            stack.push([nx, ny]);
        } else stack.pop();
    }
    player.x = startX;
    player.y = startY;
    const fp = findFarthestPoint(startX, startY);
    finish.x = fp.x;
    finish.y = fp.y;
    maze[finish.y][finish.x] = 0;
    for (let i = 0; i < Math.floor(cols * rows / 30); i++) {
        const x = Math.floor(Math.random() * (cols - 2)) + 1;
        const y = Math.floor(Math.random() * (rows - 2)) + 1;
        if ((x === player.x && y === player.y) || (x === finish.x && y === finish.y)) continue;
        maze[y][x] = 0;
    }
    mines = [];
    if (gameMode === 'competition') {
        const tier = getTierForLevel(currentLevel);
        if (tier.mines > 0) generateMines(tier.mines);
    }
    drawMaze();
}

function canPlaceMine(mx, my) {
    if (!maze.length) return false;
    const visited = Array(rows).fill().map(() => Array(cols).fill(false));
    const queue = [[player.x, player.y]];
    visited[player.y][player.x] = true;
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        if (cx === finish.x && cy === finish.y) return true;
        for (const [dx, dy] of dirs) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx] && maze[ny] && maze[ny][nx] === 0 && !(nx === mx && ny === my)) {
                visited[ny][nx] = true;
                queue.push([nx, ny]);
            }
        }
    }
    return false;
}

function generateMines(count) {
    const forbidden = new Set();
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        forbidden.add(`${player.x + dx},${player.y + dy}`);
        forbidden.add(`${finish.x + dx},${finish.y + dy}`);
    }
    const candidates = [];
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (maze[y] && maze[y][x] === 0 && !forbidden.has(`${x},${y}`)) {
            if (canPlaceMine(x, y)) candidates.push({ x, y });
        }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    mines = candidates.slice(0, count);
}

function findFarthestPoint(startX, startY) {
    const visited = Array(rows).fill().map(() => Array(cols).fill(false));
    const queue = [[startX, startY, 0]];
    visited[startY][startX] = true;
    let fx = startX, fy = startY, maxD = 0;
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
    while (queue.length > 0) {
        const [x, y, d] = queue.shift();
        if (d > maxD) { maxD = d; fx = x; fy = y; }
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx] && maze[ny] && maze[ny][nx] === 0) {
                visited[ny][nx] = true;
                queue.push([nx, ny, d + 1]);
            }
        }
    }
    return { x: fx, y: fy };
}

function drawMaze() {
    const theme = themes[currentTheme];
    mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    mazeCtx.fillStyle = theme.mazeBg;
    mazeCtx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    if (!maze.length) return;
    const offsetX = (mazeCanvas.width - mazeWidth) / 2;
    const offsetY = (mazeCanvas.height - mazeHeight) / 2;
    mazeCtx.fillStyle = theme.mazeWall;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (maze[y][x] === 1) mazeCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
    }
    for (const m of mines) drawMine(offsetX + m.x * cellSize + cellSize / 2, offsetY + m.y * cellSize + cellSize / 2);
    mazeCtx.fillStyle = theme.finish;
    mazeCtx.beginPath();
    mazeCtx.arc(offsetX + finish.x * cellSize + cellSize / 2, offsetY + finish.y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
    mazeCtx.fill();
    mazeCtx.fillStyle = theme.player;
    mazeCtx.beginPath();
    mazeCtx.arc(offsetX + player.x * cellSize + cellSize / 2, offsetY + player.y * cellSize + cellSize / 2, cellSize / 2 - 4, 0, Math.PI * 2);
    mazeCtx.fill();
}

function drawMine(mx, my) {
    mazeCtx.fillStyle = 'rgba(251, 113, 133, 0.35)';
    mazeCtx.beginPath();
    mazeCtx.arc(mx, my, cellSize / 2 - 2, 0, Math.PI * 2);
    mazeCtx.fill();
    mazeCtx.font = `${Math.floor(cellSize * 0.6)}px "Segoe UI Emoji", Arial, sans-serif`;
    mazeCtx.textAlign = 'center';
    mazeCtx.textBaseline = 'middle';
    mazeCtx.fillText('💣', mx, my);
}

function drawPlayerOnly() {
    if (!maze.length) { drawMaze(); return; }
    const theme = themes[currentTheme];
    const offsetX = (mazeCanvas.width - mazeWidth) / 2;
    const offsetY = (mazeCanvas.height - mazeHeight) / 2;
    mazeCtx.fillStyle = theme.mazeBg;
    mazeCtx.fillRect(offsetX + (player.x - 1) * cellSize, offsetY + (player.y - 1) * cellSize, cellSize * 3, cellSize * 3);
    mazeCtx.fillStyle = theme.mazeWall;
    for (let y = Math.max(0, player.y - 2); y < Math.min(rows, player.y + 3); y++) for (let x = Math.max(0, player.x - 2); x < Math.min(cols, player.x + 3); x++) {
        if (maze[y] && maze[y][x] === 1) mazeCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
    }
    for (const m of mines) {
        if (Math.abs(m.x - player.x) <= 2 && Math.abs(m.y - player.y) <= 2) drawMine(offsetX + m.x * cellSize + cellSize / 2, offsetY + m.y * cellSize + cellSize / 2);
    }
    if (Math.abs(finish.x - player.x) <= 2 && Math.abs(finish.y - player.y) <= 2) {
        mazeCtx.fillStyle = theme.finish;
        mazeCtx.beginPath();
        mazeCtx.arc(offsetX + finish.x * cellSize + cellSize / 2, offsetY + finish.y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
        mazeCtx.fill();
    }
    mazeCtx.fillStyle = theme.player;
    mazeCtx.beginPath();
    mazeCtx.arc(offsetX + player.x * cellSize + cellSize / 2, offsetY + player.y * cellSize + cellSize / 2, cellSize / 2 - 4, 0, Math.PI * 2);
    mazeCtx.fill();
}

function movePlayer(dx, dy) {
    if (!gameActive) return false;
    if (!maze.length || !maze[player.y]) return false;
    const newX = player.x + dx, newY = player.y + dy;
    if (newX >= 0 && newX < cols && newY >= 0 && newY < rows && maze[newY] && maze[newY][newX] === 0) {
        player.x = newX; player.y = newY;
        moves++;
        movesDisplay.textContent = moves;
        if (gameMode === 'competition' && competitionRun) competitionRun.totalMoves++;
        drawPlayerOnly();
        if (mines.some(m => m.x === player.x && m.y === player.y)) {
            playExplosionSound();
            gameOver('mine');
            return true;
        }
        if (player.x === finish.x && player.y === finish.y) levelComplete();
        return true;
    }
    return false;
}

function defuseNearestMine() {
    if (gameMode !== 'competition' || !gameActive) return;
    if (mines.length === 0) { showNotification('Мин нет', themes[currentTheme].primary); return; }
    if (defuseCharges <= 0) { showNotification('Заряды закончились!', '#fb7185'); return; }
    let nearest = null, minDist = Infinity;
    for (const m of mines) {
        const d = Math.abs(m.x - player.x) + Math.abs(m.y - player.y);
        if (d < minDist && d <= 5) { minDist = d; nearest = m; }
    }
    if (!nearest) { showNotification('Рядом нет мин (нужно ближе 5 клеток)', themes[currentTheme].primary); return; }
    mines = mines.filter(m => m !== nearest);
    defuseCharges--;
    updateDefuseUI();
    drawMaze();
    playDefuseSound();
    showNotification(`Мина обезврежена! Осталось: ${defuseCharges}`, '#34d399');
}

function updateDefuseUI() {
    const el = document.getElementById('comp-defuse');
    const item = document.getElementById('comp-defuse-item');
    if (el) el.textContent = defuseCharges;
    if (item) {
        if (defuseCharges <= 0) item.classList.add('empty');
        else item.classList.remove('empty');
    }
}

function updateTimer() {
    if (!gameActive) return;
    const total = elapsedTime + (Date.now() - startTime) / 1000;
    timeDisplay.textContent = formatTime(total);
}

function startCompTimer() {
    stopCompTimer();
    const tier = getTierForLevel(currentLevel);
    compTimer = tier.time;
    updateCompTimerDisplay();
    compTimerInterval = setInterval(() => {
        compTimer--;
        updateCompTimerDisplay();
        if (compTimer <= 0) {
            stopCompTimer();
            if (gameActive) gameOver('time');
        }
    }, 1000);
}

function stopCompTimer() {
    if (compTimerInterval) { clearInterval(compTimerInterval); compTimerInterval = null; }
}

function updateCompTimerDisplay() {
    const el = document.getElementById('comp-timer');
    const ringFg = document.getElementById('ring-fg');
    if (!el) return;
    el.textContent = Math.max(0, compTimer);
    const tier = getTierForLevel(currentLevel);
    const maxTime = tier.time;
    const ratio = Math.max(0, Math.min(1, compTimer / maxTime));
    if (ringFg) {
        ringFg.style.strokeDasharray = TIMER_CIRCUMFERENCE;
        ringFg.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - ratio);
        if (ratio <= 0.25) ringFg.style.stroke = '#fb7185';
        else if (ratio <= 0.5) ringFg.style.stroke = '#fbbf24';
        else ringFg.style.stroke = '';
    }
    if (compTimer <= 10) el.classList.add('danger');
    else el.classList.remove('danger');
}

function updateCompUI() {
    const tier = getTierForLevel(currentLevel);
    const roundEl = document.getElementById('comp-round');
    const diffEl = document.getElementById('comp-difficulty');
    const minesEl = document.getElementById('comp-mines');
    if (roundEl) roundEl.textContent = currentLevel;
    if (diffEl) diffEl.textContent = tier.name;
    if (minesEl) minesEl.textContent = tier.mines;
    updateCompTimerDisplay();
    updateDefuseUI();
}

// ═══════════ КОНЕЦ ИГРЫ ═══════════
function gameOver(reason) {
    gameActive = false;
    stopCompTimer();
    clearInterval(gameInterval);
    stopArrowMovement();
    if (gameMode === 'competition' && competitionRun) saveLeaderboardResult(competitionRun.level, competitionRun.totalMoves, competitionRun.totalTime, 'competition');
    const reasonIcon = reason === 'mine' ? '💥' : reason === 'time' ? '⏰' : '🛑';
    const reasonTitle = reason === 'mine' ? 'Взрыв!' : reason === 'time' ? 'Время вышло!' : 'Игра окончена';
    const reasonMsg = reason === 'mine' ? 'Ты наступил на мину. Покажи ✌ чтобы её обезвредить!' : reason === 'time' ? 'Не успел пройти уровень. Попробуй ещё раз!' : 'Игра завершена.';
    showGameOverModal(reasonIcon, reasonTitle, reasonMsg, {
        level: competitionRun ? competitionRun.level : currentLevel,
        moves: competitionRun ? competitionRun.totalMoves : moves,
        time: competitionRun ? competitionRun.totalTime : elapsedTime
    });
    statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Игра окончена';
    statusDiv.className = 'status status-inactive';
}

function showGameOverModal(icon, title, message, stats) {
    let modal = document.getElementById('gameover-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gameover-modal';
        modal.className = 'gameover-modal';
        modal.innerHTML = `
            <div class="gameover-content">
                <div class="gameover-icon" id="gameover-icon"></div>
                <h2 id="gameover-title"></h2>
                <p id="gameover-message"></p>
                <div class="gameover-stats" id="gameover-stats"></div>
                <div class="gameover-actions">
                    <button class="btn btn-start-again" id="gameover-restart"><i class="fas fa-redo"></i> Ещё раз</button>
                    <button class="ghost-btn" id="gameover-close"><i class="fas fa-times"></i> Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#gameover-close').addEventListener('click', () => modal.classList.remove('active'));
        modal.querySelector('#gameover-restart').addEventListener('click', () => {
            modal.classList.remove('active');
            if (gameMode === 'competition') startCompetitionRun();
            else { resetGame(); if (gameStarted) { initCanvasSizes(); generateMaze(); startGame(); } }
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    }
    modal.querySelector('#gameover-icon').textContent = icon;
    modal.querySelector('#gameover-title').textContent = title;
    modal.querySelector('#gameover-message').textContent = message;
    modal.querySelector('#gameover-stats').innerHTML = `
        <div class="gameover-stat"><div class="gameover-stat-value">${stats.level}</div><div class="gameover-stat-label">Раунд</div></div>
        <div class="gameover-stat"><div class="gameover-stat-value">${stats.moves}</div><div class="gameover-stat-label">Ходы</div></div>
        <div class="gameover-stat"><div class="gameover-stat-value">${formatTime(stats.time)}</div><div class="gameover-stat-label">Время</div></div>
    `;
    modal.classList.add('active');
}

function levelComplete() {
    gameActive = false;
    stopCompTimer();
    clearInterval(gameInterval);
    stopArrowMovement();
    elapsedTime += (Date.now() - startTime) / 1000;
    if (gameMode === 'competition') {
        if (competitionRun) { competitionRun.totalTime += (Date.now() - startTime) / 1000; competitionRun.level++; }
        currentLevel = competitionRun ? competitionRun.level : currentLevel + 1;
        levelDisplay.textContent = currentLevel;
        const newTierIdx = getTierIndexForLevel(currentLevel);
        const newTier = DIFFICULTY_TIERS[newTierIdx];
        const isTierUp = newTierIdx !== difficultyTier;
        difficultyTier = newTierIdx;
        defuseCharges = 3;
        updateDefuseUI();
        showLevelToast(competitionRun ? competitionRun.level - 1 : currentLevel - 1, isTierUp);
        playVictorySound();
        if (isTierUp) celebrateWithEffects();
        updateCompUI();
        setTimeout(() => {
            cellSize = newTier.cellSize;
            initCanvasSizes();
            generateMaze();
            startGame();
        }, 800);
    } else {
        saveLeaderboardResult(currentLevel, moves, elapsedTime, 'warmup');
        showLevelToast(currentLevel, false);
        playVictorySound();
        elapsedTime = 0;
        setTimeout(() => {
            currentLevel++;
            levelDisplay.textContent = currentLevel;
            initCanvasSizes();
            generateMaze();
            startGame();
        }, 800);
    }
}

// ═══════════ ЗВУКИ ═══════════
function playVictorySound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.8);
        const m = Math.floor(Math.random() * 3);
        if (m === 0) { osc.frequency.setValueAtTime(523.25, ctx.currentTime); osc.frequency.setValueAtTime(659.25, ctx.currentTime + .15); osc.frequency.setValueAtTime(783.99, ctx.currentTime + .3); osc.frequency.setValueAtTime(1046.50, ctx.currentTime + .45); }
        else if (m === 1) { osc.frequency.setValueAtTime(587.33, ctx.currentTime); osc.frequency.setValueAtTime(698.46, ctx.currentTime + .2); osc.frequency.setValueAtTime(880.00, ctx.currentTime + .4); osc.frequency.setValueAtTime(1174.66, ctx.currentTime + .6); }
        else { osc.frequency.setValueAtTime(415.30, ctx.currentTime); osc.frequency.setValueAtTime(523.25, ctx.currentTime + .15); osc.frequency.setValueAtTime(622.25, ctx.currentTime + .3); osc.frequency.setValueAtTime(830.61, ctx.currentTime + .45); }
        osc.start(); osc.stop(ctx.currentTime + 2);
    } catch (e) {}
}

function playExplosionSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.7);
    } catch (e) {}
}

function playDefuseSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
}

// ═══════════ ЭФФЕКТЫ ═══════════
function celebrateWithEffects() {
    const type = Math.floor(Math.random() * 4);
    switch (type) {
        case 0: createConfettiEffect(); break;
        case 1: createFireworksEffect(); break;
        case 2: createGiftsEffect(); break;
        case 3: createHeartsEffect(); break;
    }
}

function createConfettiEffect() {
    let canvas = document.getElementById('celebration-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'celebration-canvas'; document.body.appendChild(canvas); }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#a855f7','#d946ef','#fb7185','#fbbf24','#34d399','#3b82f6','#f3e8ff','#c4b5fd'];
    const shapes = ['rect','circle','triangle','star'];
    for (let i = 0; i < 250; i++) particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 15 + 5, color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 6 + 3, angle: Math.random() * Math.PI * 2,
        rotation: Math.random() * 0.2 - 0.1, wobble: Math.random() * 0.3 - 0.15,
        opacity: Math.random() * 0.9 + 0.1, shape: shapes[Math.floor(Math.random() * shapes.length)]
    });
    animateEffect(canvas, ctx, particles, 7000);
}

function createFireworksEffect() {
    let canvas = document.getElementById('celebration-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'celebration-canvas'; document.body.appendChild(canvas); }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = [];
    for (let f = 0; f < 12; f++) setTimeout(() => {
        const cx = Math.random() * canvas.width;
        const cy = Math.random() * canvas.height * 0.7;
        const color = `hsl(${Math.random() * 360}, 100%, 60%)`;
        for (let i = 0; i < 45; i++) {
            const angle = (i / 45) * Math.PI * 2;
            const speed = Math.random() * 10 + 3;
            particles.push({ x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, size: Math.random()*8+3, color, opacity: 1, life: 1 });
        }
    }, f * 280);
    let frame = 0;
    function animate() {
        if (frame >= 280) { if (canvas && canvas.parentNode) canvas.remove(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.05;
            p.life -= 0.01; p.opacity = Math.max(0, p.life);
            ctx.save(); ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
        frame++; requestAnimationFrame(animate);
    }
    animate();
}

function createGiftsEffect() {
    let canvas = document.getElementById('celebration-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'celebration-canvas'; document.body.appendChild(canvas); }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const gifts = [];
    const emojis = ['🎁','🎀','⭐','🌟','✨','🎊','🎉','🧸','🍬','🍭','🧁','🎈'];
    for (let i = 0; i < 50; i++) gifts.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height-canvas.height, emoji: emojis[Math.floor(Math.random()*emojis.length)], size: Math.random()*50+30, speed: Math.random()*3+1, rotation: 0, rotationSpeed: (Math.random()-0.5)*0.01, wobble: Math.random()*2 });
    let frame = 0;
    function animate() {
        if (frame >= 280) { if (canvas && canvas.parentNode) canvas.remove(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        gifts.forEach(g => {
            g.y += g.speed; g.x += Math.sin(g.y*0.02+frame*0.01)*g.wobble; g.rotation += g.rotationSpeed;
            if (g.y > canvas.height + 100) { g.y = -100; g.x = Math.random()*canvas.width; }
            ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rotation);
            ctx.font = `${g.size}px "Segoe UI Emoji", Arial, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(g.emoji, 0, 0); ctx.restore();
        });
        frame++; requestAnimationFrame(animate);
    }
    animate();
}

function createHeartsEffect() {
    let canvas = document.getElementById('celebration-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'celebration-canvas'; document.body.appendChild(canvas); }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const hearts = [];
    const colors = ['#ff6b6b','#ff4757','#ff3838','#ff5252','#ff6b8b'];
    for (let i = 0; i < 70; i++) hearts.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height-canvas.height, size: Math.random()*40+20, color: colors[Math.floor(Math.random()*colors.length)], speed: Math.random()*3+1, wobble: Math.random()*0.8, angle: Math.random()*Math.PI*2, opacity: Math.random()*0.7+0.3 });
    let frame = 0;
    function animate() {
        if (frame >= 280) { if (canvas && canvas.parentNode) canvas.remove(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hearts.forEach(h => {
            h.y += h.speed; h.x += Math.sin(h.y*0.02+h.angle)*h.wobble;
            if (h.y > canvas.height + 100) { h.y = -100; h.x = Math.random()*canvas.width; }
            ctx.globalAlpha = h.opacity; ctx.fillStyle = h.color;
            ctx.beginPath(); ctx.arc(h.x, h.y, h.size/3, 0, Math.PI*2); ctx.fill();
        });
        frame++; requestAnimationFrame(animate);
    }
    animate();
}

function animateEffect(canvas, ctx, particles, duration) {
    const start = Date.now();
    function animate() {
        const el = Date.now() - start;
        if (el > duration) { if (canvas && canvas.parentNode) canvas.remove(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const op = 1 - Math.max(0, (el - duration*0.7)/(duration*0.3));
        particles.forEach(p => {
            p.y += p.speed; p.x += Math.sin(p.y*0.01+p.angle)*(p.wobble||0.5); p.rotation += p.wobble||0;
            if (p.y > canvas.height + 50) { p.y = -50; p.x = Math.random()*canvas.width; }
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation||0);
            ctx.globalAlpha = (p.opacity||1)*op; ctx.fillStyle = p.color;
            if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size/2, 0, Math.PI*2); ctx.fill(); }
            else if (p.shape === 'triangle') { ctx.beginPath(); ctx.moveTo(0, -p.size/2); ctx.lineTo(p.size/2, p.size/2); ctx.lineTo(-p.size/2, p.size/2); ctx.closePath(); ctx.fill(); }
            else if (p.shape === 'star') drawStar(ctx, 0, 0, 5, p.size/2, p.size/4);
            else ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot)*outerR, y = cy + Math.sin(rot)*outerR;
        ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot)*innerR; y = cy + Math.sin(rot)*innerR;
        ctx.lineTo(x, y); rot += step;
    }
    ctx.closePath(); ctx.fill();
}

// ═══════════ ДОСТИЖЕНИЯ ═══════════
let leaderboard = [];

function loadLeaderboard() {
    const saved = localStorage.getItem('grandwarmup-leaderboard');
    if (saved) {
        leaderboard = JSON.parse(saved);
        leaderboard = leaderboard.map(e => ({ ...e, mode: e.mode || 'warmup' }));
    }
    displayLeaderboard();
}

function saveLeaderboardResult(level, moves, time, mode = 'warmup') {
    if (mode === 'competition' && level < COMPETITION_MIN_LEVEL) return;
    const result = { name: playerName, level, moves, time, date: new Date().toLocaleDateString(), mode };
    leaderboard.push(result);
    leaderboard = leaderboard.slice(-100);
    localStorage.setItem('grandwarmup-leaderboard', JSON.stringify(leaderboard));
    displayLeaderboard();
}

function renderAchEntry(entry, idx) {
    const topClass = idx < 3 ? `top-${idx + 1}` : '';
    return `
        <div class="ach-entry ${topClass}">
            <div class="ach-entry-rank">${idx + 1}</div>
            <div class="ach-entry-info">
                <div class="ach-entry-title">Уровень ${entry.level}</div>
                <div class="ach-entry-date">${entry.date || '—'}</div>
            </div>
            <div class="ach-entry-stats">
                <div class="ach-entry-stat"><span>${entry.level}</span><small>ур.</small></div>
                <div class="ach-entry-stat"><span>${entry.moves}</span><small>ходы</small></div>
                <div class="ach-entry-stat"><span>${formatTime(entry.time)}</span><small>время</small></div>
            </div>
        </div>
    `;
}

function displayLeaderboard() {
    const panel = document.getElementById('panel-leaderboard');
    if (!panel) return;
    const body = panel.querySelector('.panel-body');
    if (!body) return;
    panel.querySelectorAll('.ach-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === achCurrentMode));
    const modeLabel = achCurrentMode === 'competition' ? 'Соревнование' : 'Разминка';
    const modeFiltered = leaderboard.filter(e => e.name === playerName && (e.mode || 'warmup') === achCurrentMode).slice().sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
    });
    const initial = (playerName || '?').charAt(0).toUpperCase();
    let html = `
        <div class="ach-player">
            <div class="ach-avatar">${initial}</div>
            <div class="ach-player-info">
                <div class="ach-player-name">${playerName}</div>
                <div class="ach-player-tag">Личные достижения · ${modeLabel}</div>
            </div>
        </div>
    `;
    if (modeFiltered.length === 0) {
        const emptyText = achCurrentMode === 'competition'
            ? `Пройди хотя бы ${COMPETITION_MIN_LEVEL} уровней в соревновании, чтобы попасть в историю`
            : 'Сыграй игру, чтобы открыть первое достижение';
        html += `<div class="ach-empty"><i class="fas fa-trophy"></i><p>Пока нет результатов</p><span>${emptyText}</span></div>`;
    } else {
        const bestLevel = Math.max(...modeFiltered.map(e => e.level));
        const bestMoves = Math.min(...modeFiltered.map(e => e.moves));
        const bestTime = Math.min(...modeFiltered.map(e => e.time));
        html += `
            <div class="ach-kpi-grid">
                <div class="ach-kpi"><i class="fas fa-layer-group ach-kpi-icon"></i><div class="ach-kpi-value">${bestLevel}</div><div class="ach-kpi-label">Уровень</div></div>
                <div class="ach-kpi"><i class="fas fa-shoe-prints ach-kpi-icon"></i><div class="ach-kpi-value">${bestMoves}</div><div class="ach-kpi-label">Ходы</div></div>
                <div class="ach-kpi"><i class="fas fa-stopwatch ach-kpi-icon"></i><div class="ach-kpi-value">${formatTime(bestTime)}</div><div class="ach-kpi-label">Время</div></div>
            </div>
            <div class="ach-section-title"><i class="fas fa-history"></i> История результатов · ${modeFiltered.length}</div>
            <div class="ach-list">
        `;
        const top10 = modeFiltered.slice(0, 10);
        const rest = modeFiltered.slice(10);
        top10.forEach((entry, idx) => { html += renderAchEntry(entry, idx); });
        html += `</div>`;
        if (rest.length > 0) {
            html += `<button class="ach-more-btn" id="achMoreBtn"><i class="fas fa-chevron-down"></i> Смотреть все (${rest.length})</button>`;
            html += `<div class="ach-hidden-list" id="achHiddenList">`;
            rest.forEach((entry, i) => { html += renderAchEntry(entry, i + 10); });
            html += `</div>`;
        }
        if (achCurrentMode === 'competition') html += `<div class="ach-hint"><i class="fas fa-info-circle"></i> В историю соревнования попадают результаты от ${COMPETITION_MIN_LEVEL} уровней и выше</div>`;
        html += `<button class="btn-reset-leaderboard" style="margin-top:14px;"><i class="fas fa-trash"></i> Сбросить достижения (${modeLabel})</button>`;
    }
    body.innerHTML = html;
    const moreBtn = body.querySelector('#achMoreBtn');
    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            moreBtn.classList.toggle('open');
            const hidden = body.querySelector('#achHiddenList');
            if (hidden) hidden.classList.toggle('show');
            const isOpen = moreBtn.classList.contains('open');
            moreBtn.innerHTML = isOpen ? `<i class="fas fa-chevron-up"></i> Свернуть` : `<i class="fas fa-chevron-down"></i> Смотреть все (${rest.length})`;
        });
    }
    const resetBtn2 = body.querySelector('.btn-reset-leaderboard');
    if (resetBtn2) {
        resetBtn2.addEventListener('click', () => {
            if (confirm(`Сбросить достижения (${modeLabel})?`)) {
                leaderboard = leaderboard.filter(e => !(e.name === playerName && (e.mode || 'warmup') === achCurrentMode));
                localStorage.setItem('grandwarmup-leaderboard', JSON.stringify(leaderboard));
                displayLeaderboard();
                showNotification('Достижения сброшены', themes[currentTheme].primary);
            }
        });
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ═══════════ СТАРТ/СБРОС ═══════════
function startGame() {
    if (!gameStarted) { alert("Сначала активируйте камеру"); return; }
    if (!maze.length) { initCanvasSizes(); generateMaze(); }
    if (!maze.length) { showNotification('Не удалось создать лабиринт', '#fb7185'); return; }
    gameActive = true;
    startTime = Date.now();
    moves = 0;
    movesDisplay.textContent = 0;
    clearInterval(gameInterval);
    gameInterval = setInterval(updateTimer, 1000);
    if (gameMode === 'competition') startCompTimer();
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Игра активна. Используйте жесты или стрелки';
    statusDiv.className = 'status status-active';
    showNotification(`Игра началась, ${playerName}!`, themes[currentTheme].primary);
}

function startCompetitionRun() {
    competitionRun = { level: 1, totalMoves: 0, totalTime: 0 };
    currentLevel = 1;
    difficultyTier = 0;
    defuseCharges = 3;
    levelDisplay.textContent = 1;
    cellSize = DIFFICULTY_TIERS[0].cellSize;
    updateCompUI();
    initCamera().then(started => {
        if (started) { initCanvasSizes(); generateMaze(); startGame(); }
    });
}

function resetGame() {
    gameActive = false;
    gameStarted = false;
    stopCompTimer();
    clearInterval(gameInterval);
    stopArrowMovement();
    elapsedTime = 0;
    currentLevel = 1;
    moves = 0;
    timeDisplay.textContent = '00:00';
    movesDisplay.textContent = '0';
    levelDisplay.textContent = '1';
    competitionRun = null;
    difficultyTier = 0;
    defuseCharges = 3;
    mines = [];
    cellSize = gameMode === 'competition' ? DIFFICULTY_TIERS[0].cellSize : userCellSize;
    updateCompUI();
    initCanvasSizes();
    generateMaze();
    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Игра сброшена. Нажмите "Начать игру"';
    statusDiv.className = 'status status-inactive';
    showNotification('Игра сброшена', themes[currentTheme].primary);
}

// ═══════════ ЖЕСТЫ ═══════════
function detectGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    const indexTip = landmarks[8], middleTip = landmarks[12], ringTip = landmarks[16], pinkyTip = landmarks[20];
    const indexBase = landmarks[5], middleBase = landmarks[9];
    const ringBase = landmarks[13], pinkyBase = landmarks[17];
    const indexUp = indexTip.y < indexBase.y;
    const middleUp = middleTip.y < middleBase.y;
    const ringUp = ringTip.y < ringBase.y;
    const pinkyUp = pinkyTip.y < pinkyBase.y;
    if (indexUp && middleUp && ringUp && pinkyUp) return 'up';
    if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'right';
    if (indexUp && middleUp && !ringUp && !pinkyUp) return 'defuse';
    if (Math.abs(indexTip.x - middleTip.x) < 0.2 && Math.abs(middleTip.x - ringTip.x) < 0.2 && Math.abs(ringTip.x - pinkyTip.x) < 0.2 && indexUp && middleUp) return 'left';
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'down';
    return null;
}

function smoothPosition(x, y) {
    const sx = previousHandPosition.x * 0.3 + x * 0.7;
    const sy = previousHandPosition.y * 0.3 + y * 0.7;
    previousHandPosition = { x: sx, y: sy };
    return { x: sx, y: sy };
}

function onResults(results) {
    handCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        if (showHandSkeleton) {
            landmarks.forEach(point => {
                const x = (1 - point.x) * handOverlay.width;
                const y = point.y * handOverlay.height;
                handCtx.beginPath();
                handCtx.arc(x, y, 4, 0, 2 * Math.PI);
                handCtx.fillStyle = themes[currentTheme].primary;
                handCtx.fill();
            });
        }
        const gesture = detectGesture(landmarks);
        if (gesture && !gestureCooldown) {
            if (gameActive) processGesture(gesture);
            if (gesture === 'defuse' && gameMode === 'competition') {
                const now = Date.now();
                if (now - lastDefuseTime > 600) {
                    lastDefuseTime = now;
                    defuseNearestMine();
                    if (gestureCards.defuse) {
                        gestureCards.defuse.classList.add('gesture-active');
                        setTimeout(() => gestureCards.defuse.classList.remove('gesture-active'), 400);
                    }
                }
            }
        }
        const tx = (1 - landmarks[0].x) * handOverlay.width;
        const ty = landmarks[0].y * handOverlay.height;
        currentHandPosition = smoothPosition(tx, ty);
    }
}

function processGesture(gesture) {
    if (!gesture || gestureCooldown) return;
    if (gesture === 'defuse') return;
    const now = Date.now();
    if (now - lastGestureTime < 150) return;
    Object.values(gestureCards).forEach(card => { if (card) card.classList.remove('gesture-active'); });
    let moved = false;
    switch(gesture) {
        case 'up': moved = movePlayer(0, -1); if (gestureCards.up) gestureCards.up.classList.add('gesture-active'); break;
        case 'down': moved = movePlayer(0, 1); if (gestureCards.down) gestureCards.down.classList.add('gesture-active'); break;
        case 'left': moved = movePlayer(-1, 0); if (gestureCards.left) gestureCards.left.classList.add('gesture-active'); break;
        case 'right': moved = movePlayer(1, 0); if (gestureCards.right) gestureCards.right.classList.add('gesture-active'); break;
    }
    if (moved) {
        lastGesture = gesture;
        lastGestureTime = now;
        gestureCooldown = true;
        setTimeout(() => {
            gestureCooldown = false;
            setTimeout(() => { Object.values(gestureCards).forEach(card => { if (card) card.classList.remove('gesture-active'); }); }, 100);
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
            if (gestureCards[key]) {
                if (arrowKeys[key]) gestureCards[key].classList.add('gesture-active');
                else gestureCards[key].classList.remove('gesture-active');
            }
        });
    }, 80);
}

function stopArrowMovement() {
    if (arrowMoveInterval) { clearInterval(arrowMoveInterval); arrowMoveInterval = null; }
    Object.values(gestureCards).forEach(card => { if (card) card.classList.remove('gesture-active'); });
}

// ═══════════ КАМЕРА ═══════════
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", frameRate: { ideal: 30 } } });
        cameraFeed.srcObject = stream;
        cameraStream = stream;
        cameraActive = true;
        gameStarted = true;
        hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onResults);
        const camera = new Camera(cameraFeed, {
            onFrame: async () => { if (hands) await hands.send({ image: cameraFeed }); },
            width: 640, height: 480
        });
        camera.start();
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Камера активна. Начните игру';
        statusDiv.className = 'status status-active';
        if (cameraToggle) cameraToggle.checked = true;
        return true;
    } catch (err) {
        console.error("Ошибка камеры:", err);
        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка доступа к камере';
        statusDiv.className = 'status status-inactive';
        if (cameraToggle) cameraToggle.checked = false;
        return false;
    }
}

function setSensitivity(level) {
    switch (level) {
        case 1: sensitivity = SENSITIVITY.LOW; break;
        case 2: sensitivity = SENSITIVITY.MEDIUM; break;
        case 3: sensitivity = SENSITIVITY.HIGH; break;
        case 4: sensitivity = SENSITIVITY.VERY_HIGH; break;
        default: sensitivity = SENSITIVITY.MEDIUM;
    }
    const names = ['НИЗКАЯ','СРЕДНЯЯ','ВЫСОКАЯ','ОЧЕНЬ ВЫСОКАЯ'];
    showNotification(`Чувствительность: ${names[level-1]}`, themes[currentTheme].primary);
}

// ═══════════ ВЫБОР РЕЖИМА ═══════════
function openModePicker() {
    const modal = document.getElementById('mode-picker-modal');
    if (modal) modal.classList.add('active');
}
function closeModePicker() {
    const modal = document.getElementById('mode-picker-modal');
    if (modal) modal.classList.remove('active');
}

async function selectMode(mode) {
    closeModePicker();
    await new Promise(r => setTimeout(r, 150));
    gameMode = mode;
    gameActive = false;
    stopCompTimer();
    clearInterval(gameInterval);
    stopArrowMovement();
    if (hands) { hands.close(); hands = null; }
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    cameraFeed.srcObject = null;
    cameraActive = false;
    gameStarted = false;
    if (mode === 'competition') {
        competitionRun = { level: 1, totalMoves: 0, totalTime: 0 };
        currentLevel = 1;
        difficultyTier = 0;
        cellSize = DIFFICULTY_TIERS[0].cellSize;
        defuseCharges = 3;
        document.getElementById('competition-info').style.display = 'flex';
        if (gestureCards.defuse) gestureCards.defuse.style.display = 'flex';
    } else {
        competitionRun = null;
        currentLevel = 1;
        difficultyTier = 0;
        cellSize = userCellSize;
        defuseCharges = 0;
        document.getElementById('competition-info').style.display = 'none';
        if (gestureCards.defuse) gestureCards.defuse.style.display = 'none';
    }
    mines = [];
    moves = 0;
    movesDisplay.textContent = 0;
    elapsedTime = 0;
    timeDisplay.textContent = '00:00';
    levelDisplay.textContent = 1;
    updateCompUI();
    const ok = await initCamera();
    if (ok) { initCanvasSizes(); generateMaze(); startGame(); }
}

// ═══════════ СОСТОЯНИЕ ═══════════
let soundEnabled = true;
let cameraStream = null;
let cameraActive = false;

startBtn.addEventListener('click', () => {
    if (!gameStarted || !cameraActive) openModePicker();
    else if (!gameActive) startGame();
    else showNotification('Игра уже идёт', themes[currentTheme].primary);
});
resetBtn.addEventListener('click', resetGame);

document.addEventListener('keydown', (e) => {
    if (!gameActive && !['1','2','3','4'].includes(e.key)) return;
    switch(e.key) {
        case 'ArrowUp': e.preventDefault(); arrowKeys.up = true; startArrowMovement(); break;
        case 'ArrowDown': e.preventDefault(); arrowKeys.down = true; startArrowMovement(); break;
        case 'ArrowLeft': e.preventDefault(); arrowKeys.left = true; startArrowMovement(); break;
        case 'ArrowRight': e.preventDefault(); arrowKeys.right = true; startArrowMovement(); break;
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
    if (!arrowKeys.up && !arrowKeys.down && !arrowKeys.left && !arrowKeys.right) stopArrowMovement();
});

// ═══════════ ЗАГРУЗКА ═══════════
window.addEventListener('load', () => {
    initCanvasSizes();
    generateMaze();
    window.addEventListener('resize', () => {
        initCanvasSizes();
        generateMaze();
    });
    const savedName = localStorage.getItem('grandwarmup-player-name');
    if (savedName) playerName = savedName;
    loadLeaderboard();
    const savedTheme = localStorage.getItem('grandwarmup-theme');
    applyTheme(savedTheme && themes[savedTheme] ? savedTheme : 'purple');
    initAuthFlow();
});

document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    const closeButtons = document.querySelectorAll('.close-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.stopPropagation();
            const pid = this.id.replace('tab', 'panel');
            const tp = document.getElementById(pid);
            panels.forEach(p => p.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            if (tp) { tp.classList.add('active'); this.classList.add('active'); }
        });
    });
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const panel = this.closest('.tab-panel');
            if (panel) {
                panel.classList.remove('active');
                const tid = panel.id.replace('panel', 'tab');
                const tab = document.getElementById(tid);
                if (tab) tab.classList.remove('active');
            }
        });
    });
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tab-panel') && !e.target.closest('.tab')) {
            panels.forEach(p => p.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
        }
    });
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.querySelector('span').textContent;
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('menu-item-active'));
            this.classList.add('menu-item-active');
            switch(action) {
                case 'Новая игра': openModePicker(); break;
                case 'Выйти из аккаунта': logout(); break;
                case 'Обучение': openTutorialPanel(); break;
                case 'О программе': openAboutPanel(); break;
            }
        });
    });
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('theme-active'));
            this.classList.add('theme-active');
            applyTheme(this.dataset.theme);
        });
    });
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    });
    const closePickerBtn = document.getElementById('mode-picker-close');
    if (closePickerBtn) closePickerBtn.addEventListener('click', closeModePicker);
    const pickerModal = document.getElementById('mode-picker-modal');
    if (pickerModal) {
        pickerModal.addEventListener('click', (e) => { if (e.target === pickerModal) closeModePicker(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pickerModal.classList.contains('active')) closeModePicker(); });
    }
    const defuseItem = document.getElementById('comp-defuse-item');
    if (defuseItem) defuseItem.addEventListener('click', defuseNearestMine);
    document.querySelectorAll('.ach-tab').forEach(tab => {
        tab.addEventListener('click', () => { achCurrentMode = tab.dataset.mode; displayLeaderboard(); });
    });
    loadLeaderboard();
});

const cameraToggle = document.getElementById('camera-toggle');
const skeletonToggle = document.getElementById('skeleton-toggle');
const soundToggle = document.getElementById('sound-toggle');
const sensitivityRadios = document.querySelectorAll('input[name="sensitivity"]');
const cellSizeRadios = document.querySelectorAll('input[name="cell-size"]');
const resetSettingsBtn = document.getElementById('reset-settings');
const resetProgressBtn = document.getElementById('reset-progress');

function stopCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    cameraFeed.srcObject = null;
    cameraActive = false;
    gameStarted = false;
    if (hands) { hands.close(); hands = null; }
    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Камера отключена';
    statusDiv.className = 'status status-inactive';
    if (cameraToggle) cameraToggle.checked = false;
    if (gameActive) { gameActive = false; clearInterval(gameInterval); stopCompTimer(); stopArrowMovement(); }
}

if (cameraToggle) {
    cameraToggle.addEventListener('change', function() {
        if (this.checked) initCamera();
        else stopCamera();
    });
}
if (skeletonToggle) {
    skeletonToggle.addEventListener('change', function() {
        showHandSkeleton = this.checked;
        if (!showHandSkeleton) handCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);
    });
}
sensitivityRadios.forEach(r => {
    r.addEventListener('change', function() {
        if (this.checked) {
            const map = { low: 1, medium: 2, high: 3, very_high: 4 };
            setSensitivity(map[this.value] || 2);
        }
    });
});
cellSizeRadios.forEach(r => {
    r.addEventListener('change', function() {
        if (this.checked) {
            userCellSize = parseInt(this.value, 10) || 40;
            if (gameMode === 'warmup') { cellSize = userCellSize; initCanvasSizes(); generateMaze(); }
        }
    });
});
if (soundToggle) {
    soundToggle.addEventListener('change', function() {
        soundEnabled = this.checked;
        showNotification(`Звук ${soundEnabled ? 'включён' : 'выключен'}`, themes[currentTheme].primary);
    });
}
if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', function() {
        if (confirm('Сбросить все достижения?')) {
            leaderboard = [];
            localStorage.removeItem('grandwarmup-leaderboard');
            displayLeaderboard();
            showNotification('Достижения сброшены', themes[currentTheme].primary);
        }
    });
}
if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', function() {
        if (cameraToggle) cameraToggle.checked = true;
        if (skeletonToggle) { skeletonToggle.checked = true; showHandSkeleton = true; }
        const m = document.querySelector('input[name="sensitivity"][value="medium"]');
        if (m) m.checked = true;
        setSensitivity(2);
        const s = document.querySelector('input[name="cell-size"][value="40"]');
        if (s) { s.checked = true; userCellSize = 40; }
        if (gameMode === 'warmup') { cellSize = 40; initCanvasSizes(); generateMaze(); }
        if (soundToggle) { soundToggle.checked = true; soundEnabled = true; }
        showNotification('Настройки сброшены', themes[currentTheme].primary);
    });
}

// ═══════════ ТУР ═══════════
class Tour {
    constructor(steps) { this.steps = steps; this.current = 0; this.active = false; this.waitTimer = null; this.build(); }
    build() {
        const root = document.createElement('div');
        root.className = 'tour-root';
        root.id = 'tourRoot';
        root.innerHTML = `
            <div class="tour-blocker" data-blocker="top"></div>
            <div class="tour-blocker" data-blocker="bottom"></div>
            <div class="tour-blocker" data-blocker="left"></div>
            <div class="tour-blocker" data-blocker="right"></div>
            <div class="tour-highlight"></div>
            <div class="tour-tooltip">
                <div class="tour-emoji"></div>
                <div class="tour-header">
                    <span class="tour-counter"></span>
                    <button class="tour-close" title="Пропустить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                <h3 class="tour-title"></h3>
                <p class="tour-text"></p>
                <div class="tour-actions">
                    <button class="ghost-btn tour-back">Назад</button>
                    <button class="primary-btn tour-next">Далее</button>
                </div>
                <div class="tour-progress"><div class="tour-progress-dots"></div></div>
            </div>
        `;
        document.body.appendChild(root);
        this.root = root;
        this.blockers = { top: root.querySelector('[data-blocker="top"]'), bottom: root.querySelector('[data-blocker="bottom"]'), left: root.querySelector('[data-blocker="left"]'), right: root.querySelector('[data-blocker="right"]') };
        this.highlight = root.querySelector('.tour-highlight');
        this.tooltip = root.querySelector('.tour-tooltip');
        this.emoji = root.querySelector('.tour-emoji');
        this.title = root.querySelector('.tour-title');
        this.text = root.querySelector('.tour-text');
        this.counter = root.querySelector('.tour-counter');
        this.backBtn = root.querySelector('.tour-back');
        this.nextBtn = root.querySelector('.tour-next');
        this.closeBtn = root.querySelector('.tour-close');
        this.dots = root.querySelector('.tour-progress-dots');
        this.backBtn.addEventListener('click', () => this.prev());
        this.nextBtn.addEventListener('click', () => this.next());
        this.closeBtn.addEventListener('click', () => this.stop());
        window.addEventListener('resize', () => this.onResize());
        document.addEventListener('keydown', (e) => {
            if (!this.active) return;
            if (e.key === 'Escape') this.stop();
            else if (e.key === 'ArrowRight') this.next();
            else if (e.key === 'ArrowLeft') this.prev();
        });
    }
    start() { this.current = 0; this.active = true; this.root.classList.add('show'); this.showStep(); }
    stop() {
        this.active = false;
        if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
        this.root.classList.remove('show', 'interactive', 'centered-mode');
        this.highlight.classList.remove('visible');
        if (typeof closeModePicker === 'function') closeModePicker();
    }
    next() { if (this.current >= this.steps.length - 1) { this.stop(); return; } this.current++; this.showStep(); }
    prev() { if (this.current <= 0) return; this.current--; this.showStep(); }
    showStep() {
        if (!this.active) return;
        const step = this.steps[this.current];
        if (!step) { this.stop(); return; }
        if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
        this.root.classList.toggle('interactive', !!step.interactive);
        this.root.classList.toggle('centered-mode', !!step.centered);
        this.tooltip.style.opacity = '0';
        if (step.centered && step.emoji) { this.emoji.textContent = step.emoji; this.emoji.classList.add('show'); }
        else { this.emoji.classList.remove('show'); this.emoji.textContent = ''; }
        this.title.innerHTML = step.title;
        this.text.innerHTML = step.text;
        this.counter.textContent = `${this.current + 1} / ${this.steps.length}`;
        this.backBtn.disabled = this.current === 0;
        this.backBtn.style.display = step.centered ? 'none' : '';
        this.nextBtn.textContent = step.nextLabel || (this.current === this.steps.length - 1 ? 'Готово' : 'Далее');
        if (this.dots) this.dots.innerHTML = this.steps.map((_, i) => `<span class="tour-dot${i === this.current ? ' active' : ''}${i < this.current ? ' done' : ''}"></span>`).join('');
        const old = this.tooltip.querySelector('.tour-wait');
        if (old) old.remove();
        if (step.waitFor) {
            this.nextBtn.style.display = 'none';
            const w = document.createElement('div');
            w.className = 'tour-wait';
            w.textContent = step.waitText || 'Ждём…';
            this.tooltip.querySelector('.tour-actions').prepend(w);
        } else this.nextBtn.style.display = '';
        if (step.centered) {
            this.highlight.classList.remove('visible');
            this.setBlockers(null);
            this.tooltip.style.visibility = 'hidden';
            this.tooltip.classList.add('centered');
            this.tooltip.style.top = '-9999px';
            this.tooltip.style.left = '-9999px';
            setTimeout(() => { this.centerTooltip(); this.tooltip.style.visibility = 'visible'; this.tooltip.style.opacity = '1'; }, 30);
        } else {
            const target = document.querySelector(step.selector);
            if (!target) { console.warn('Tour: не найден', step.selector); this.current++; return this.showStep(); }
            try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            setTimeout(() => {
                const r = target.getBoundingClientRect();
                const pad = 8;
                this.highlight.classList.add('visible');
                this.highlight.style.top = (r.top - pad) + 'px';
                this.highlight.style.left = (r.left - pad) + 'px';
                this.highlight.style.width = (r.width + pad * 2) + 'px';
                this.highlight.style.height = (r.height + pad * 2) + 'px';
                this.setBlockers({ top: r.top - pad, left: r.left - pad, right: r.right + pad, bottom: r.bottom + pad });
                this.tooltip.style.visibility = 'hidden';
                this.tooltip.classList.remove('centered');
                this.positionTooltip(target, step.position || 'auto');
                this.tooltip.style.visibility = 'visible';
                this.tooltip.style.opacity = '1';
            }, 350);
        }
        if (step.waitFor) this.startWait(step.waitFor);
    }
    startWait(cond) {
        if (!this.active) return;
        let ok = false;
        try { ok = cond(); } catch (e) { ok = false; }
        if (ok) { this.next(); return; }
        this.waitTimer = setTimeout(() => this.startWait(cond), 250);
    }
    setBlockers(rect) {
        const w = window.innerWidth, h = window.innerHeight;
        if (!rect) {
            this.blockers.top.style.cssText = `top:0;left:0;width:${w}px;height:${h}px;`;
            this.blockers.bottom.style.cssText = `top:0;left:0;width:0;height:0;`;
            this.blockers.left.style.cssText = `top:0;left:0;width:0;height:0;`;
            this.blockers.right.style.cssText = `top:0;left:0;width:0;height:0;`;
            return;
        }
        const { top, left, right, bottom } = rect;
        this.blockers.top.style.cssText = `top:0;left:0;width:${w}px;height:${Math.max(0, top)}px;`;
        this.blockers.bottom.style.cssText = `top:${bottom}px;left:0;width:${w}px;height:${Math.max(0, h - bottom)}px;`;
        this.blockers.left.style.cssText = `top:${top}px;left:0;width:${Math.max(0, left)}px;height:${Math.max(0, bottom - top)}px;`;
        this.blockers.right.style.cssText = `top:${top}px;left:${right}px;width:${Math.max(0, w - right)}px;height:${Math.max(0, bottom - top)}px;`;
    }
    centerTooltip() { const w = window.innerWidth, h = window.innerHeight; const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight; this.tooltip.style.left = ((w - tw) / 2) + 'px'; this.tooltip.style.top = ((h - th) / 2) + 'px'; }
    positionTooltip(target, pos) {
        const r = target.getBoundingClientRect();
        const tw = this.tooltip.offsetWidth || 380, th = this.tooltip.offsetHeight || 200;
        const m = 20, vw = window.innerWidth, vh = window.innerHeight;
        let p = pos;
        if (p === 'auto') p = (r.bottom + m + th < vh) ? 'bottom' : 'top';
        let top = 0, left = 0;
        if (p === 'bottom') { top = r.bottom + m; left = r.left + r.width / 2 - tw / 2; }
        else if (p === 'top') { top = r.top - m - th; left = r.left + r.width / 2 - tw / 2; }
        else if (p === 'right') { top = r.top + r.height / 2 - th / 2; left = r.right + m; }
        else if (p === 'left') { top = r.top + r.height / 2 - th / 2; left = r.left - m - tw; }
        left = Math.max(16, Math.min(left, vw - tw - 16));
        top = Math.max(16, Math.min(top, vh - th - 16));
        this.tooltip.style.top = top + 'px';
        this.tooltip.style.left = left + 'px';
    }
    onResize() { if (!this.active) return; const step = this.steps[this.current]; if (!step) return; if (step.centered) { this.centerTooltip(); return; } const t = document.querySelector(step.selector); if (t) this.showStep(); }
}

let gwTour = null;
function openTutorialPanel() {
    if (!gwTour) {
        gwTour = new Tour([
            { centered: true, emoji: '👋', title: 'Добро пожаловать!', text: 'Траектория — игра с управлением жестами. 30 секунд, и ты знаешь всё.', nextLabel: 'Начать' },
            { selector: '#start-btn', title: 'Начать игру', text: 'Нажми — откроется выбор режима: <b>Разминка</b> или <b>Соревнование</b>.', position: 'bottom', interactive: true, waitFor: () => { const m = document.getElementById('mode-picker-modal'); return m && m.classList.contains('active'); }, waitText: 'Жду нажатия…' },
            { selector: '.mode-card-warmup', title: 'Выбери Разминку', text: 'Для обучения возьмём <b>Разминку</b> — свободную игру без таймера и мин.', position: 'bottom', interactive: true, waitFor: () => gameStarted && gameActive, waitText: 'Жду выбора…' },
            { selector: '.maze-container', title: 'Лабиринт', text: 'Управляй шариком и дойди до красной цели. В соревновании остерегайся 💣!', position: 'top' },
            { selector: '.camera-container', title: 'Камера', text: 'Здесь видно твою руку. MediaPipe рисует точки и распознаёт жесты.', position: 'top' },
            { selector: '.gestures-info', title: 'Жесты', text: 'Кулак, ладонь, указательный палец, все пальцы вверх — четыре направления. В соревновании появится пятый жест ✌ для обезвреживания мин.', position: 'top' },
            { selector: '.sidebar-tabs', title: 'Боковое меню', text: 'Здесь всё остальное. Наведи — раскроется.', position: 'right' },
            { selector: '#tab-theme', title: 'Смена темы', text: 'Четыре цветовые схемы. Всё перекрашивается мгновенно.', position: 'right' },
            { selector: '#tab-leaderboard', title: 'Личные достижения', text: 'История твоих результатов: уровни, ходы, время. С вкладками для разминки и соревнования.', position: 'right' },
            { selector: '#tab-settings', title: 'Настройки', text: 'Чувствительность, размер лабиринта, звук, камера — всё здесь.', position: 'right' },
            { centered: true, emoji: '🎉', title: 'Готово!', text: 'Теперь ты знаешь приложение. Приятной игры!', nextLabel: 'Погнали' }
        ]);
    }
    gwTour.start();
}

// ═══════════ О ПРОГРАММЕ ═══════════
function openAboutPanel() {
    let modal = document.getElementById('about-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'about-modal';
        modal.className = 'about-modal';
        modal.innerHTML = `
            <div class="about-content">
                <button class="about-close" title="Закрыть"><i class="fas fa-times"></i></button>
                <div class="about-hero">
                    <div class="about-icon"><i class="fas fa-hand-sparkles"></i></div>
                    <h1>Траектория</h1>
                    <div class="about-subtitle">Игра-лабиринт с управлением жестами</div>
                </div>
                <div class="about-section">
                    <h3><i class="fas fa-info-circle"></i> Что это</h3>
                    <p>Траектория — интерактивная игра, в которой лабиринт управляется движениями рук перед камерой. Никаких клавиатур и мышек: только жесты, распознаваемые нейросетью MediaPipe Hands прямо в браузере.</p>
                </div>
                <div class="about-section">
                    <h3><i class="fas fa-gamepad"></i> Два режима</h3>
                    <ul>
                        <li><b>Разминка</b> — свободная игра без ограничений по времени.</li>
                        <li><b>Соревнование</b> — игра на время, с усложнениями.</li>
                    </ul>
                </div>
                <div class="about-section">
                    <h3><i class="fas fa-bullseye"></i> Зачем это нужно</h3>
                    <ul>
                        <li><b>Разминка перед работой</b> — короткая пауза перед важным проектом.</li>
                        <li><b>Демонстрация технологий</b> — компьютерное зрение в браузере.</li>
                        <li><b>Работа системы</b> — медицинская реабилитация, когнитивное развитие, бесконтактный интерфейс.</li>
                    </ul>
                </div>
                <div class="about-section">
                    <h3><i class="fas fa-brain"></i> Что развивает</h3>
                    <ul>
                        <li><b>Крупная моторика</b> — точность и плавность движений рук.</li>
                        <li><b>Зрительно-моторная координация</b> — связка «увидел → сделал жест».</li>
                        <li><b>Концентрация и реакция</b> — удержание руки в зоне камеры.</li>
                        <li><b>Логика и пространственное мышление</b> — быстрое изменение жеста.</li>
                    </ul>
                </div>
                <div class="about-section">
                    <h3><i class="fas fa-hand-paper"></i> Как играть</h3>
                    <p>Нажми «Начать игру» — откроется выбор режима. Держи руку на расстоянии 0.5–1 метр. Показывай жесты:</p>
                    <ul>
                        <li><b>Кулак</b> → вправо</li>
                        <li><b>Открытая ладонь</b> → влево</li>
                        <li><b>Указательный палец</b> → вниз</li>
                        <li><b>Все пальцы вверх</b> → вверх</li>
                        <li><b>Два пальца (V)</b> → обезвредить ближайшую мину (соревнование)</li>
                    </ul>
                </div>
                <div class="about-footer">Траектория 3.5.0 — 15.10.2026</div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.about-close').addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    }
    modal.classList.add('active');
}
