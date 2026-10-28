/* ============================================================
   ATTENDANCE.JS — раздел «Отметка тренировки»
   ============================================================ */

const Attendance = (() => {
  // Принудительно ставим сегодняшнюю дату при каждом вызове
  let viewDate = todayStr();

  function shiftDate(delta) {
    const d = new Date(viewDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    viewDate = dateStr(d);
    render();
  }
  
  function setToday() { 
    viewDate = todayStr(); 
    render(); 
  }
  
  function setDate(ds) { 
    if (ds) { viewDate = ds; render(); } 
  }

  function render() {
    // Жестко ставим сегодняшнюю дату, если она пустая или старая
    if (!viewDate || viewDate === 'undefined') viewDate = todayStr();

    const sessions = getTrainingSessions(viewDate);
    const dateObj = new Date(viewDate + 'T00:00:00');

    const dateLabel = dateObj.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    app.innerHTML = `
      <h2>Отметка</h2>
      <div class="att-toolbar">
        <b style="text-transform: capitalize;">${dateLabel}</b>
        <div style="display:flex; gap:6px; width:100%;">
          <button class="ghost small" style="flex:1;" onclick="Attendance.shiftDate(-1)">‹ Вчера</button>
          <button class="ghost small" style="flex:1;" onclick="Attendance.setToday()">Сегодня</button>
          <button class="ghost small" style="flex:1;" onclick="Attendance.shiftDate(1)">Завтра ›</button>
        </div>
        <input type="date" value="${viewDate}" onchange="Attendance.setDate(this.value)" style="margin-top:8px;">
      </div>

      ${!sessions.length
        ? `<div class="card" style="text-align:center; padding:30px 20px;">
             <div style="font-size:40px; margin-bottom:10px;">📅</div>
             <h3 style="color:#666;">На эту дату назначенных тренировок нет</h3>
             <p style="color:#999; font-size:14px; margin-top:8px;">Вы можете назначить их в календаре на главной странице.</p>
           </div>`
        : `
          <div class="att-list">
            ${sessions.map(s => renderSession(s)).join('')}
          </div>
        `
      }
    `;
  }

  function renderSession(session) {
    const time = String(session.hour).padStart(2, '0') + ':00';
    const exName = session.blockId ? exerciseName(session.blockId) : 'Без упражнения';

    let present = 0, absent = 0, cancelled = 0;
    session.fighters.forEach(f => {
      if (f.status === 'present') present++;
      else if (f.status === 'absent') absent++;
      else if (f.status === 'cancelled') cancelled++;
    });

    const total = session.fighters.length;
    const allMarked = session.fighters.every(f => f.status !== null);
    const title = session.mode === 'group' ? groupName(session.group) : (session.fighters[0]?.name || 'Индивидуально');

    // Дополнительная кнопка для индивидуальных тренировок
    const isPersonal = session.mode === 'personal';
    const doneBtn = isPersonal && !allMarked
      ? `<button class="success small" style="width:100%; margin-bottom:8px;" onclick="Attendance.markAll('${session.key}', 'present')">✓ Проведена (Отметить всех)</button>`
      : '';
      
    const cancelBtn = isPersonal && !allMarked
      ? `<button class="ghost small" style="width:100%;" onclick="Attendance.markAll('${session.key}', 'cancelled')">🚫 Не проведена (указать причину)</button>`
      : '';

    return `
      <details class="att-card ${allMarked ? 'done' : ''}">
        <summary class="att-card-header">
          <div>
            <h3>${title}</h3>
            <span class="att-time">${time} • ${exName}</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span class="att-badge">${allMarked ? '✅' : '⚠️'}</span>
            <div style="font-size:11px; color:#666;">${present} / ${total}</div>
          </div>
        </summary>
        
        <div class="att-summary" style="margin-top:10px;">
          <span>Присутствуют: <b>${present}</b></span>
          <span>Отсутствуют: <b>${absent}</b></span>
          ${cancelled ? `<span>Отменено: <b>${cancelled}</b></span>` : ''}
        </div>
        
        <div class="att-checklist">
          ${session.fighters.map(f => {
            const checked = f.status === 'present' ? 'checked' : '';
            const cls = f.status === 'present' ? 'checked' : '';
            const guestClass = f.isGuest ? 'guest' : '';
            const guestBadge = f.isGuest ? '<span class="att-guest-badge">➕ Внепл.</span>' : '';
            const removeBtn = f.isGuest
              ? `<button class="small danger" style="margin-left:8px; padding:4px 8px;" onclick="event.preventDefault();event.stopPropagation();Attendance.removeGuest('${f.id}',${session.hour})">✕</button>`
              : '';
              
            const cancelHtml = f.status === 'cancelled' 
              ? `<span style="display:block; font-size:11px; color:#e63946; margin-top:2px;">Причина: ${f.reason || 'Не указана'}</span>` 
              : '';

            return `
              <label class="att-check-item ${cls} ${guestClass}">
                <input type="checkbox" ${checked} onchange="Attendance.toggle('${f.id}', ${session.hour}, this.checked)">
                <span class="att-name">${f.name}${guestBadge}${cancelHtml}</span>
                ${removeBtn}
              </label>
            `;
          }).join('')}
        </div>
        
        <div class="att-actions" style="flex-direction: column;">
          ${doneBtn}
          ${cancelBtn}
          <div style="display:flex; gap:8px; width:100%;">
            ${isPersonal ? '' : `<button class="success small" style="flex:1;" onclick="Attendance.markAll('${session.key}', 'present')">✓ Всех</button>`}
            ${isPersonal ? '' : `<button class="ghost small" style="flex:1;" onclick="Attendance.markAll('${session.key}', 'absent')">✗ Никого</button>`}
            <button class="small" style="flex:1;" onclick="Attendance.openAddGuest('${session.key}')">➕ Добавить</button>
          </div>
        </div>
      </details>
    `;
  }

  function openAddGuest(sessionKey) {
    const session = getTrainingSessions(viewDate).find(s => s.key === sessionKey);
    if (!session) return;
    const presentIds = session.fighters.map(f => f.id);
    const candidates = getFightersNotInSession(session.date, session.hour, presentIds);

    if (!candidates.length) { toast('Нет доступных бойцов', 'error'); return; }

    const byGroup = {};
    candidates.forEach(f => { if (!byGroup[f.group]) byGroup[f.group] = []; byGroup[f.group].push(f); });

    const groupsHtml = getFighterGroups().map(g => {
      const list = byGroup[g.key] || [];
      if (!list.length) return '';
      return `
        <div class="guest-group">
          <div class="guest-group-title">${g.name}</div>
          ${list.map(f => `<label class="guest-item"><input type="checkbox" class="guest-check" value="${f.id}"><span>${f.name}</span></label>`).join('')}
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>Добавить бойца</h3>
        <div class="guest-list">${groupsHtml}</div>
        <div class="modal-actions">
          <button class="secondary" onclick="Modal.close()">Отмена</button>
          <button class="primary" onclick="Attendance.submitAddGuest('${session.key}')">Добавить</button>
        </div>
      </div>
    `);
  }

  function submitAddGuest(sessionKey) {
    const session = getTrainingSessions(viewDate).find(s => s.key === sessionKey);
    if (!session) return;
    const checks = [...document.querySelectorAll('.guest-check:checked')];
    if (!checks.length) { toast('Выберите бойцов', 'error'); return; }

    let added = 0;
    checks.forEach(cb => {
      const ok = addGuestToTraining(cb.value, session.date, session.hour, session.group, session.blockId, session.mode);
      if (ok) added++;
    });
    Modal.close(); toast(`Добавлено: ${added}`, 'ok'); render();
  }

  function removeGuest(fighterId, hour) {
    if (!confirm('Убрать бойца?')) return;
    removeGuestFromTraining(fighterId, viewDate, hour);
    render();
  }

  function toggle(fighterId, hour, present) {
    const fighter = DB.fighters.find(x => x.id === fighterId);
    if (!fighter) return;
    const slot = (fighter.calendar[viewDate] || []).find(s => s.hour === hour);
    const status = present ? 'present' : 'absent';
    setAttendance(fighterId, viewDate, hour, slot ? slot.blockId : '', slot ? slot.mode : '', status);
    render();
  }

  function markAll(sessionKey, status) {
    const session = getTrainingSessions(viewDate).find(s => s.key === sessionKey);
    if (!session) return;

    let reason = '';
    if (status === 'cancelled') {
      reason = prompt('Укажите причину отмены (например, болезнь):') || 'Без причины';
      if (reason === null) return;
    }

    session.fighters.forEach(f => {
      setAttendance(f.id, session.date, session.hour, session.blockId, session.mode, status, reason);
    });
    toast(status === 'cancelled' ? 'Отменено' : 'Статус обновлен', 'ok');
    render();
  }

  function copySession(sessionKey) {
    const session = getTrainingSessions(viewDate).find(s => s.key === sessionKey);
    if (session) copyToClipboard(formatSessionText(session));
  }
  function copyDay() { copyToClipboard(formatDayText(viewDate)); }

  function copyToClipboard(text, silent) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { if (!silent) toast('Скопировано', 'ok'); });
    } else {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); if (!silent) toast('Скопировано', 'ok');
    }
  }

  return {
    render, shiftDate, setToday, setDate, toggle, markAll, copySession, copyDay,
    openAddGuest, submitAddGuest, removeGuest
  };
})();
window.Attendance = Attendance;