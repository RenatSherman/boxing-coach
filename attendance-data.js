/* ============================================================
   ATTENDANCE-DATA.JS — данные для посещаемости
   ============================================================
   Зависимости: config.js, utils.js (groupName, exerciseName,
   modeLabel, formatDateRu), data.js (DB), cloud.js (saveData).

   Подключается ПОСЛЕ cloud.js.

   Что внутри:
   - getTrainingsForDate — плоский список тренировок на дату
   - getTrainingSessions — сгруппированные сессии (для чек-листа)
   - isAttended — статус посещения бойца (true/false/null)
   - setAttendance — записать/обновить статус
   - getAttendanceStats / getAttendanceStatsMonth — статистика
   - formatSessionText / formatDayText — текст для отправки
   - addGuestToTraining / removeGuestFromTraining — внеплановые
   - getFightersNotInSession — кто может быть добавлен
   ============================================================ */

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