/* ============================================================
   HABIT RPG — script.js
   Подключается в HabitRPG.html: <script src="script.js" defer></script>
   Работает вместе с твоим HabitRPG.html и style.css (ничего менять там не нужно).
   Прогресс хранится в localStorage браузера.
   ============================================================ */
(() => {
'use strict';

/* ============================================================
   1. НАСТРОЙКИ И ДАННЫЕ ИГРЫ
   ============================================================ */
const STORAGE_KEY = 'habitRPG.v1';
const GLOBAL_DAILY_LIMIT = 10;   // максимум наград в день (защита от бесконечного XP)
const MAX_QUESTS = 30;
const BOT_TICK_MS = 8000;        // как часто «оживают» боты в лидерборде

// Награда зависит от сложности квеста
const DIFFICULTY = {
  easy:   { label: 'Easy',   xp: 10, gold: 3 },
  medium: { label: 'Medium', xp: 20, gold: 6 },
  hard:   { label: 'Hard',   xp: 35, gold: 12 }
};

// Ежедневные миссии (страница Dailies)
const MISSIONS = [
  { id: 'focus', icon: '🎯', title: 'Focus Session',    desc: 'Complete one focused study or work block.', xp: 30, gold: 10 },
  { id: 'read',  icon: '📚', title: 'Read & Learn',     desc: 'Spend some time reading or learning.',      xp: 25, gold: 8 },
  { id: 'reset', icon: '🧹', title: 'Reset Your Space', desc: 'Tidy one small area around you.',           xp: 20, gold: 7 }
];

// Магазин наград (страница Rewards)
const REWARDS = [
  { id: 'break', icon: '☕', title: 'Break Token',      desc: 'A planned short break.',              price: 80 },
  { id: 'game',  icon: '🎮', title: 'Game Time',        desc: 'A planned leisure reward.',           price: 150 },
  { id: 'movie', icon: '🎬', title: 'Movie Night',      desc: 'A fun reward for a productive week.', price: 240 },
  { id: 'badge', icon: '🏅', title: 'Discipline Badge', desc: 'A cosmetic profile milestone.',       price: 400, once: true }
];

const AVATARS = ['🧙', '🥷', '🦸', '🧑‍🚀', '🧝', '🐉', '🦊', '🐺', '🦉', '🤖', '👾', '🦄'];

const RANKS = [
  { min: 1,  name: 'Noob' },
  { min: 2,  name: 'Beginner' },
  { min: 3,  name: 'Apprentice' },
  { min: 5,  name: 'Explorer' },
  { min: 7,  name: 'Warrior' },
  { min: 10, name: 'Veteran' },
  { min: 15, name: 'Champion' },
  { min: 20, name: 'Legend' }
];

const TIPS = [
  { text: 'Small actions become powerful habits.',            desc: 'Focus on consistency rather than perfection.' },
  { text: 'Make the quest so small you cannot say no.',       desc: 'Five minutes of work still counts as progress.' },
  { text: 'Write down exactly what "done" means.',            desc: 'A clear finish line is easier to reach than a vague goal.' },
  { text: 'Protect your streak, not your mood.',              desc: 'On a hard day, complete just one easy quest.' },
  { text: 'Plan tomorrow before you go to sleep.',            desc: 'Three concrete actions beat a long vague list.' },
  { text: 'Reward the effort, not only the result.',          desc: 'Spend your gold on breaks you planned in advance.' },
  { text: 'Attach a new habit to an old one.',                desc: 'After breakfast, read two pages.' },
  { text: 'Check Statistics once a week.',                    desc: 'Patterns are easier to see in numbers than in memory.' }
];

// Достижения (на странице написано «0 / 12», поэтому их ровно 12)
const ACHIEVEMENTS = [
  { id: 'first',    icon: '👣', title: 'First Step',      desc: 'Complete your first action.',   target: 1,   value: s => s.totalCompleted },
  { id: 'ten',      icon: '✅', title: 'Getting Warm',    desc: 'Complete 10 actions.',          target: 10,  value: s => s.totalCompleted },
  { id: 'fifty',    icon: '⚔️', title: 'Quest Veteran',   desc: 'Complete 50 actions.',          target: 50,  value: s => s.totalCompleted },
  { id: 'hundred',  icon: '🛡️', title: 'Centurion',       desc: 'Complete 100 actions.',         target: 100, value: s => s.totalCompleted },
  { id: 'xp100',    icon: '✨', title: 'XP Hunter',       desc: 'Earn 100 XP.',                  target: 100, value: s => s.xp },
  { id: 'xp500',    icon: '💎', title: 'XP Collector',    desc: 'Earn 500 XP.',                  target: 500, value: s => s.xp },
  { id: 'lvl5',     icon: '🚀', title: 'Rising Hero',     desc: 'Reach level 5.',                target: 5,   value: s => levelInfo(s.xp).level },
  { id: 'lvl10',    icon: '👑', title: 'Seasoned Hero',   desc: 'Reach level 10.',               target: 10,  value: s => levelInfo(s.xp).level },
  { id: 'streak3',  icon: '🔥', title: 'On Fire',         desc: 'Reach a 3-day streak.',         target: 3,   value: s => s.streak.best },
  { id: 'streak7',  icon: '🌋', title: 'Unstoppable',     desc: 'Reach a 7-day streak.',         target: 7,   value: s => s.streak.best },
  { id: 'goal',     icon: '🎯', title: 'Goal Getter',     desc: 'Reach your daily goal.',        target: 1,   value: s => s.stats.goalDays },
  { id: 'shopper',  icon: '🛍️', title: 'Treat Yourself',  desc: 'Buy a reward in the shop.',     target: 1,   value: s => s.stats.purchases }
];

// Типы событий в ленте активности
const EVENT_META = {
  quest:       { icon: '⚔️', label: 'Completed' },
  mission:     { icon: '☀️', label: 'Finished' },
  reward:      { icon: '🛍️', label: 'Bought' },
  level:       { icon: '🚀', label: 'Reached' },
  achievement: { icon: '🏆', label: 'Unlocked' },
  created:     { icon: '📝', label: 'New quest:' }
};

const BOT_NAMES = [
  'Atlas', 'Nova', 'Kai', 'Luna', 'Orion', 'Mira', 'Zane', 'Ember', 'Rex', 'Sage',
  'Vega', 'Juno', 'Axel', 'Iris', 'Milo', 'Nyx', 'Odin', 'Pax', 'Quinn', 'Rune',
  'Sol', 'Tess', 'Ula', 'Vex', 'Wren', 'Xan', 'Yuki', 'Zed', 'Aria', 'Blaze',
  'Cleo', 'Dax', 'Echo', 'Finn', 'Gaia', 'Hex', 'Ivo', 'Jett', 'Kira'
]; // 39 ботов + ты = 40 игроков
const BOT_AVATAR_POOL = ['🦉', '🐯', '🦁', '🐼', '🐸', '🐙', '🦅', '🐲', '🦄', '🐧', '🦈', '🐢'];

const ATMOSPHERES = [
  { cls: '',                   name: 'Default' },
  { cls: 'atmosphere-calm',    name: 'Calm' },
  { cls: 'atmosphere-sunset',  name: 'Sunset' }
];

/* ============================================================
   2. МЕЛКИЕ ПОМОЩНИКИ
   ============================================================ */
const $  = id => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const pad = n => String(n).padStart(2, '0');
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Защита от HTML-инъекций: названия квестов вводит пользователь
const esc = value => String(value).replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

function setText(target, value) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  const text = String(value);
  if (el.textContent !== text) el.textContent = text;
}

function setWidth(id, percent) {
  const el = $(id);
  if (el) el.style.width = clamp(percent, 0, 100) + '%';
}

// Даты считаем по локальному времени пользователя: "2026-11-04"
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(key, delta) {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}
function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 864e5);
}
function fmtTime(ts) {
  const d = new Date(ts);
  if (dayKey(d) === dayKey()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/* ============================================================
   3. УРОВНИ, РАНГИ, СЕРИЯ ДНЕЙ
   ============================================================ */
// Сколько XP нужно, чтобы перейти с уровня N на N+1: 100, 150, 200, ...
const xpForLevel = level => 100 + (level - 1) * 50;

function levelInfo(totalXp) {
  let level = 1;
  let left = Math.max(0, totalXp);
  while (left >= xpForLevel(level)) {
    left -= xpForLevel(level);
    level += 1;
  }
  return { level, into: left, need: xpForLevel(level) };
}

function rankFor(level) {
  let name = RANKS[0].name;
  RANKS.forEach(r => { if (level >= r.min) name = r.name; });
  return name;
}

/* ============================================================
   4. СОСТОЯНИЕ И СОХРАНЕНИЕ
   ============================================================ */
let state;

function defaultState() {
  return {
    profile: { name: 'Adventurer', avatar: '🧙', dailyGoal: 3 },
    xp: 0,
    gold: 0,
    totalCompleted: 0,
    firstDay: null,
    quests: [],          // { id, name, type, difficulty, limit, created }
    days: {},            // "2026-11-04": { xp, gold, count, quests:{id:n}, missions:{id:true}, goalHit }
    history: [],         // последние события
    streak: { current: 0, best: 0, last: null },
    stats: { goalDays: 0, purchases: 0 },
    purchases: {},
    achievements: {},    // id -> время получения
    bots: null,
    botsUpdated: Date.now(),
    ui: { atmosphere: 0, tip: 0 }
  };
}

function loadState() {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return base;

    const s = Object.assign(base, saved);
    const d = defaultState();
    s.profile = Object.assign(d.profile, saved.profile);
    s.streak  = Object.assign(d.streak, saved.streak);
    s.stats   = Object.assign(d.stats, saved.stats);
    s.ui      = Object.assign(d.ui, saved.ui);

    if (!Array.isArray(s.quests))  s.quests = [];
    if (!Array.isArray(s.history)) s.history = [];
    ['days', 'purchases', 'achievements'].forEach(k => {
      if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    });

    s.profile.name = String(s.profile.name || 'Adventurer').slice(0, 18);
    s.profile.dailyGoal = clamp(parseInt(s.profile.dailyGoal, 10) || 3, 1, 10);
    return s;
  } catch (err) {
    console.warn('Habit RPG: не удалось прочитать сохранение, начинаем заново.', err);
    return base;
  }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (err) { /* приватный режим или переполнено — просто играем без сохранения */ }
}

/* ---- Данные по дням ---- */
const EMPTY_DAY = Object.freeze({ xp: 0, gold: 0, count: 0, quests: {}, missions: {} });
const peekDay = key => state.days[key] || EMPTY_DAY;

function ensureDay(key) {
  if (!state.days[key]) {
    state.days[key] = { xp: 0, gold: 0, count: 0, quests: {}, missions: {} };
    const oldest = addDays(dayKey(), -90);   // храним только последние ~3 месяца
    Object.keys(state.days).forEach(k => { if (k < oldest) delete state.days[k]; });
  }
  return state.days[key];
}

/* ---- Серия дней (streak) ---- */
function currentStreak() {
  const s = state.streak;
  const today = dayKey();
  return (s.last === today || s.last === addDays(today, -1)) ? s.current : 0;
}

function normalizeStreak() {
  if (state.streak.current > 0 && currentStreak() === 0) state.streak.current = 0;
}

function bumpStreak(key) {
  const s = state.streak;
  if (s.last === key) return;
  s.current = (s.last === addDays(key, -1)) ? s.current + 1 : 1;
  s.last = key;
  s.best = Math.max(s.best, s.current);
}

/* ---- Продуктивность и дисциплина ---- */
function metrics() {
  if (!state.firstDay) return { productivity: 0, discipline: 0 };
  const today = dayKey();
  const goal = state.profile.dailyGoal;
  const since = Math.max(0, daysBetween(state.firstDay, today)) + 1;

  const span7 = Math.min(7, since);
  let sum = 0;
  for (let i = 0; i < span7; i++) sum += peekDay(addDays(today, -i)).count;
  const productivity = clamp(Math.round(sum / (span7 * goal) * 100), 0, 100);

  const span14 = Math.min(14, since);
  let active = 0;
  for (let i = 0; i < span14; i++) if (peekDay(addDays(today, -i)).count > 0) active++;
  const consistency = active / span14 * 100;
  const streakPart = Math.min(currentStreak(), 14) / 14 * 100;
  const discipline = Math.round(consistency * 0.6 + streakPart * 0.4);

  return { productivity, discipline };
}

/* ============================================================
   5. БОТЫ ДЛЯ ЛИДЕРБОРДА
   ============================================================ */
function createBots() {
  return BOT_NAMES.map((name, i) => ({
    id: 'bot-' + i,
    name,
    avatar: i === 0 ? '🤖' : i === 1 ? '🦊' : i === 2 ? '🐺' : BOT_AVATAR_POOL[(i - 3) % BOT_AVATAR_POOL.length],
    xp: Math.round(1500 * Math.pow(0.9, i) + Math.random() * 20),
    streak: Math.max(1, Math.round(30 * Math.pow(0.93, i) + Math.random() * 3))
  }));
}

function initBots() {
  if (!Array.isArray(state.bots) || state.bots.length !== BOT_NAMES.length) {
    state.bots = createBots();
    state.botsUpdated = Date.now();
    return;
  }
  // Пока тебя не было, боты тоже немного поиграли
  const hours = Math.min(Date.now() - (state.botsUpdated || Date.now()), 3 * 864e5) / 36e5;
  if (hours > 0.05) {
    state.bots.forEach(b => { b.xp += Math.round(hours * (2 + Math.random() * 6)); });
  }
  state.botsUpdated = Date.now();
}

function tickBots() {
  state.bots.forEach(b => {
    if (Math.random() < 0.12) b.xp += 1 + Math.floor(Math.random() * 4);
  });
  state.botsUpdated = Date.now();
}

function getPlayers() {
  const you = {
    id: 'you', isYou: true,
    name: state.profile.name, avatar: state.profile.avatar,
    xp: state.xp, streak: currentStreak()
  };
  return state.bots.map(b => ({ ...b })).concat(you)
    .map(p => ({ ...p, level: levelInfo(p.xp).level }));
}

function sortPlayers(players, mode) {
  const sorters = [
    (a, b) => b.xp - a.xp,
    (a, b) => b.streak - a.streak || b.xp - a.xp,
    (a, b) => b.level - a.level || b.xp - a.xp
  ];
  return players.slice().sort(sorters[mode] || sorters[0]);
}

function nearestRival() {
  let best = null;
  state.bots.forEach(b => {
    const diff = Math.abs(b.xp - state.xp);
    if (!best || diff < best.diff || (diff === best.diff && b.xp > best.bot.xp)) best = { bot: b, diff };
  });
  return best.bot;
}

/* ============================================================
   6. УВЕДОМЛЕНИЯ И ЭФФЕКТЫ
   ============================================================ */
function toast(icon, title, text = '') {
  const container = $('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<span class="toast-icon">${icon}</span>` +
    `<div><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}</div>` +
    `<button class="toast-close" type="button" aria-label="Close">×</button>`;
  container.appendChild(el);

  const remove = () => {
    if (!el.isConnected) return;
    el.classList.add('is-removing');
    setTimeout(() => el.remove(), 260);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 3800);
  while (container.children.length > 4) container.firstElementChild.remove();
}

function xpPopup(text, rect) {
  const container = $('xpPopupContainer');
  if (!container) return;
  const r = rect || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const el = document.createElement('div');
  el.className = 'xp-popup';
  el.textContent = text;
  el.style.left = (r.left + r.width / 2 - 24) + 'px';
  el.style.top = (r.top - 6) + 'px';
  container.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function confetti(count = 60) {
  const container = $('confettiContainer');
  if (!container) return;
  const colors = ['#7c5cff', '#23c9ff', '#45e39b', '#ffd166', '#f472d0', '#ff657d'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti';
    piece.style.left = (Math.random() * 100) + 'vw';
    piece.style.setProperty('--confetti-color', colors[i % colors.length]);
    piece.style.setProperty('--duration', (2 + Math.random() * 1.6) + 's');
    piece.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function openModal(el) {
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}
function closeModal(el) {
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (!$$('.modal-overlay.open').length) document.body.classList.remove('no-scroll');
}

function showLevelUp(level) {
  setText('levelUpTitle', `Level ${level}`);
  setText('levelUpRank', rankFor(level));
  openModal($('levelUpOverlay'));
  confetti(80);
}

/* ============================================================
   7. ИГРОВАЯ ЛОГИКА
   ============================================================ */
function addHistory(event) {
  state.history.unshift({ ...event, ts: Date.now() });
  if (state.history.length > 60) state.history.length = 60;
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements[a.id] && a.value(state) >= a.target) {
      state.achievements[a.id] = Date.now();
      addHistory({ type: 'achievement', title: a.title });
      toast(a.icon, 'Achievement unlocked', a.title);
    }
  });
}

// Единая точка выдачи наград: и для квестов, и для ежедневных миссий
function award({ kind, title, xp, gold, rect }) {
  const key = dayKey();
  const day = ensureDay(key);
  const levelBefore = levelInfo(state.xp).level;
  const hadActivityToday = state.streak.last === key;

  state.xp += xp;
  state.gold += gold;
  state.totalCompleted += 1;
  day.xp += xp;
  day.gold += gold;
  day.count += 1;
  if (!state.firstDay) state.firstDay = key;

  bumpStreak(key);
  addHistory({ type: kind, title, xp, gold });
  toast(kind === 'mission' ? '☀️' : '⚔️', `+${xp} XP · +${gold} 🪙`, title);

  if (!hadActivityToday && state.streak.current > 1) {
    toast('🔥', `${state.streak.current}-day streak!`, 'Come back tomorrow to keep it alive.');
  }
  if (day.count >= state.profile.dailyGoal && !day.goalHit) {
    day.goalHit = true;
    state.stats.goalDays += 1;
    toast('🎯', 'Daily goal complete!', 'Extra actions still earn XP until the daily limit.');
  }

  const levelAfter = levelInfo(state.xp).level;
  if (levelAfter > levelBefore) addHistory({ type: 'level', title: `Level ${levelAfter}` });

  checkAchievements();
  save();
  renderAll();
  xpPopup(`+${xp} XP`, rect);
  if (levelAfter > levelBefore) showLevelUp(levelAfter);
}

function completeQuest(id, rect) {
  const quest = state.quests.find(q => q.id === id);
  if (!quest) return;
  const today = dayKey();
  const day = peekDay(today);
  const done = day.quests[id] || 0;

  if (done >= quest.limit) {
    toast('⏳', 'Quest limit reached', 'This quest is finished for today.');
    return;
  }
  if (day.count >= GLOBAL_DAILY_LIMIT) {
    toast('⏳', 'Daily reward limit reached', 'Come back tomorrow for more XP.');
    return;
  }

  const diff = DIFFICULTY[quest.difficulty] || DIFFICULTY.medium;
  ensureDay(today).quests[id] = done + 1;
  award({ kind: 'quest', title: quest.name, xp: diff.xp, gold: diff.gold, rect });
}

function completeMission(id, rect) {
  const mission = MISSIONS.find(m => m.id === id);
  if (!mission) return;
  const today = dayKey();
  const day = peekDay(today);

  if (day.missions[id]) return;
  if (day.count >= GLOBAL_DAILY_LIMIT) {
    toast('⏳', 'Daily reward limit reached', 'Come back tomorrow for more XP.');
    return;
  }
  ensureDay(today).missions[id] = true;
  award({ kind: 'mission', title: mission.title, xp: mission.xp, gold: mission.gold, rect });
}

function buyReward(id) {
  const reward = REWARDS.find(r => r.id === id);
  if (!reward) return;
  const owned = state.purchases[id] || 0;
  if (reward.once && owned > 0) return;
  if (state.gold < reward.price) {
    toast('🪙', 'Not enough gold', `You need ${reward.price - state.gold} more.`);
    return;
  }
  state.gold -= reward.price;
  state.purchases[id] = owned + 1;
  state.stats.purchases += 1;
  addHistory({ type: 'reward', title: reward.title, cost: reward.price });
  checkAchievements();
  save();
  renderAll();
  toast(reward.icon, `${reward.title} purchased`, reward.once ? 'Added to your profile.' : 'Enjoy it, you earned it!');
}

function createQuest(event) {
  event.preventDefault();
  const nameInput = $('questName');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  if (state.quests.length >= MAX_QUESTS) {
    toast('⚠️', 'Quest board is full', `You can have up to ${MAX_QUESTS} quests. Delete an old one first.`);
    return;
  }
  const difficulty = DIFFICULTY[$('questDifficulty').value] ? $('questDifficulty').value : 'medium';
  state.quests.push({
    id: uid(),
    name,
    type: $('questType').value === 'habit' ? 'habit' : 'daily',
    difficulty,
    limit: clamp(parseInt($('questLimit').value, 10) || 1, 1, 3),
    created: Date.now()
  });
  addHistory({ type: 'created', title: name });
  save();
  renderAll();
  $('questForm').reset();
  closeModal($('questModal'));
  toast('⚔️', 'Quest created', name);
}

function deleteQuest(id) {
  const quest = state.quests.find(q => q.id === id);
  if (!quest) return;
  if (!window.confirm(`Delete quest "${quest.name}"?`)) return;
  state.quests = state.quests.filter(q => q.id !== id);
  save();
  renderAll();
}

/* ============================================================
   8. ОТРИСОВКА (render)
   ============================================================ */
let questFilter = 'all';
let sortMode = 0;
let duelRivalId = null;
let draftAvatar = '🧙';

const isActive = id => { const el = $(id); return !!el && el.classList.contains('active'); };

function renderAll() {
  renderPlayer();
  renderToday();
  renderStats();
  renderQuestsPage();
  renderDashboardLists();
  renderMissions();
  renderRewards();
  renderAchievements();
  renderStatistics();
  renderArena(true);
}

/* ---- Персонаж: имя, аватар, уровень, XP, золото ---- */
function renderPlayer() {
  const { level, into, need } = levelInfo(state.xp);
  const rank = rankFor(level);
  const { name, avatar } = state.profile;
  const percent = Math.round(into / need * 100);
  const label = `${into} / ${need} XP`;
  const badge = state.purchases.badge ? ' 🏅' : '';
  const streak = currentStreak();

  ['dashboardUsername', 'sidebarName'].forEach(id => setText(id, name));
  setText('heroName', name + badge);
  setText('profileName', name + badge);

  ['dashboardRank', 'dashboardRankHero', 'dashboardRankStat', 'sidebarRank'].forEach(id => setText(id, rank));
  setText('profileRank', rank.toUpperCase());

  ['mainAvatar', 'dashboardAvatar', 'profileAvatar'].forEach(id => setText(id, avatar));
  $$('.profile-mini-avatar, .mobile-profile-button').forEach(el => setText(el, avatar));

  ['dashboardLevel', 'dashboardLevelStat', 'characterLevel'].forEach(id => setText(id, level));
  setText('profileLevel', `Level ${level}`);
  ['xpText', 'heroXpLabel'].forEach(id => setText(id, label));
  ['xpFill', 'heroXpFill', 'profileXpFill'].forEach(id => setWidth(id, percent));
  setText('profileXpText', `${state.xp} XP`);

  setText('dashboardXP', state.xp);
  ['dashboardGold', 'rewardGold', 'profileGold'].forEach(id => setText(id, state.gold));
  ['dashboardStreak', 'profileStreak'].forEach(id => setText(id, streak));
  ['dashboardCompleted', 'profileCompleted'].forEach(id => setText(id, state.totalCompleted));
}

/* ---- Сегодняшний день: Daily Score, цель, серия ---- */
function renderToday() {
  const day = peekDay(dayKey());
  const goal = state.profile.dailyGoal;
  const count = day.count;
  const score = clamp(Math.round(count / goal * 100), 0, 100);
  const streak = currentStreak();

  setText('dailyScoreNumber', score);
  setText('dailyScoreRing', score + '%');
  const ring = $('dailyScoreRing');
  if (ring && ring.parentElement) {
    ring.parentElement.style.background =
      `conic-gradient(var(--accent) ${score * 3.6}deg, rgba(255,255,255,.06) 0deg)`;
  }

  const goalText = `${count} / ${goal} quests`;
  setText('dailyGoalText', goalText);
  setText('dailyGoalTextInline', goalText);
  setWidth('dailyGoalFill', score);
  setWidth('dailyGoalFillInline', score);

  let message = 'Start your first quest.';
  let sub = 'Small actions build a reliable routine.';
  if (count >= GLOBAL_DAILY_LIMIT) {
    message = 'Daily reward limit reached.';
    sub = 'Great work. Rest and come back tomorrow.';
  } else if (count >= goal) {
    message = 'Daily goal complete!';
    sub = 'Extra actions still earn XP until the limit.';
  } else if (count > 0) {
    message = 'Good start, keep going.';
    sub = `${goal - count} more to reach today's goal.`;
  }
  setText('dailyGoalMessage', message);
  setText('dailyGoalSubtext', sub);

  setText('streakNumber', streak);
  setText('bestStreakInline', state.streak.best);
  setText('dailyTodayInline', count);
  setText('quickSuccess', score + '%');
  setText('quickCompleted', count);
  setText('quickXP', day.xp);

  let streakMessage = 'Start your streak today.';
  if (streak > 0 && count > 0) streakMessage = 'Your streak is safe for today. See you tomorrow!';
  else if (streak > 0) streakMessage = `Complete one action today to protect your ${streak}-day streak.`;
  setText('streakMessage', streakMessage);
}

/* ---- Карточки статистики ---- */
function renderStats() {
  const m = metrics();
  setText('dashboardBestStreak', state.streak.best);
  setText('dashboardProductivity', m.productivity + '%');
  setText('dashboardDiscipline', m.discipline + '%');

  setText('statXP', state.xp);
  setText('statQuests', state.totalCompleted);
  setText('statBestStreak', state.streak.best);
  setText('statProductivity', m.productivity + '%');
}

/* ---- Страница Quests ---- */
function questProgress(quest) {
  const n = peekDay(dayKey()).quests[quest.id] || 0;
  return { n, done: n >= quest.limit };
}

function emptyState(icon, title, text, withButton) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div>` +
    `<h3>${title}</h3><p>${text}</p>` +
    (withButton ? '<button class="primary-button" type="button" data-action="new-quest">＋ New quest</button>' : '') +
    '</div>';
}

function renderQuestsPage() {
  const today = peekDay(dayKey());
  const items = state.quests.map(q => ({ q, ...questProgress(q) }));
  const unfinished = items.filter(i => !i.done).length;

  setText('availableQuests', unfinished);
  setText('navQuestCount', unfinished);
  setText('completedToday', today.count);
  setText('xpToday', today.xp);
  setText('dailyLimitText', GLOBAL_DAILY_LIMIT);

  const list = $('questsList');
  if (!list) return;

  let shown = items;
  if (questFilter === 'completed') shown = items.filter(i => i.done);
  else if (questFilter !== 'all') shown = items.filter(i => i.q.type === questFilter);
  shown = shown.slice().sort((a, b) => Number(a.done) - Number(b.done));

  if (!state.quests.length) {
    list.innerHTML = emptyState('⚔️', 'No quests yet',
      'Create a concrete action, like "Solve 5 algebra problems", and earn XP when you finish it.', true);
    return;
  }
  if (!shown.length) {
    list.innerHTML = emptyState('🔎', 'Nothing here',
      questFilter === 'completed' ? 'No quests are finished today yet.' : 'No quests of this type yet.', false);
    return;
  }

  const blocked = today.count >= GLOBAL_DAILY_LIMIT;
  list.innerHTML = shown.map(({ q, n, done }) => {
    const diff = DIFFICULTY[q.difficulty] || DIFFICULTY.medium;
    const type = q.type === 'habit' ? '🔁 Habit' : '☀️ Daily';
    const action = done
      ? '<span class="quest-completed-mark">✓ Done today</span>'
      : `<button class="quest-complete-button" type="button" data-complete="${q.id}"${blocked ? ' disabled' : ''}>${blocked ? 'Daily cap' : 'Complete'}</button>`;
    return `<article class="quest-card${done ? ' completed' : ''}">
      <div class="quest-top">
        <div class="quest-top-tags">
          <span class="quest-category">${type}</span>
          <span class="quest-difficulty">${diff.label}</span>
        </div>
        <button class="quest-delete" type="button" data-delete="${q.id}" aria-label="Delete quest" title="Delete quest">×</button>
      </div>
      <h3 class="quest-title">${esc(q.name)}</h3>
      <p class="quest-description">Resets every day · up to ${q.limit}× per day.</p>
      <div class="quest-bottom">
        <div class="quest-rewards">
          <span class="quest-reward">+${diff.xp} XP</span>
          <span class="quest-reward quest-gold">+${diff.gold} 🪙</span>
          <span class="quest-limit">${n}/${q.limit} today</span>
        </div>
        ${action}
      </div>
    </article>`;
  }).join('');
}

/* ---- Dashboard: ближайшие квесты и лента активности ---- */
function historyHtml(list) {
  return list.map(ev => {
    const meta = EVENT_META[ev.type] || { icon: '•', label: '' };
    let extra = '';
    if (ev.xp) extra = ` <span style="color:var(--cyan)">+${ev.xp} XP</span>`;
    else if (ev.cost) extra = ` <span style="color:var(--yellow)">−${ev.cost} 🪙</span>`;
    return `<div class="activity-item">
      <span class="activity-avatar">${meta.icon}</span>
      <div class="activity-text"><strong>${meta.label}</strong> ${esc(ev.title)}${extra}</div>
      <span class="activity-time">${fmtTime(ev.ts)}</span>
    </div>`;
  }).join('');
}

function renderDashboardLists() {
  const quests = $('dashboardQuests');
  if (quests) {
    const open = state.quests
      .map(q => ({ q, ...questProgress(q) }))
      .filter(i => !i.done)
      .slice(0, 4);

    if (!state.quests.length) {
      quests.innerHTML = emptyState('⚔️', 'No quests yet', 'Create your first quest to start earning XP.', true);
    } else if (!open.length) {
      quests.innerHTML = emptyState('🎉', 'All quests done for today', 'Nice work. New attempts unlock tomorrow.', false);
    } else {
      quests.innerHTML = open.map(({ q, n }) => {
        const diff = DIFFICULTY[q.difficulty] || DIFFICULTY.medium;
        return `<div class="compact-quest" data-section="quests">
          <span class="compact-quest-icon">${q.type === 'habit' ? '🔁' : '☀️'}</span>
          <div class="compact-quest-info"><strong>${esc(q.name)}</strong><span>${q.type} • ${n}/${q.limit} today</span></div>
          <span class="compact-quest-xp">+${diff.xp} XP</span>
        </div>`;
      }).join('');
    }
  }

  const feed = document.querySelector('#dashboard .activity-feed');
  if (feed) {
    feed.innerHTML = state.history.length
      ? historyHtml(state.history.slice(0, 5))
      : '<div class="duel-placeholder">No activity yet. Complete a quest to start your story.</div>';
  }
}

/* ---- Dailies: ежедневные миссии ---- */
function renderMissions() {
  const grid = document.querySelector('[data-extension-dailies]');
  if (!grid) return;
  const day = peekDay(dayKey());
  const blocked = day.count >= GLOBAL_DAILY_LIMIT;

  grid.innerHTML = MISSIONS.map(m => {
    const done = !!day.missions[m.id];
    const disabled = done || blocked;
    return `<article class="daily-mission-card glass-card${done ? ' done' : ''}">
      <div class="daily-mission-icon">${m.icon}</div>
      <h3>${m.title}</h3>
      <p>${m.desc}</p>
      <div class="daily-mission-footer">
        <span class="daily-mission-reward">+${m.xp} XP • +${m.gold} 🪙</span>
        <button class="daily-mission-button" type="button" data-mission="${m.id}"${disabled ? ' disabled' : ''}>${done ? 'Done ✓' : blocked ? 'Limit' : 'Complete'}</button>
      </div>
    </article>`;
  }).join('');
}

/* ---- Rewards: магазин ---- */
function renderRewards() {
  const grid = document.querySelector('[data-extension-rewards]');
  if (!grid) return;

  grid.innerHTML = REWARDS.map(r => {
    const owned = state.purchases[r.id] || 0;
    const soldOut = !!r.once && owned > 0;
    const affordable = state.gold >= r.price;
    const label = soldOut ? 'Owned ✓' : affordable ? 'Buy' : 'Not enough 🪙';
    return `<article class="reward-card glass-card">
      <div class="reward-icon">${r.icon}</div>
      <h3>${r.title}</h3>
      <p>${r.desc}</p>
      ${owned && !r.once ? `<small class="reward-owned">Used ${owned}×</small>` : ''}
      <div class="reward-footer">
        <span class="reward-price">${r.price} 🪙</span>
        <button class="reward-buy" type="button" data-buy="${r.id}"${soldOut || !affordable ? ' disabled' : ''}>${label}</button>
      </div>
    </article>`;
  }).join('');
}

/* ---- Achievements ---- */
function renderAchievements() {
  const grid = $('achievementsGrid');
  if (!grid) return;
  let unlocked = 0;

  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!state.achievements[a.id];
    if (done) unlocked++;
    const value = Math.min(a.value(state), a.target);
    const percent = Math.round(value / a.target * 100);
    return `<article class="achievement-card ${done ? 'unlocked' : 'locked'}">
      <div class="achievement-icon">${a.icon}</div>
      <h3>${a.title}</h3>
      <p>${a.desc}</p>
      <div class="achievement-progress">
        <div class="achievement-progress-head"><span>${done ? 'Unlocked' : 'Progress'}</span><span>${value} / ${a.target}</span></div>
        <div class="achievement-progress-track"><div class="achievement-progress-fill" style="width:${percent}%"></div></div>
      </div>
    </article>`;
  }).join('');

  setText('achievementCount', `${unlocked} / ${ACHIEVEMENTS.length}`);
}

/* ---- Statistics: график XP, карта активности, история ---- */
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

function renderStatistics() {
  const today = dayKey();

  const chart = $('xpChart');
  if (chart) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDays(today, -i);
      days.push({ key, xp: peekDay(key).xp, label: weekdayFormat.format(parseKey(key)) });
    }
    const max = Math.max(1, ...days.map(d => d.xp));
    chart.innerHTML = '<div class="weekly-days">' + days.map(d => {
      const height = d.xp ? Math.max(6, d.xp / max * 92) : 0;
      return `<div class="week-day" title="${d.key}">
        <span class="week-day-score">${d.xp}</span>
        <div class="week-day-bar"><div class="week-day-fill" style="height:${height}%"></div></div>
        <span class="week-day-label">${d.label}</span>
      </div>`;
    }).join('') + '</div>';
  }

  const map = document.querySelector('#statistics .activity-grid');
  if (map) {
    let cells = '';
    for (let i = 27; i >= 0; i--) {
      const key = addDays(today, -i);
      const count = peekDay(key).count;
      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3;
      cells += `<span class="activity-cell lvl-${level}" title="${key}: ${count} action${count === 1 ? '' : 's'}"></span>`;
    }
    map.innerHTML = cells;
  }

  const history = $('historyList');
  if (history) {
    history.innerHTML = state.history.length
      ? historyHtml(state.history.slice(0, 10))
      : '<div class="duel-placeholder">No activity yet. Your history will appear here.</div>';
  }
}

/* ---- Гонка (общая функция для двух мест) ---- */
function renderRace(container, rows) {
  if (!container) return;
  const existing = new Map($$('.race-row', container).map(el => [el.dataset.id, el]));
  const wanted = new Set(rows.map(r => r.id));
  existing.forEach((el, id) => { if (!wanted.has(id)) el.remove(); });

  rows.forEach((row, index) => {
    let el = existing.get(row.id);
    if (!el || !el.isConnected) {
      el = document.createElement('div');
      el.className = 'race-row';
      el.dataset.id = row.id;
      el.innerHTML =
        '<span class="race-name"></span>' +
        '<div class="race-lane"><span class="race-progress" style="width:0%"></span><span class="race-avatar" style="left:4%"></span></div>' +
        '<span class="race-score"></span>';
      container.appendChild(el);
      void el.offsetWidth; // перерисовка, чтобы полоска плавно «доехала»
    }
    if (container.children[index] !== el) container.insertBefore(el, container.children[index] || null);

    const percent = clamp(row.pct, 0, 100);
    el.querySelector('.race-name').textContent = row.name;
    el.querySelector('.race-score').textContent = row.xp;
    el.querySelector('.race-progress').style.width = percent + '%';
    const avatar = el.querySelector('.race-avatar');
    avatar.textContent = row.avatar;
    avatar.style.left = clamp(percent, 4, 96) + '%';
  });
}

function renderArena(force = false) {
  const onBoard = isActive('leaderboard');
  const onDashboard = isActive('dashboard');
  if (!force && !onBoard && !onDashboard) return;

  const players = getPlayers();
  const byXp = sortPlayers(players, 0);
  setText(document.querySelector('.nav-item[data-section="leaderboard"] .nav-count'), players.length);

  if (force || onBoard) {
    renderPodium(byXp);

    const top = byXp.slice(0, 6);
    if (!top.some(p => p.isYou)) top.push(byXp.find(p => p.isYou));
    const max = Math.max(1, byXp[0].xp);
    renderRace($('raceTrack'), top.map(p => ({
      id: p.id, name: p.isYou ? 'You' : p.name, avatar: p.avatar, xp: p.xp, pct: p.xp / max * 100
    })));

    const rows = $('leaderboardRows');
    if (rows) {
      rows.innerHTML = sortPlayers(players, sortMode).map((p, i) =>
        `<div class="table-row${p.isYou ? ' is-you' : ''}">
          <span class="table-rank">#${i + 1}</span>
          <div class="table-player">
            <span class="table-player-avatar">${p.avatar}</span>
            <span class="table-player-name"><strong>${esc(p.name)}${p.isYou ? ' (you)' : ''}</strong><small>${rankFor(p.level)}</small></span>
          </div>
          <span>LVL ${p.level}</span>
          <span class="table-score">${p.xp}</span>
          <span>🔥 ${p.streak}</span>
        </div>`).join('');
    }

    const t = new Date();
    setText('raceUpdated', `UPDATED ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`);
    setText('raceTimer', 'LIVE');
    renderDuel();
  }

  if (force || onDashboard) {
    const rivals = state.bots
      .slice()
      .sort((a, b) => Math.abs(a.xp - state.xp) - Math.abs(b.xp - state.xp))
      .slice(0, 2)
      .sort((a, b) => b.xp - a.xp);
    const rows = [
      { id: 'you', name: 'You', avatar: state.profile.avatar, xp: state.xp },
      ...rivals.map(b => ({ id: b.id, name: b.name, avatar: b.avatar, xp: b.xp }))
    ];
    const max = Math.max(1, ...rows.map(r => r.xp));
    renderRace($('dashboardRaceTrack'), rows.map(r => ({ ...r, pct: r.xp / max * 100 })));
  }
}

function renderPodium(byXp) {
  const box = $('podiumList');
  if (!box) return;
  const card = (p, cls, place, crown) =>
    `<article class="podium-card ${cls}">
      ${crown ? '<span class="podium-crown">♛</span>' : ''}
      <span class="podium-place">#${place}</span>
      <div class="podium-avatar">${p.avatar}</div>
      <strong class="podium-name">${p.isYou ? 'You' : esc(p.name)}</strong>
      <span class="podium-score">${p.xp}</span>
      <span class="podium-label">XP</span>
    </article>`;
  box.innerHTML = card(byXp[1], 'second', 2, false) + card(byXp[0], 'first', 1, true) + card(byXp[2], 'third', 3, false);
}

function renderDuel() {
  const box = $('duelResult');
  if (!box || !duelRivalId) return;

  const rival = duelRivalId === 'nearest'
    ? nearestRival()
    : (state.bots.find(b => b.id === duelRivalId) || nearestRival());
  const me = {
    name: state.profile.name, avatar: state.profile.avatar,
    xp: state.xp, level: levelInfo(state.xp).level, streak: currentStreak()
  };
  const them = { ...rival, level: levelInfo(rival.xp).level };

  const total = me.xp + them.xp;
  const share = total ? Math.round(me.xp / total * 100) : 50;
  const diff = them.xp - me.xp;
  const verdict = diff > 0
    ? `${esc(them.name)} leads by ${diff} XP. A few quests and you can catch up.`
    : diff < 0 ? `You lead by ${-diff} XP. Keep the pace!` : 'You are perfectly tied.';

  const player = p =>
    `<div class="duel-player">
      <div class="duel-player-avatar">${p.avatar}</div>
      <strong>${esc(p.name)}</strong>
      <small>LVL ${p.level} • ${p.xp} XP • 🔥 ${p.streak}</small>
    </div>`;

  box.innerHTML =
    `<div class="duel-card">${player(me)}
      <div class="duel-center"><div class="duel-vs">VS</div><div class="duel-bar"><div class="duel-bar-fill" style="width:${share}%"></div></div></div>
      ${player(them)}</div>
    <div class="duel-verdict">${verdict}</div>`;
}

/* ---- Tips и атмосфера ---- */
function renderTip() {
  const tip = TIPS[state.ui.tip % TIPS.length];
  setText('tipText', tip.text);
  setText('tipDescription', tip.desc);
}

function newTip() {
  state.ui.tip = (state.ui.tip + 1 + Math.floor(Math.random() * (TIPS.length - 1))) % TIPS.length;
  renderTip();
  save();
  toast('✦', 'New tip', TIPS[state.ui.tip].text);
}

function applyAtmosphere() {
  ATMOSPHERES.forEach(a => { if (a.cls) document.body.classList.remove(a.cls); });
  const current = ATMOSPHERES[state.ui.atmosphere % ATMOSPHERES.length];
  if (current.cls) document.body.classList.add(current.cls);
}

function nextAtmosphere() {
  state.ui.atmosphere = (state.ui.atmosphere + 1) % ATMOSPHERES.length;
  applyAtmosphere();
  save();
  toast('◈', 'Atmosphere changed', ATMOSPHERES[state.ui.atmosphere].name);
}

/* ============================================================
   9. ПРОФИЛЬ
   ============================================================ */
function buildAvatarOptions() {
  const box = $('avatarOptions');
  if (!box) return;
  box.innerHTML = AVATARS.map(a =>
    `<button type="button" class="avatar-option${a === draftAvatar ? ' active' : ''}" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`
  ).join('');
}

function fillProfileForm() {
  draftAvatar = state.profile.avatar;
  if ($('nameInput')) $('nameInput').value = state.profile.name;
  if ($('goalInput')) $('goalInput').value = state.profile.dailyGoal;
  buildAvatarOptions();
}

function saveProfile() {
  const name = $('nameInput').value.trim().slice(0, 18);
  if (!name) {
    toast('⚠️', 'Enter a hero name', 'Up to 18 characters.');
    $('nameInput').focus();
    return;
  }
  let goal = parseInt($('goalInput').value, 10);
  if (!Number.isFinite(goal)) goal = state.profile.dailyGoal;

  state.profile = { name, avatar: draftAvatar, dailyGoal: clamp(goal, 1, 10) };
  save();
  renderAll();
  fillProfileForm();
  toast('✅', 'Profile saved', name);
}

/* ============================================================
   10. НАВИГАЦИЯ
   ============================================================ */
function showSection(id) {
  const target = $(id);
  if (!target || !target.classList.contains('page-section')) return;

  $$('.page-section').forEach(s => s.classList.toggle('active', s === target));
  $$('.nav-item[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === id));
  renderAll();
  window.scrollTo(0, 0);
}

function setMobileMenu(open) {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open', open);
  if (overlay) overlay.classList.toggle('open', open);
}

const rectOf = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width }; };

function openQuestModal() {
  if (state.quests.length >= MAX_QUESTS) {
    toast('⚠️', 'Quest board is full', `You can have up to ${MAX_QUESTS} quests.`);
    return;
  }
  openModal($('questModal'));
  setTimeout(() => { const input = $('questName'); if (input) input.focus(); }, 60);
}

function onDocumentClick(e) {
  const t = e.target;

  const complete = t.closest('[data-complete]');
  if (complete) { completeQuest(complete.dataset.complete, rectOf(complete)); return; }

  const del = t.closest('[data-delete]');
  if (del) { deleteQuest(del.dataset.delete); return; }

  const mission = t.closest('[data-mission]');
  if (mission) { completeMission(mission.dataset.mission, rectOf(mission)); return; }

  const buy = t.closest('[data-buy]');
  if (buy) { buyReward(buy.dataset.buy); return; }

  if (t.closest('[data-action="new-quest"]')) { openQuestModal(); return; }

  const tab = t.closest('.quest-tab');
  if (tab) {
    questFilter = tab.dataset.filter || 'all';
    $$('.quest-tab').forEach(b => b.classList.toggle('active', b === tab));
    renderQuestsPage();
    return;
  }

  const avatar = t.closest('.avatar-option');
  if (avatar) {
    draftAvatar = avatar.dataset.avatar;
    $$('.avatar-option').forEach(b => b.classList.toggle('active', b.dataset.avatar === draftAvatar));
    return;
  }

  const nav = t.closest('[data-section]');
  if (nav) {
    showSection(nav.dataset.section);
    setMobileMenu(false);
  }
}

function bindEvents() {
  document.addEventListener('click', onDocumentClick);

  // Верхняя панель
  on('miniAvatar', 'click', () => showSection('profile'));
  on('atmosphereButton', 'click', nextAtmosphere);
  on('tipButton', 'click', newTip);   // кнопки «New tip» в других местах нажимают её через HTML-скрипт

  // Окно создания квеста
  on('newQuestButton', 'click', openQuestModal);
  on('questForm', 'submit', createQuest);
  on('questModalClose', 'click', () => closeModal($('questModal')));
  on('levelUpClose', 'click', () => closeModal($('levelUpOverlay')));
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  });

  // Профиль
  on('profileForm', 'submit', e => { e.preventDefault(); saveProfile(); });
  on('saveProfile', 'click', saveProfile);

  // Лидерборд
  const sortSelect = document.querySelector('select[aria-label="Sort leaderboard"]');
  if (sortSelect) sortSelect.addEventListener('change', () => { sortMode = sortSelect.selectedIndex; renderArena(true); });
  on('duelButton', 'click', () => { duelRivalId = $('opponentSelect').value; renderDuel(); });

  // Мобильное меню
  const overlay = document.createElement('div');
  overlay.className = 'mobile-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => setMobileMenu(false));
  const menuButton = document.querySelector('.mobile-menu-button');
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      setMobileMenu(!(sidebar && sidebar.classList.contains('mobile-open')));
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    $$('.modal-overlay.open').forEach(closeModal);
    setMobileMenu(false);
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayRollover(); });
}

function on(id, type, handler) {
  const el = $(id);
  if (el) el.addEventListener(type, handler);
}

/* ============================================================
   11. СТИЛИ, КОТОРЫХ НЕ ХВАТАЛО В style.css
   (можно перенести в style.css и удалить эту функцию)
   ============================================================ */
function injectStyles() {
  const style = document.createElement('style');
  style.id = 'habit-rpg-extra-styles';
  style.textContent = `
    .mobile-nav { display: none; }

    .table-row { display: grid; grid-template-columns: 56px minmax(150px, 1.6fr) 80px 90px 90px; align-items: center; gap: 8px; padding: 10px 9px; border-bottom: 1px solid rgba(255,255,255,.05); color: var(--soft); font-size: 9px; }
    .table-head { padding-top: 4px; color: var(--muted); font-size: 7px; font-weight: 800; letter-spacing: .1em; }
    .table-row.is-you { border-radius: 10px; border-bottom-color: transparent; background: rgba(124,92,255,.14); }

    .quest-top-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .quest-delete { width: 26px; height: 26px; border-radius: 8px; color: var(--muted); background: rgba(255,255,255,.04); font-size: 16px; line-height: 1; transition: color var(--ease), background var(--ease); }
    .quest-delete:hover { color: var(--red); background: rgba(255,101,125,.12); }
    .compact-quest { cursor: pointer; }
    .empty-state .primary-button { margin-top: 14px; }

    .activity-grid { display: grid; grid-template-columns: repeat(14, 1fr); gap: 5px; margin-top: 18px; }
    .activity-cell { aspect-ratio: 1; border-radius: 5px; background: rgba(255,255,255,.05); }
    .activity-cell.lvl-1 { background: rgba(124,92,255,.35); }
    .activity-cell.lvl-2 { background: rgba(124,92,255,.65); }
    .activity-cell.lvl-3 { background: linear-gradient(135deg, var(--accent), var(--cyan)); }

    .chart-area .weekly-days { height: 100%; margin-top: 0; }
    .chart-area .week-day { height: 100%; grid-template-rows: auto 1fr auto; }
    .chart-area .week-day-bar { position: relative; height: auto; padding: 0; }
    .chart-area .week-day-fill { position: absolute; left: 4px; right: 4px; bottom: 4px; width: auto; }

    .duel-verdict { margin-top: 12px; color: var(--soft); font-size: 10px; text-align: center; }
    .reward-owned { display: block; margin-top: 6px; color: var(--muted); font-size: 8px; }

    @media (max-width: 700px) {
      .mobile-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 90; display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: rgba(7,11,20,.92); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
      .mobile-nav .nav-item { min-height: 50px; flex-direction: column; justify-content: center; gap: 2px; padding: 0 2px; text-align: center; }
      .mobile-nav .nav-text { flex: none; font-size: 9px; }
      .content { padding-bottom: 96px; }
      .toast-container { bottom: 78px; }
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   12. ЗАПУСК
   ============================================================ */
let currentDay = dayKey();

function checkDayRollover() {
  const now = dayKey();
  if (now === currentDay) return;
  currentDay = now;
  normalizeStreak();
  save();
  renderAll();
}

function init() {
  injectStyles();
  state = loadState();
  initBots();
  normalizeStreak();

  const miniRace = $('dashboardRaceTrack');
  if (miniRace) miniRace.innerHTML = '';   // убираем заглушки из HTML

  // Список соперников для дуэли
  const select = $('opponentSelect');
  if (select) {
    select.innerHTML = '<option value="nearest">Nearest rival</option>' +
      state.bots.slice().sort((a, b) => b.xp - a.xp)
        .map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  }

  fillProfileForm();
  applyAtmosphere();
  renderTip();
  bindEvents();
  renderAll();
  save();

  setInterval(() => {
    if (document.hidden) return;
    tickBots();
    save();
    renderArena();
  }, BOT_TICK_MS);
  setInterval(checkDayRollover, 20000);

  // Для отладки из консоли: habitRPG.reset() сбрасывает весь прогресс
  window.habitRPG = {
    reset() { localStorage.removeItem(STORAGE_KEY); location.reload(); },
    get state() { return state; }
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
