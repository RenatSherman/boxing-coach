/* ============================================================
   ATTENDANCE.JS — раздел «Отметка тренировки»
   Чек-лист посещений + экспорт
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
    try {
      const sessions = getTrainingSessions(viewDate);
      const dateObj = new Date(viewDate + 'T00:00:00');

      // Статистика по дню
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

      // Пустая база бойцов
      const noFighters = !DB.fighters.length;

      app.innerHTML = `
        <h2>Отметка тренировки</h2>
        <div class="att-toolbar">
          <button onclick="Attendance.shiftDate(-1);Attendance.render()">‹</button>
          <b style="min-width: 260px; text-align: center; text-transform: capitalize;">${dateLabel}</b>
          <button onclick="Attendance.shiftDate(1);Attendance.render()">›</button>
          <button class="ghost" onclick="Attendance.setToday();Attendance.render()">Сегодня</button>
          <label style="margin-left: 10px;">
            <input type="date" value="${viewDate}" onchange="Attendance.setDate(this.value)">
          </label>
          ${sessions.length ? `
            <button class="success" style="margin-left: auto;" onclick="Attendance.copyDay()">📋 Скопировать весь день</button>
            <button onclick="Attendance.shareDay()">📤 Отправить день</button>
          ` : ''}
        </div>

        ${noFighters ? `
          <div class="card">
            <p style="color:#666;font-size:14px;margin:0;">
              В базе пока нет бойцов. Добавьте первого в разделе «Бойцы».
            </p>
          </div>
        ` : (!sessions.length ? `
          <div class="card" style="border-left:4px solid #cbd5e1;">
            <h3 style="margin-top:0;">На эту дату активных тренировок нет</h3>
            <p style="color:#666;font-size:14px;margin:0 0 10px;">
              Тренировки назначаются в разделе «Дашборд» (календарь тренера) или в карточке бойца.
            </p>
            <button onclick="state.tab='dashboard';document.querySelectorAll('#mainNav button').forEach(x=>x.classList.toggle('active',x.dataset.tab==='dashboard'));render()">
              Открыть календарь тренера
            </button>
          </div>
        ` : `
          <div class="card" style="background:#f0fdf4;border-left:4px solid #22c55e;">
            <b>Присутствуют: ${totalPresent} из ${totalFighters}</b>
            <span style="color:#666;margin-left:10px;font-size:13px;">
              (${sessions.length} тренировк${sessions.length===1?'а':'и'})
            </span>
          </div>
          <div class="att-list">
            ${sessions.map(s => renderSession(s)).join('')}
          </div>
        `)}
      `;
    } catch (e) {
      console.error('[Attendance] Ошибка рендера:', e);
      app.innerHTML = `
        <h2>Отметка тренировки</h2>
        <div class="card" style="border-left:4px solid #dc2626;background:#fef2f2;">
          <h3 style="margin-top:0;">Ошибка в разделе «Отметка»</h3>
          <p style="color:#991b1b;font-size:14px;">
            ${e.message || 'Неизвестная ошибка'}
          </p>
          <pre style="background:#fff;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">${(e.stack || '').split('\n').slice(0,5).join('\n')}</pre>
        </div>
      `;
    }
  }

  function renderSession(session) {
    const time = String(session.hour).padStart(2, '0') + ':00';
    const exName = session.blockId ? exerciseName(session.blockId) : 'Без упражнения';

    let present = 0;
    session.fighters.forEach(f => {
      const fighter = DB.fighters.find(x => x.id === f.id);
      if (!fighter) return;
      if (isAttended(fighter, session.date, session.hour) === true) present++;
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
      return `
        <label class="att-check-item ${cls}">
          <input type="checkbox" ${checked}
                 onchange="Attendance.toggle('${f.id}', ${session.hour}, this.checked)">
          <span class="att-name">${f.name}</span>
          <span class="att-group">${groupShort(f.group)}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="att-card ${allMarked ? 'done' : ''}">
        <div class="att-card-header">
          <div>
            <h3>${title}</h3>
            <span class="att-time">${time} • ${exName}</span>
          </div>
          <span class="att-badge">${allMarked ? '✅ Отмечено' : '⚠️ Не отмечено'}</span>
        </div>
        <div class="att-summary">
          Присутствуют: <b>${present}</b> из <b>${total}</b>
        </div>
        <div class="att-checklist">
          ${checklistHtml}
        </div>
        <div class="att-actions">
          <button class="success small" onclick="Attendance.markAll('${session.key}', true)">✓ Отметить всех</button>
          <button class="ghost small" onclick="Attendance.markAll('${session.key}', false)">✗ Никого</button>
          <button class="small" onclick="Attendance.copySession('${session.key}')">📋 Скопировать список</button>
          <button class="small" onclick="Attendance.shareSession('${session.key}')">📤 Отправить</button>
        </div>
      </div>
    `;
  }

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

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast('Список скопирован в буфер', 'ok'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('Список скопирован', 'ok');
    } catch (e) {
      toast('Не удалось скопировать', 'error');
    }
    document.body.removeChild(ta);
  }

  function shareText(text) {
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

  return { render, shiftDate, setToday, setDate, toggle, markAll,
           copySession, shareSession, copyDay, shareDay };
})();
window.Attendance = Attendance;