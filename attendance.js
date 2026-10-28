/* ============================================================
   ATTENDANCE.JS — раздел «Отметка тренировки»
   ============================================================ */

const Attendance = (() => {
  let viewDate = todayStr();

  function shiftDate(delta) {
    const d = new Date(viewDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    viewDate = dateStr(d);
  }

  function setToday() {
    viewDate = todayStr();
  }

  function setDate(ds) {
    if (ds) { viewDate = ds; render(); }
  }

  function render() {
    const sessions = getTrainingSessions(viewDate);
    const dateObj = new Date(viewDate + 'T00:00:00');

    let totalFighters = 0;
    let totalPresent = 0;
    sessions.forEach(s => {
      s.fighters.forEach(f => {
        const fighter = DB.fighters.find(x => x.id === f.id);
        if (!fighter) return;
        totalFighters++;
        const st = isAttended(fighter, s.date, s.hour);
        if (st === true) totalPresent++;
      });
    });

    const dateLabel = dateObj.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    app.innerHTML = `
      <h2>Отметка</h2>
      <div class="att-toolbar">
        <b style="text-transform: capitalize;">${dateLabel}</b>
        <button class="ghost small" onclick="Attendance.shiftDate(-1);render()">‹ Вчера</button>
        <button class="ghost small" onclick="Attendance.setToday();render()">Сегодня</button>
        <button class="ghost small" onclick="Attendance.shiftDate(1);render()">Завтра ›</button>
        <input type="date" value="${viewDate}" onchange="Attendance.setDate(this.value)">
      </div>

      ${!sessions.length
        ? `<div class="card"><p style="color:#666;font-size:14px;margin:0;text-align:center;padding:20px;">
             На эту дату тренировок нет.
           </p></div>`
        : `
          <div class="card" style="background:#f0fdf4;border-left:4px solid #22c55e; padding:12px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-size:15px;">Присутствуют:</b>
              <span style="font-size:16px;"><b>${totalPresent}</b> из ${totalFighters}</span>
            </div>
            ${sessions.length ? `
              <div style="display:flex; gap:8px; margin-top:12px;">
                <button class="success small" style="flex:1;" onclick="Attendance.copyDay()">📋 Копировать</button>
                <button class="small" style="flex:1;" onclick="Attendance.shareDay()">📤 Отправить</button>
              </div>
            ` : ''}
          </div>
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

    let present = 0;
    let guestsCount = 0;
    session.fighters.forEach(f => {
      const fighter = DB.fighters.find(x => x.id === f.id);
      if (!fighter) return;
      if (isAttended(fighter, session.date, session.hour) === true) present++;
      if (f.isGuest) guestsCount++;
    });
    const total = session.fighters.length;
    const allMarked = session.fighters.every(f => {
      const fighter = DB.fighters.find(x => x.id === f.id);
      return fighter && isAttended(fighter, session.date, session.hour) !== null;
    });

    const title = session.mode === 'group'
      ? groupName(session.group)
      : (session.fighters[0]?.name || 'Индивидуально');

    const checklistHtml = session.fighters.map(f => {
      const fighter = DB.fighters.find(x => x.id === f.id);
      if (!fighter) return '';
      const st = isAttended(fighter, session.date, session.hour);
      const checked = st === true ? 'checked' : '';
      const cls = st === true ? 'checked' : '';
      const guestClass = f.isGuest ? 'guest' : '';
      const guestBadge = f.isGuest ? '<span class="att-guest-badge">➕ Внепл.</span>' : '';
      const removeBtn = f.isGuest
        ? `<button class="small danger" style="margin-left:8px; padding:4px 8px;"
                   onclick="event.preventDefault();event.stopPropagation();Attendance.removeGuest('${f.id}',${session.hour})"
                   title="Убрать">✕</button>`
        : '';
      return `
        <label class="att-check-item ${cls} ${guestClass}">
          <input type="checkbox" ${checked}
                 onchange="Attendance.toggle('${f.id}', ${session.hour}, this.checked)">
          <span class="att-name">${f.name}${guestBadge}</span>
          ${removeBtn}
        </label>
      `;
    }).join('');

    return `
      <div class="att-card ${allMarked ? 'done' : ''}">
        <div class="att-card-header">
          <div>
            <h3>${title}</h3>
            <span class="att-time">${time} • ${exName}${guestsCount ? ` • внепл.: ${guestsCount}` : ''}</span>
          </div>
          <span class="att-badge">${allMarked ? '✅' : '⚠️'}</span>
        </div>
        
        <div class="att-summary">
          <span>Присутствуют:</span>
          <span><b>${present}</b> из <b>${total}</b></span>
        </div>
        
        <div class="att-checklist">
          ${checklistHtml}
        </div>
        
        <div class="att-actions">
          <button class="success small" onclick="Attendance.markAll('${session.key}', true)">✓ Всех</button>
          <button class="ghost small" onclick="Attendance.markAll('${session.key}', false)">✗ Никого</button>
          <button class="small" onclick="Attendance.openAddGuest('${session.key}')">➕ Добавить</button>
          <button class="small" onclick="Attendance.copySession('${session.key}')">📋 Копировать</button>
        </div>
      </div>
    `;
  }

  /* ================== ВНЕПЛАНОВЫЕ ================== */

  function openAddGuest(sessionKey) {
    const session = findSessionByKey(sessionKey);
    if (!session) return;

    const presentIds = session.fighters.map(f => f.id);
    const candidates = getFightersNotInSession(session.date, session.hour, presentIds);

    if (!candidates.length) {
      toast('Нет доступных бойцов для добавления', 'error');
      return;
    }

    const byGroup = {};
    candidates.forEach(f => {
      if (!byGroup[f.group]) byGroup[f.group] = [];
      byGroup[f.group].push(f);
    });

    const groupsHtml = FIGHTER_GROUPS.map(g => {
      const list = byGroup[g.key] || [];
      if (!list.length) return '';
      return `
        <div class="guest-group">
          <div class="guest-group-title">${g.name}</div>
          ${list.map(f => `
            <label class="guest-item">
              <input type="checkbox" class="guest-check" value="${f.id}">
              <span>${f.name}</span>
            </label>
          `).join('')}
        </div>
      `;
    }).join('');

    const hostTitle = session.mode === 'group'
      ? groupName(session.group)
      : (session.fighters[0]?.name || 'Индивидуально');
    const hostTime = String(session.hour).padStart(2,'0') + ':00';

    Modal.open(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>Добавить бойца</h3>
        <p style="font-size:13px;color:#666;margin:4px 0 10px;">
          Тренировка: <b>${hostTitle}</b>, ${hostTime}, ${formatDateRu(session.date)}
        </p>
        <div class="guest-list">${groupsHtml}</div>
        <div class="modal-actions">
          <button class="secondary" onclick="Modal.close()">Отмена</button>
          <button class="primary" onclick="Attendance.submitAddGuest('${session.key}')">Добавить</button>
        </div>
      </div>
    `);
  }

  function submitAddGuest(sessionKey) {
    const session = findSessionByKey(sessionKey);
    if (!session) return;

    const checks = [...document.querySelectorAll('.guest-check:checked')];
    if (!checks.length) {
      toast('Выберите хотя бы одного бойца', 'error');
      return;
    }

    let added = 0;
    checks.forEach(cb => {
      const ok = addGuestToTraining(
        cb.value,
        session.date,
        session.hour,
        session.group,
        session.blockId,
        session.mode
      );
      if (ok) added++;
    });

    Modal.close();
    toast(added === 1 ? 'Добавлен 1 боец' : `Добавлено: ${added}`, 'ok');
    render();
  }

  function removeGuest(fighterId, hour) {
    if (!confirm('Убрать этого бойца из тренировки?')) return;
    const ok = removeGuestFromTraining(fighterId, viewDate, hour);
    if (ok) {
      toast('Внеплановый боец убран', 'ok');
      render();
    } else {
      toast('Не удалось убрать бойца', 'error');
    }
  }

  /* ================== ВСПОМОГАТЕЛЬНЫЕ ================== */

  function findSessionByKey(key) {
    return getTrainingSessions(viewDate).find(s => s.key === key);
  }

  function toggle(fighterId, hour, present) {
    const fighter = DB.fighters.find(x => x.id === fighterId);
    if (!fighter) return;
    const slot = (fighter.calendar[viewDate] || []).find(s => s.hour === hour);
    setAttendance(
      fighterId, viewDate, hour,
      slot ? slot.blockId : '',
      slot ? slot.mode : '',
      present
    );
    render();
  }

  function markAll(sessionKey, present) {
    const session = findSessionByKey(sessionKey);
    if (!session) return;
    session.fighters.forEach(f => {
      const fighter = DB.fighters.find(x => x.id === f.id);
      if (!fighter) return;
      setAttendance(
        f.id, session.date, session.hour,
        session.blockId, session.mode,
        present
      );
    });
    toast(present ? 'Все отмечены' : 'Все сняты', 'ok');
    render();
  }

  function copySession(sessionKey) {
    const session = findSessionByKey(sessionKey);
    if (!session) return;
    const text = formatSessionText(session);
    copyToClipboard(text);
  }

  function shareSession(sessionKey) {
    const session = findSessionByKey(sessionKey);
    if (!session) return;
    const text = formatSessionText(session);
    shareText(text);
  }

  function copyDay() {
    const text = formatDayText(viewDate);
    copyToClipboard(text);
  }

  function shareDay() {
    const text = formatDayText(viewDate);
    shareText(text);
  }

  /* ================== БУФЕР ОБМЕНА ================== */

  function copyToClipboard(text, silent) {
    const onSuccess = () => {
      if (!silent) toast('Список скопирован в буфер', 'ok');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(onSuccess)
        .catch(() => fallbackCopy(text, silent));
    } else {
      fallbackCopy(text, silent);
    }
  }

  function fallbackCopy(text, silent) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (!silent) toast('Список скопирован', 'ok');
    } catch (e) {
      if (!silent) toast('Не удалось скопировать', 'error');
    }
    document.body.removeChild(ta);
  }

  /* ================== ОТПРАВКА С УЧЁТОМ ОФЛАЙНА ================== */

  function shareText(text) {
    if (!navigator.onLine) {
      copyToClipboard(text, true);
      setTimeout(() => {
        alert('📴 Нет интернета.\n\nТекст списка скопирован в буфер обмена.\n\nОткройте мессенджер, вставьте текст и отправьте.');
      }, 100);
      return;
    }

    if (navigator.share) {
      navigator.share({ text })
        .then(() => toast('Отправлено', 'ok'))
        .catch(() => {});
    } else {
      copyToClipboard(text);
      setTimeout(() => {
        if (confirm('Текст скопирован. Открыть Telegram для вставки?')) {
          window.open('https://t.me/share/url?url=' + encodeURIComponent(text), '_blank');
        }
      }, 200);
    }
  }

  return {
    render, shiftDate, setToday, setDate,
    toggle, markAll, copySession, shareSession, copyDay, shareDay,
    openAddGuest, submitAddGuest, removeGuest
  };
})();
window.Attendance = Attendance;