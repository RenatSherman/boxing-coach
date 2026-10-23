/* ============================================================
   DATA.JS — данные, миграции, загрузка/сохранение локально
   ============================================================
   Зависимости: config.js (константы), utils.js (emptyAssess).

   Подключается ПОСЛЕ config.js и utils.js,
   ПЕРЕД cloud.js (cloud.js использует DB и saveLocal).

   Что внутри:
   - миграции (migrateFighterGroupsList, migrateFighterGroups, migrateAssessments)
   - loadLocal / saveLocal
   - DB — глобальный объект с данными (var, не let — см. note ниже)

   НЕ входит:
   - константы (в config.js)
   - утилиты (в utils.js)
   - Cloud, saveData (в cloud.js)
   - посещаемость (в attendance-data.js)
   - рекомендации и журнал (в journal.js)
   ============================================================ */

/* ================== МИГРАЦИИ ================== */

function migrateFighterGroupsList(db) {
  if (!db) return db;
  if (!Array.isArray(db.fighterGroups) || !db.fighterGroups.length) {
    db.fighterGroups = structuredClone(DEFAULT_FIGHTER_GROUPS);
  }
  const seen = new Set();
  db.fighterGroups = db.fighterGroups.filter(g => {
    if (!g || !g.key || seen.has(g.key)) return false;
    seen.add(g.key);
    if (!g.name) g.name = 'Группа';
    g.isKids = !!g.isKids;
    return true;
  });
  if (!db.fighterGroups.length) {
    db.fighterGroups = structuredClone(DEFAULT_FIGHTER_GROUPS);
  }
  return db;
}

function migrateFighterGroups(db) {
  if (!db || !db.fighters) return db;
  migrateFighterGroupsList(db);
  const validKeys = db.fighterGroups.map(g => g.key);
  const fallback = validKeys[0];
  db.fighters.forEach(f => {
    if (f.group === 'kids') f.group = 'kids_junior';
    if (!validKeys.includes(f.group)) f.group = fallback;
  });
  return db;
}

function migrateAssessments(db) {
  if (!db || !db.fighters) return db;
  db.fighters.forEach(f => {
    if (!Array.isArray(f.attendance)) f.attendance = [];
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

/* var (не let) — см. объяснение в CHECKPOINT.md:
   emptyAssess из utils.js обращается к DB через typeof,
   а typeof для let в TDZ бросает ошибку. С var — безопасно. */
var DB = loadLocal();