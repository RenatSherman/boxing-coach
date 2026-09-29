/* ============================================================
   DATA.JS — данные, справочники, облако, авторизация, утилиты
   ============================================================ */

/* ================== SUPABASE CONFIG ================== */
const SUPABASE_URL = 'https://sfealuhkjpdauycbgsvo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWFsdWhranBkYXV5Y2Jnc3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDkwNjksImV4cCI6MjEwNTgyNTA2OX0.s0srvgtLGWyJgoP64-fDETI01GISpWH_ZRWjs-PaoPw';

/* ================== SCALE ================== */
const MAX_SCORE = 10;

/* ================== ГРУППЫ БОЙЦОВ ================== */
const FIGHTER_GROUPS = [
  { key: 'kids_junior', name: 'Младшая группа', short: 'Младшая', isKids: true },
  { key: 'kids_middle', name: 'Средняя группа', short: 'Средняя', isKids: true },
  { key: 'adults', name: 'Взрослые', short: 'Взрослые', isKids: false }
];
function groupName(key) {
  const g = FIGHTER_GROUPS.find(x => x.key === key);
  return g ? g.name : '—';
}
function groupShort(key) {
  const g = FIGHTER_GROUPS.find(x => x.key === key);
  return g ? g.short : '—';
}

/* ================== Справочники по умолчанию ================== */
const DEFAULT_DIRECTIONS = [
  { key: 'technique', name: 'Техника',
    criteria: [
      { key: 'straight', name: 'Прямые' },
      { key: 'side', name: 'Боковые' },
      { key: 'uppercut', name: 'Удары снизу' }
    ] },
  { key: 'physical', name: 'Физика',
    criteria: [
      { key: 'strength', name: 'Сила' },
      { key: 'speed', name: 'Скорость' },
      { key: 'coordination', name: 'Координация' },
      { key: 'endurance', name: 'Выносливость' },
      { key: 'flexibility', name: 'Гибкость' }
    ] },
  { key: 'tactics', name: 'Тактика',
    criteria: [
      { key: 'longRange', name: 'Дистанция' },
      { key: 'closeRange', name: 'Ближняя дистанция' },
      { key: 'footwork', name: 'Работа ногами' }
    ] },
  { key: 'psychology', name: 'Психология',
    criteria: [
      { key: 'stability', name: 'Устойчивость' },
      { key: 'stress', name: 'Стресс' },
      { key: 'defeat', name: 'Реакция на поражения' }
    ] }
];

const DEFAULT_EXERCISE_GROUPS = [
  { key: 'frontHand', name: 'Передняя рука',
    exercises: [
      { id: 'fh1', name: 'Джеб' },
      { id: 'fh2', name: 'Хук' },
      { id: 'fh3', name: 'Удар снизу' }
    ] },
  { key: 'strongHand', name: 'Сильнейшая рука',
    exercises: [
      { id: 'sh1', name: 'Джеб' },
      { id: 'sh2', name: 'Хук' },
      { id: 'sh3', name: 'Удар снизу' }
    ] },
  { key: 'legs', name: 'Ноги',
    exercises: [
      { id: 'lg1', name: 'Челнок' },
      { id: 'lg2', name: 'Передвижения' }
    ] }
];

const DEFAULT_MEASUREMENT_GROUPS = [
  { key: 'test1', name: 'Силовые замеры', measurements: [
    { id: 'pushup', name: 'Отжимания', unit: 'раз' },
    { id: 'pullup', name: 'Подтягивания', unit: 'раз' },
    { id: 'abs', name: 'Пресс', unit: 'раз' }
  ]}
];

/* ================== ХРАНИЛИЩЕ ================== */
const STORE_KEY = 'boxingCoachV17';

function defaultDB() {
  return {
    fighters: [],
    directions: structuredClone(DEFAULT_DIRECTIONS),
    exerciseGroups: structuredClone(DEFAULT_EXERCISE_GROUPS),
    measurementGroups: structuredClone(DEFAULT_MEASUREMENT_GROUPS),
    settings: { coachName: 'Ильнур Нуриев', season: '2025', notifications: true }
  };
}

/* ================== МИГРАЦИИ ================== */
function migrateFighterGroups(db) {
  if (!db || !db.fighters) return db;
  db.fighters.forEach(f => {
    if (f.group === 'kids') f.group = 'kids_junior';
    if (!FIGHTER_GROUPS.find(g => g.key === f.group)) f.group = 'kids_junior';
  });
  return db;
}

function migrateAssessments(db) {
  if (!db || !db.fighters) return db;
  db.fighters.forEach(f => {
    if (Array.isArray(f.assessments)) return;
    const arr = [];
    if (f.startSeason) {
      arr.push({
        id: 'a_start_' + (f.id || 'x'),
        date: f.seasonStartDate || (new Date().getFullYear() + '-01-01'),
        type: 'start', name: 'Начало сезона',
        data: structuredClone(f.startSeason)
      });
    }
    if (f.endSeason) {
      arr.push({
        id: 'a_end_' + (f.id || 'x'),
        date: f.seasonEndDate || new Date().toISOString().slice(0,10),
        type: 'end', name: 'Конец сезона',
        data: structuredClone(f.endSeason)
      });
    }
    if (arr.length === 0) {
      const today = new Date().toISOString().slice(0,10);
      arr.push({ id: 'a_start_' + (f.id || 'x'), date: today, type: 'start', name: 'Начало сезона', data: emptyAssess() });
      arr.push({ id: 'a_end_' + (f.id || 'x'), date: today, type: 'end', name: 'Конец сезона', data: emptyAssess() });
    } else if (arr.length === 1) {
      arr.push({ id: 'a_end_' + (f.id || 'x'), date: arr[0].date, type: 'end', name: 'Конец сезона', data: structuredClone(arr[0].data) });
    }
    f.assessments = arr;
    if (!Array.isArray(f.measurements)) f.measurements = [];
  });
  return db;
}

/* ================== ЗАГРУЗКА / СОХРАНЕНИЕ ЛОКАЛЬНО ================== */
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    if (parsed.exercises && !parsed.exerciseGroups) {
      parsed.exerciseGroups = [
        { key: 'frontHand', name: 'Передняя рука', exercises: parsed.exercises.frontHand || [] },
        { key: 'strongHand', name: 'Сильнейшая рука', exercises: parsed.exercises.strongHand || [] },
        { key: 'legs', name: 'Ноги', exercises: parsed.exercises.legs || [] }
      ];
      delete parsed.exercises;
    }
    if (!parsed.directions) parsed.directions = structuredClone(DEFAULT_DIRECTIONS);
    if (!parsed.exerciseGroups) parsed.exerciseGroups = structuredClone(DEFAULT_EXERCISE_GROUPS);
    if (!parsed.measurementGroups) parsed.measurementGroups = structuredClone(DEFAULT_MEASUREMENT_GROUPS);
    migrateFighterGroups(parsed);
    migrateAssessments(parsed);
    return parsed;
  } catch { return defaultDB(); }
}
function saveLocal(d) { localStorage.setItem(STORE_KEY, JSON.stringify(d)); }

let DB = loadLocal();

/* ================== ОБЛАКО (SUPABASE) ================== */
const Cloud = (() => {
  let supabase = null, enabled = false, userId = null, userEmail = null;
  let badge = null, saveTimer = null, lastRemoteUpdate = 0, realtimeChannel = null;

  function setBadge(state) {
    if (!badge) badge = document.getElementById('syncBadge');
    if (!badge) return;
    badge.className = 'sync-badge ' + state;
    badge.title = state === 'online' ? 'Облако: синхронизировано'
                : state === 'syncing' ? 'Облако: синхронизация…'
                : state === 'offline' ? 'Локальный режим'
                : 'Ошибка синхронизации';
  }

  async function init() {
    try {
      if (!supabase) supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setBadge('offline'); return; }

      userId = user.id; userEmail = user.email; enabled = true;
      await loadFromCloud();
      await subscribeRealtime();
      setBadge('online');
      document.getElementById('lockScreen').style.display = 'none';
      document.getElementById('appRoot').style.display = 'block';
      if (typeof render === 'function') render();
    } catch (e) {
      console.warn('[Cloud] Ошибка инициализации:', e);
      setBadge('error'); enabled = false;
    }
  }

  async function loadFromCloud() {
    if (!enabled || !supabase || !userId) return;
    const { data: cloudRows, error } = await supabase
      .from('coach_data').select('data, updated_at').eq('user_id', userId);
    if (error) throw error;
    if (cloudRows && cloudRows.length > 0) {
      const cloudData = cloudRows[0];
      const remoteTs = new Date(cloudData.updated_at).getTime();
      const localTs = +(localStorage.getItem(STORE_KEY + '_ts') || 0);
      if (remoteTs >= localTs) {
        DB = cloudData.data;
        if (!DB.directions) DB.directions = structuredClone(DEFAULT_DIRECTIONS);
        if (!DB.exerciseGroups) DB.exerciseGroups = structuredClone(DEFAULT_EXERCISE_GROUPS);
        if (!DB.measurementGroups) DB.measurementGroups = structuredClone(DEFAULT_MEASUREMENT_GROUPS);
        migrateFighterGroups(DB);
        migrateAssessments(DB);
        saveLocal(DB);
        localStorage.setItem(STORE_KEY + '_ts', remoteTs);
      } else {
        await pushToCloud();
      }
    } else {
      await pushToCloud();
    }
  }

  async function subscribeRealtime() {
    if (!supabase || !userId) return;
    if (realtimeChannel) {
      try { await supabase.removeChannel(realtimeChannel); } catch(e){}
      realtimeChannel = null;
    }
    realtimeChannel = supabase
      .channel('coach_data_changes_' + userId + '_' + Date.now())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'coach_data', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!payload.new) return;
          const remoteTs = new Date(payload.new.updated_at).getTime();
          if (remoteTs > lastRemoteUpdate + 500) {
            lastRemoteUpdate = remoteTs;
            DB = payload.new.data;
            migrateFighterGroups(DB);
            migrateAssessments(DB);
            saveLocal(DB);
            localStorage.setItem(STORE_KEY + '_ts', remoteTs);
            if (typeof render === 'function') render();
          }
        }
      ).subscribe();
  }

  async function pushToCloud() {
    if (!enabled || !supabase || !userId) return;
    const payload = { user_id: userId, data: DB, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('coach_data').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }

  function push() {
    saveLocal(DB);
    localStorage.setItem(STORE_KEY + '_ts', Date.now());
    if (!enabled) { setBadge('offline'); return; }
    setBadge('syncing');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await pushToCloud(); setBadge('online'); }
      catch (e) { console.error(e); setBadge('error'); }
    }, 600);
  }

  async function register(email, password) {
    if (!supabase) throw new Error('Нет подключения');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Не удалось создать пользователя');
    if (!data.session) throw new Error('Включено подтверждение email. Отключите его в Supabase.');
    await onAuthChanged(data.user);
    return data.user;
  }
  async function login(email, password) {
    if (!supabase) throw new Error('Нет подключения');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await onAuthChanged(data.user);
    return data.user;
  }
  async function logout() {
    if (!supabase) return;
    if (realtimeChannel) {
      try { await supabase.removeChannel(realtimeChannel); } catch(e){}
      realtimeChannel = null;
    }
    try { await supabase.auth.signOut(); } catch(e){}
    userId = null; userEmail = null; enabled = false;
    DB = defaultDB();
    saveLocal(DB);
    localStorage.removeItem(STORE_KEY + '_ts');
    document.getElementById('lockScreen').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
    setBadge('offline');
  }
  async function onAuthChanged(user) {
    userId = user.id; userEmail = user.email; enabled = true;
    await loadFromCloud();
    await subscribeRealtime();
    setBadge('online');
    document.getElementById('lockScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'block';
    if (typeof render === 'function') render();
  }

  return {
    init, push, register, login, logout, onAuthChanged,
    isEnabled: () => enabled,
    getUser: () => ({ userId, userEmail, enabled }),
    getSupabase: () => supabase
  };
})();

function saveData(d) {
  if (d) DB = d;
  Cloud.push();
}

/* ================== УТИЛИТЫ ================== */
function uid() { return Math.random().toString(36).slice(2, 10); }

function calcAge(d) {
  if (!d) return '—';
  const bd = new Date(d); if (isNaN(bd)) return '—';
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age >= 0 ? age : '—';
}

function avgObj(o) {
  const v = Object.values(o || {});
  return v.length ? +(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2) : 0;
}
function avgAll(s) {
  const v = [];
  Object.values(s).forEach(g => Object.values(g).forEach(x => v.push(x)));
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0;
}

function emptyAssess() {
  const obj = {};
  DB.directions.forEach(d => {
    obj[d.key] = {};
    d.criteria.forEach(c => obj[d.key][c.key] = 0);
  });
  return obj;
}

/* Упражнения */
function allExerciseItems() {
  const res = [];
  DB.exerciseGroups.forEach(g => {
    g.exercises.forEach(e => res.push({
      id: e.id, groupName: g.name, name: e.name,
      fullName: `${g.name}: ${e.name}`
    }));
  });
  return res;
}
function exerciseName(id) {
  if (!id) return '—';
  const e = allExerciseItems().find(x => x.id === id);
  return e ? e.fullName : '—';
}

/* Замеры */
function allMeasurementItems() {
  const res = [];
  DB.measurementGroups.forEach(g => {
    g.measurements.forEach(m => res.push({
      id: m.id, groupKey: g.key, groupName: g.name,
      name: m.name, unit: m.unit || 'раз',
      fullName: `${g.name}: ${m.name}`
    }));
  });
  return res;
}
function measurementById(id) {
  return allMeasurementItems().find(m => m.id === id) || null;
}

/* Оценки */
function sortAssessments(f) {
  if (!f.assessments) return [];
  return f.assessments.slice().sort((a,b) => a.date.localeCompare(b.date));
}
function getStartAssess(f) {
  const list = sortAssessments(f);
  return list.find(a => a.type === 'start') || list[0] || null;
}
function getEndAssess(f) {
  const list = sortAssessments(f);
  const last = list[list.length-1] || null;
  return list.find(a => a.type === 'end') || last;
}

/* Замеры бойца */
function sortMeasurements(f, measureId) {
  if (!f.measurements) return [];
  return f.measurements
    .filter(m => m.measureId === measureId)
    .slice()
    .sort((a,b) => a.date.localeCompare(b.date));
}

/* Режимы тренировок */
function modeLabel(m) {
  return m === 'self' ? 'Самостоятельно'
       : m === 'personal' ? 'Индивидуально'
       : 'Группа';
}

/* Даты */
function todayStr() { return new Date().toISOString().slice(0,10); }
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateRu(ds) {
  if (!ds) return '—';
  const [y,m,d] = ds.split('-');
  return `${d}.${m}.${y}`;
}

/* Уведомления */
function toast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>t.className = 'toast', 2500);
}

/* Забытые бойцы (14+ дней без тренировок) */
function getForgottenFighters(daysThreshold = 14) {
  const now = Date.now();
  const result = [];
  DB.fighters.forEach(f => {
    let lastTs = 0;
    Object.keys(f.calendar || {}).forEach(ds => {
      const slots = f.calendar[ds] || [];
      if (slots.length) {
        const t = new Date(ds + 'T00:00:00').getTime();
        if (t > lastTs) lastTs = t;
      }
    });
    const daysAgo = lastTs ? Math.floor((now - lastTs) / 86400000) : null;
    if (daysAgo === null || daysAgo >= daysThreshold) {
      result.push({ fighter: f, daysAgo });
    }
  });
  return result.sort((a,b) => {
    if (a.daysAgo === null) return -1;
    if (b.daysAgo === null) return 1;
    return b.daysAgo - a.daysAgo;
  });
}

/* === Отображение тренировки в календаре бойца === */
function trainingDisplayName(training, fighter) {
  if (training.blockId) {
    return exerciseName(training.blockId);
  }
  return fighter ? groupName(fighter.group) : 'Тренировка';
}

/* === Агрегация событий в ячейке календаря тренера === */
function aggregateSlotEvents(events) {
  if (!events.length) return [];

  const byGroup = {};
  events.forEach(ev => {
    const key = ev.f.group;
    if (!byGroup[key]) byGroup[key] = [];
    byGroup[key].push(ev);
  });

  const result = [];
  Object.keys(byGroup).forEach(gKey => {
    const groupEvents = byGroup[gKey];
    if (groupEvents.length === 1) {
      result.push({
        label: groupEvents[0].f.name,
        mode: groupEvents[0].s.mode,
        count: 1,
        events: groupEvents
      });
    } else {
      result.push({
        label: `${groupName(gKey)} (${groupEvents.length})`,
        mode: 'group',
        count: groupEvents.length,
        events: groupEvents
      });
    }
  });

  return result;
}

/* ================== ШАГ 2: РЕКОМЕНДАЦИИ И ЖУРНАЛ ================== */

/* Маппинг: критерий → ключевые слова упражнений, которые его развивают */
const CRITERION_TO_EXERCISES = {
  straight:   ['джеб', 'прям'],
  side:       ['хук', 'боков'],
  uppercut:   ['снизу', 'апперкот'],
  strength:   ['сил', 'отжим', 'подтяг', 'пресс', 'штанг', 'гир'],
  speed:      ['скорост', 'быстр', 'рывок'],
  coordination: ['координ', 'челнок', 'реакц'],
  endurance:  ['выносл', 'бег', 'скакал', 'круг'],
  flexibility:['гибк', 'растяж'],
  longRange:  ['дистанц', 'джеб', 'прям'],
  closeRange: ['ближн', 'хук', 'снизу'],
  footwork:   ['передвиж', 'челнок', 'ног', 'шаг'],
  stability:  ['устойчив', 'стойк', 'баланс'],
  stress:     ['стресс', 'спарринг', 'бой'],
  defeat:     ['поражен', 'реакц']
};

/* Найти упражнения, которые развивают данный критерий */
function getRecommendationsForCriterion(critKey) {
  const keywords = CRITERION_TO_EXERCISES[critKey] || [];
  if (!keywords.length) return [];
  const items = allExerciseItems();
  const found = items.filter(item => {
    const lower = item.name.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  });
  return found.slice(0, 5);
}

/* Найти слабые критерии у бойца (по последнему замеру с ненулевыми оценками) */
function getWeakPoints(f, threshold = 6) {
  const list = sortAssessments(f);
  if (!list.length) return [];

  let lastFilled = null;
  for (let i = list.length - 1; i >= 0; i--) {
    let hasAny = false;
    DB.directions.forEach(d => {
      Object.values(list[i].data[d.key] || {}).forEach(v => { if (+v > 0) hasAny = true; });
    });
    if (hasAny) { lastFilled = list[i]; break; }
  }
  if (!lastFilled) return [];

  const weak = [];
  DB.directions.forEach(d => {
    d.criteria.forEach(c => {
      const score = +(lastFilled.data[d.key]?.[c.key] || 0);
      if (score > 0 && score < threshold) {
        weak.push({
          dirKey: d.key,
          dirName: d.name,
          critKey: c.key,
          critName: c.name,
          score,
          assessment: lastFilled,
          recommendations: getRecommendationsForCriterion(c.key)
        });
      }
    });
  });

  weak.sort((a, b) => a.score - b.score);
  return weak.slice(0, 5);
}

/* Последние N тренировок по всем бойцам, отсортированные от свежих к старым */
function getRecentTrainings(limit = 30) {
  const list = [];
  DB.fighters.forEach(f => {
    Object.entries(f.calendar || {}).forEach(([ds, slots]) => {
      slots.forEach((s, idx) => {
        list.push({
          date: ds,
          hour: s.hour,
          blockId: s.blockId,
          mode: s.mode,
          comment: s.comment || '',
          fighter: f,
          idx
        });
      });
    });
  });
  list.sort((a, b) => {
    const ka = a.date + String(a.hour).padStart(2, '0');
    const kb = b.date + String(b.hour).padStart(2, '0');
    return kb.localeCompare(ka);
  });
  return list.slice(0, limit);
}

/* Сколько дней прошло с последней тренировки бойца. null = вообще нет тренировок */
function getLastTrainingDays(f) {
  let lastTs = 0;
  Object.keys(f.calendar || {}).forEach(ds => {
    const slots = f.calendar[ds] || [];
    if (slots.length) {
      const t = new Date(ds + 'T00:00:00').getTime();
      if (t > lastTs) lastTs = t;
    }
  });
  if (!lastTs) return null;
  return Math.floor((Date.now() - lastTs) / 86400000);
}