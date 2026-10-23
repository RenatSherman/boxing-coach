/* ============================================================
   DATA.JS — данные, миграции, облако, авторизация, посещаемость
   ============================================================
   Зависимости: config.js (константы), utils.js (emptyAssess и др.)
   Подключается ПОСЛЕ config.js и utils.js.

   Что внутри:
   - миграции (migrateFighterGroupsList, migrateFighterGroups, migrateAssessments)
   - loadLocal / saveLocal
   - DB — глобальный объект с данными
   - Cloud — синхронизация с Supabase
   - saveData
   - функции посещаемости (getTrainingsForDate, getTrainingSessions, ...)

   ВАЖНО: DB объявлена через var (не let) — чтобы emptyAssess
   из utils.js мог безопасно проверить typeof DB в момент loadLocal.
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

/* var (не let) — см. объяснение в шапке файла */
var DB = loadLocal();

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
                : state === 'offline' ? 'Локальный режим (офлайн)'
                : 'Ошибка синхронизации';
  }

  async function init() {
    if (!navigator.onLine) setBadge('offline');

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

      if (!navigator.onLine) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData?.session?.user;
          if (user) {
            userId = user.id; userEmail = user.email; enabled = true;
            setBadge('offline');
            document.getElementById('lockScreen').style.display = 'none';
            document.getElementById('appRoot').style.display = 'block';
            if (typeof render === 'function') render();
          }
        } catch (e2) {
          console.warn('[Cloud] Не удалось войти офлайн:', e2);
        }
      }
    }
  }

  async function loadFromCloud() {
    if (!enabled || !supabase || !userId) return;

    const { data: cloudRows, error } = await supabase
      .from('coach_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

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

    const jsonStr = JSON.stringify(DB);
    const sizeKB = Math.round(jsonStr.length / 1024);
    if (sizeKB > 900) {
      console.warn('[Cloud] JSON слишком большой:', sizeKB, 'КБ');
      toast(`⚠️ Данные весят ${sizeKB} КБ. Возможно, фото слишком большие.`, 'error');
    }

    const payload = { user_id: userId, data: DB, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('coach_data').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }

  function push() {
    saveLocal(DB);
    localStorage.setItem(STORE_KEY + '_ts', Date.now());

    if (!enabled) { setBadge('offline'); return; }

    if (!navigator.onLine) {
      localStorage.setItem(PENDING_SYNC_KEY, '1');
      setBadge('offline');
      return;
    }

    setBadge('syncing');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await pushToCloud();
        setBadge('online');
        localStorage.removeItem(PENDING_SYNC_KEY);
      } catch (e) {
        console.error('[Cloud] Ошибка отправки:', e);
        localStorage.setItem(PENDING_SYNC_KEY, '1');
        setBadge('offline');
      }
    }, 600);
  }

  async function trySyncPending() {
    if (!navigator.onLine) return;
    if (!enabled || !userId) return;
    if (localStorage.getItem(PENDING_SYNC_KEY) !== '1') return;

    try {
      await pushToCloud();
      localStorage.removeItem(PENDING_SYNC_KEY);
      setBadge('online');
      console.log('[Cloud] Досылка выполнена');
    } catch (e) {
      console.warn('[Cloud] Досылка не удалась:', e);
    }
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
    localStorage.removeItem(PENDING_SYNC_KEY);
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
    trySyncPending,
    isEnabled: () => enabled,
    getUser: () => ({ userId, userEmail, enabled }),
    getSupabase: () => supabase
  };
})();

/* ================== СЛУШАЕМ СЕТЬ ================== */
window.addEventListener('online', () => {
  console.log('[Cloud] Интернет вернулся');
  Cloud.trySyncPending();
});
window.addEventListener('offline', () => {
  console.log('[Cloud] Интернет пропал — работаем офлайн');
});
setInterval(() => Cloud.trySyncPending(), 60000);

function saveData(d) {
  if (d) DB = d;
  Cloud.push();
}

/* ================== ПОСЕЩАЕМОСТЬ (ATTENDANCE DATA) ================== */

function getTrainingsForDate(ds) {
  const trainings = [];
  DB.fighters.forEach(f => {
    (f.calendar[ds] || []).forEach((s, idx) => {
      trainings.push({
        fighterId: f.id,
        fighterName: f.name,
        group: f.group,
        date: ds,
        hour: s.hour,
        blockId: s.blockId,
        mode: s.mode,
        comment: s.comment || '',
        isGuest: !!s.guest,
        idx
      });
    });
  });
  trainings.sort((a,b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.fighterName.localeCompare(b.fighterName);
  });
  return trainings;
}

function getTrainingSessions(ds) {
  const trainings = getTrainingsForDate(ds);
  const sessions = {};

  trainings.forEach(t => {
    let key;
    if (t.mode === 'group') {
      key = t.isGuest
        ? `${t.hour}-guest-${t.fighterId}`
        : `${t.hour}-group-${t.group}`;
    } else {
      key = `${t.hour}-${t.mode}-${t.fighterId}`;
    }

    if (!sessions[key]) {
      sessions[key] = {
        key,
        date: ds,
        hour: t.hour,
        mode: t.mode,
        group: t.group,
        blockId: t.blockId,
        isGuestSession: t.isGuest,
        fighters: []
      };
    }
    sessions[key].fighters.push({
      id: t.fighterId,
      name: t.fighterName,
      group: t.group,
      idx: t.idx,
      isGuest: t.isGuest
    });
  });

  return Object.values(sessions).sort((a,b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.group.localeCompare(b.group);
  });
}

function isAttended(fighter, ds, hour) {
  if (!fighter.attendance) return null;
  const rec = fighter.attendance.find(a => a.date === ds && a.hour === hour);
  if (!rec) return null;
  return rec.present;
}

function setAttendance(fighterId, ds, hour, blockId, mode, present) {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  f.attendance = f.attendance || [];
  const existing = f.attendance.find(a => a.date === ds && a.hour === hour);
  if (existing) {
    existing.present = present;
    existing.blockId = blockId || existing.blockId;
    existing.mode = mode || existing.mode;
  } else {
    f.attendance.push({
      date: ds,
      hour,
      blockId: blockId || '',
      mode: mode || '',
      present
    });
  }
  saveData(DB);
}

function getAttendanceStats(fighter) {
  const list = fighter.attendance || [];
  const total = list.length;
  const present = list.filter(a => a.present).length;
  const absent = total - present;
  const percent = total ? Math.round(present / total * 100) : 0;
  return { total, present, absent, percent };
}

function getAttendanceStatsMonth(fighter, year, month) {
  const list = (fighter.attendance || []).filter(a => {
    const d = new Date(a.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const total = list.length;
  const present = list.filter(a => a.present).length;
  const absent = total - present;
  const percent = total ? Math.round(present / total * 100) : 0;
  return { total, present, absent, percent };
}

function formatSessionText(session) {
  const date = formatDateRu(session.date);
  const time = String(session.hour).padStart(2, '0') + ':00';
  const modeLabelStr = modeLabel(session.mode);
  const groupTitle = session.mode === 'group'
    ? groupName(session.group)
    : (session.fighters[0] ? session.fighters[0].name : '');

  const present = [];
  const absent = [];
  session.fighters.forEach(f => {
    const fighter = DB.fighters.find(x => x.id === f.id);
    if (!fighter) return;
    const st = isAttended(fighter, session.date, session.hour);
    const guestMark = f.isGuest ? ' [+]' : '';
    if (st === true) present.push(f.name + guestMark);
    else if (st === false) absent.push(f.name + guestMark);
    else absent.push(f.name + guestMark + ' (?)');
  });

  const lines = [];
  lines.push(`Тренировка ${date}, ${time}`);
  if (session.mode === 'group') {
    lines.push(`Группа: ${groupName(session.group)}`);
  } else {
    lines.push(`Формат: ${modeLabelStr}`);
  }
  if (session.blockId) {
    lines.push(`Упражнение: ${exerciseName(session.blockId)}`);
  }
  lines.push('');

  if (present.length) {
    lines.push(`Присутствовали (${present.length}):`);
    present.forEach((n, i) => lines.push(`${i+1}. ${n}`));
    lines.push('');
  }
  if (absent.length) {
    lines.push(`Отсутствовали (${absent.length}):`);
    absent.forEach((n, i) => lines.push(`${i+1}. ${n}`));
  }

  lines.push('');
  lines.push(`Тренер: ${DB.settings.coachName || '—'}`);
  lines.push('(+) — внеплановый боец');

  return lines.join('\n');
}

function formatDayText(ds) {
  const sessions = getTrainingSessions(ds);
  if (!sessions.length) return 'На эту дату тренировок нет.';
  const parts = sessions.map(s => formatSessionText(s));
  return parts.join('\n\n────────────\n\n');
}

/* ================== ВНЕПЛАНОВЫЕ БОЙЦЫ (GUESTS) ================== */

function addGuestToTraining(fighterId, ds, hour, hostGroupKey, hostBlockId, hostMode) {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return false;

  f.calendar[ds] = f.calendar[ds] || [];

  const already = f.calendar[ds].find(s => s.hour === hour);
  if (already) return false;

  const hostGroupName = groupName(hostGroupKey);
  const comment = `Внеплановый: пришёл на ${hostGroupName}`;

  f.calendar[ds].push({
    hour,
    blockId: hostBlockId || '',
    mode: hostMode || 'group',
    comment,
    guest: true,
    hostGroup: hostGroupKey
  });

  saveData(DB);
  return true;
}

function removeGuestFromTraining(fighterId, ds, hour) {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f || !f.calendar[ds]) return false;

  const idx = f.calendar[ds].findIndex(s => s.hour === hour && s.guest);
  if (idx < 0) return false;

  f.calendar[ds].splice(idx, 1);
  if (!f.calendar[ds].length) delete f.calendar[ds];

  if (f.attendance) {
    f.attendance = f.attendance.filter(a => !(a.date === ds && a.hour === hour));
  }

  saveData(DB);
  return true;
}

function getFightersNotInSession(ds, hour, sessionFighterIds) {
  return DB.fighters.filter(f => {
    if (sessionFighterIds.includes(f.id)) return false;
    const has = (f.calendar[ds] || []).some(s => s.hour === hour);
    if (has) return false;
    return true;
  });
}