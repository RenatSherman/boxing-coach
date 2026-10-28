/* ============================================================
   ATTENDANCE-DATA.JS — данные для посещаемости
   ============================================================ */

function getTrainingsForDate(ds) {
  const trainings = [];
  DB.fighters.forEach(f => {
    (f.calendar[ds] || []).forEach((s, idx) => {
      const att = isAttended(f, ds, s.hour);
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
        status: att.status,
        reason: att.reason,
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
      key = t.isGuest ? `${t.hour}-guest-${t.fighterId}` : `${t.hour}-group-${t.group}`;
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
      isGuest: t.isGuest,
      status: t.status,
      reason: t.reason
    });
  });

  return Object.values(sessions).sort((a,b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.group.localeCompare(b.group);
  });
}

function isAttended(fighter, ds, hour) {
  if (!fighter.attendance) return { status: null, reason: '' };
  const rec = fighter.attendance.find(a => a.date === ds && a.hour === hour);
  if (!rec) return { status: null, reason: '' };
  
  // Поддержка старого формата (когда был только true/false)
  if (typeof rec.present === 'boolean') {
    return { status: rec.present ? 'present' : 'absent', reason: '' };
  }
  return { status: rec.status, reason: rec.reason || '' };
}

function setAttendance(fighterId, ds, hour, blockId, mode, status, reason = '') {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  f.attendance = f.attendance || [];
  const existing = f.attendance.find(a => a.date === ds && a.hour === hour);
  if (existing) {
    existing.status = status;
    existing.reason = reason;
    delete existing.present; // Удаляем старый формат
    existing.blockId = blockId || existing.blockId;
    existing.mode = mode || existing.mode;
  } else {
    f.attendance.push({
      date: ds,
      hour,
      blockId: blockId || '',
      mode: mode || '',
      status,
      reason
    });
  }
  saveData(DB);
}

function getAttendanceStats(fighter) {
  const list = fighter.attendance || [];
  let present = 0, absent = 0, cancelled = 0;
  
  list.forEach(a => {
    // Если старый формат
    if (typeof a.present === 'boolean') {
      if (a.present) present++; else absent++;
    } else {
      if (a.status === 'present') present++;
      else if (a.status === 'absent') absent++;
      else if (a.status === 'cancelled') cancelled++;
    }
  });
  
  const total = present + absent;
  const percent = total ? Math.round(present / total * 100) : 0;
  return { total, present, absent, cancelled, percent };
}

function getAttendanceStatsMonth(fighter, year, month) {
  const list = (fighter.attendance || []).filter(a => {
    const d = new Date(a.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  
  let present = 0, absent = 0, cancelled = 0;
  list.forEach(a => {
    if (typeof a.present === 'boolean') {
      if (a.present) present++; else absent++;
    } else {
      if (a.status === 'present') present++;
      else if (a.status === 'absent') absent++;
      else if (a.status === 'cancelled') cancelled++;
    }
  });
  
  const total = present + absent;
  const percent = total ? Math.round(present / total * 100) : 0;
  return { total, present, absent, cancelled, percent };
}

function formatSessionText(session) {
  const date = formatDateRu(session.date);
  const time = String(session.hour).padStart(2, '0') + ':00';
  const groupTitle = session.mode === 'group' ? groupName(session.group) : (session.fighters[0] ? session.fighters[0].name : '');

  const present = [];
  const absent = [];
  const cancelled = [];
  const unknown = [];

  session.fighters.forEach(f => {
    const guestMark = f.isGuest ? ' [+]' : '';
    if (f.status === 'present') present.push(f.name + guestMark);
    else if (f.status === 'absent') absent.push(f.name + guestMark);
    else if (f.status === 'cancelled') cancelled.push(f.name + guestMark);
    else unknown.push(f.name + guestMark + ' (?)');
  });

  const lines = [];
  lines.push(`Тренировка ${date}, ${time}`);
  if (session.mode === 'group') lines.push(`Группа: ${groupName(session.group)}`);
  if (session.blockId) lines.push(`Упражнение: ${exerciseName(session.blockId)}`);
  lines.push('');

  if (present.length) {
    lines.push(`Присутствовали (${present.length}):`);
    present.forEach((n, i) => lines.push(`${i+1}. ${n}`));
    lines.push('');
  }
  if (absent.length || unknown.length) {
    const allAbs = [...absent, ...unknown];
    lines.push(`Отсутствовали (${allAbs.length}):`);
    allAbs.forEach((n, i) => lines.push(`${i+1}. ${n}`));
    lines.push('');
  }
  if (cancelled.length) {
    lines.push(`Отменено (${cancelled.length}):`);
    cancelled.forEach((n, i) => lines.push(`${i+1}. ${n}`));
    lines.push('');
  }

  lines.push(`Тренер: ${DB.settings.coachName || '—'}`);
  return lines.join('\n');
}

function formatDayText(ds) {
  const sessions = getTrainingSessions(ds);
  if (!sessions.length) return 'На эту дату тренировок нет.';
  return sessions.map(s => formatSessionText(s)).join('\n\n────────────\n\n');
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
    hour, blockId: hostBlockId || '', mode: hostMode || 'group',
    comment, guest: true, hostGroup: hostGroupKey
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
  if (f.attendance) f.attendance = f.attendance.filter(a => !(a.date === ds && a.hour === hour));
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