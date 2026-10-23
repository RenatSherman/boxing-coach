/* ============================================================
   UTILS.JS — утилиты и хелперы
   ============================================================
   Чистые функции без побочных эффектов:
   - работа с датами
   - группы бойцов (хелперы)
   - упражнения и замеры (поиск)
   - оценки (сортировка, начало/конец сезона)
   - уведомления (toast)
   - журнал забытых бойцов, название тренировки, агрегация

   НЕ входит: рекомендации и журнал тренировок — они в journal.js.
   НЕ входит: посещаемость — она в attendance-data.js.

   Подключается ПОСЛЕ config.js и ПЕРЕД data.js
   (data.js использует emptyAssess при загрузке).
   ============================================================ */

/* ================== ID ================== */
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ================== ДАТЫ ================== */
function todayStr() { return new Date().toISOString().slice(0,10); }

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateRu(ds) {
  if (!ds) return '—';
  const [y,m,d] = ds.split('-');
  return `${d}.${m}.${y}`;
}

/* ================== ВОЗРАСТ ================== */
function calcAge(d) {
  if (!d) return '—';
  const bd = new Date(d); if (isNaN(bd)) return '—';
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age >= 0 ? age : '—';
}

/* ================== СРЕДНИЕ ================== */
function avgObj(o) {
  const v = Object.values(o || {});
  return v.length ? +(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2) : 0;
}

function avgAll(s) {
  const v = [];
  Object.values(s).forEach(g => Object.values(g).forEach(x => v.push(x)));
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0;
}

/* ================== ГРУППЫ БОЙЦОВ (хелперы) ================== */
function makeGroupShort(name) {
  if (!name) return '—';
  const trimmed = String(name).trim();
  if (trimmed.length <= 10) return trimmed;
  return trimmed.slice(0, 9) + '…';
}

function getFighterGroups() {
  if (!DB || !Array.isArray(DB.fighterGroups) || !DB.fighterGroups.length) {
    return structuredClone(DEFAULT_FIGHTER_GROUPS);
  }
  return DB.fighterGroups;
}

function groupByKey(key) {
  return getFighterGroups().find(g => g.key === key) || null;
}

function groupName(key) {
  const g = groupByKey(key);
  return g ? g.name : '—';
}

function groupShort(key) {
  const g = groupByKey(key);
  return g ? makeGroupShort(g.name) : '—';
}

function groupIsKids(key) {
  const g = groupByKey(key);
  return g ? !!g.isKids : false;
}

/* ================== ПУСТАЯ ОЦЕНКА ==================
   Защищена на случай вызова ДО инициализации DB
   (например, во время loadLocal при первом запуске).
*/
function emptyAssess() {
  const obj = {};
  const dirs = (typeof DB !== 'undefined' && DB && Array.isArray(DB.directions))
    ? DB.directions
    : (typeof DEFAULT_DIRECTIONS !== 'undefined' ? DEFAULT_DIRECTIONS : []);
  dirs.forEach(d => {
    obj[d.key] = {};
    d.criteria.forEach(c => obj[d.key][c.key] = 0);
  });
  return obj;
}

/* ================== УПРАЖНЕНИЯ ================== */
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

/* ================== ЗАМЕРЫ (справочник) ================== */
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

/* ================== ОЦЕНКИ ================== */
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

/* ================== ЗАМЕРЫ БОЙЦА ================== */
function sortMeasurements(f, measureId) {
  if (!f.measurements) return [];
  return f.measurements
    .filter(m => m.measureId === measureId)
    .slice()
    .sort((a,b) => a.date.localeCompare(b.date));
}

/* ================== РЕЖИМЫ ТРЕНИРОВОК ================== */
function modeLabel(m) {
  return m === 'self' ? 'Самостоятельно'
       : m === 'personal' ? 'Индивидуально'
       : 'Группа';
}

/* ================== УВЕДОМЛЕНИЯ (toast) ================== */
function toast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>t.className = 'toast', 2500);
}

/* ================== ЗАБЫТЫЕ БОЙЦЫ ================== */
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

/* ================== НАЗВАНИЕ ТРЕНИРОВКИ ================== */
function trainingDisplayName(training, fighter) {
  if (training.blockId) {
    return exerciseName(training.blockId);
  }
  return fighter ? groupName(fighter.group) : 'Тренировка';
}

/* ================== АГРЕГАЦИЯ СОБЫТИЙ В КАЛЕНДАРЕ ================== */
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