/* ============================================================
   CALENDAR.JS — календарь бойца (месяц), календарь тренера (неделя)
   ============================================================ */

/* ================== КАЛЕНДАРЬ БОЙЦА (МЕСЯЦ) ================== */
const Calendar = (() => {
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();

  function monthLabel() {
    const m = ['Январь','Февраль','Март','Апрель','Май','Июнь',
               'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return `${m[viewMonth]} ${viewYear}`;
  }
  function shift(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  }
  function today() {
    const n = new Date();
    viewYear = n.getFullYear(); viewMonth = n.getMonth();
  }

  function render(fighterId) {
    const f = DB.fighters.find(x => x.id === fighterId);
    if (!f) return '';
    const first = new Date(viewYear, viewMonth, 1);
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDay = (first.getDay() + 6) % 7;
    let html = `
      <div class="cal-toolbar">
        <button onclick="Calendar.shift(-1);renderFighterDetail()">‹</button>
        <b>${monthLabel()}</b>
        <button onclick="Calendar.shift(1);renderFighterDetail()">›</button>
        <button onclick="Calendar.today();renderFighterDetail()">Сегодня</button>
        <button onclick="Calendar.clearAll('${f.id}')">Очистить месяц</button>
      </div>
      <div class="calendar">`;
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => html += `<div class="cal-head">${d}</div>`);
    for (let i = 0; i < startDay; i++) html += `<div class="cal-empty"></div>`;
    const t = todayStr();
    for (let d = 1; d <= days; d++) {
      const ds = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const slots = (f.calendar[ds] || []).slice().sort((a,b)=>a.hour-b.hour);
      const isToday = ds === t;
      html += `<div class="cal-day ${isToday?'today':''}">
        <b>${d}</b>
        <div class="slots">
          ${slots.map((s,i) => {
            const label = trainingDisplayName(s, f);
            return `
              <div class="slot ${s.mode}" title="${s.comment ? s.comment : ''}">
                <b>${String(s.hour).padStart(2,'0')}:00</b> — ${label}
                ${s.comment ? `<small>💬 ${s.comment}</small>` : ''}
                <button class="small danger" style="float:right;padding:0 4px;margin-left:4px"
                        onclick="event.stopPropagation();deleteTraining('${f.id}','${ds}',${i})">✕</button>
              </div>`;
          }).join('')}
        </div>
        <button class="slot-add" onclick="openAssignTrainingModal('${f.id}','${ds}',null)">+</button>
      </div>`;
    }
    html += `</div>`;
    html += `<div class="legend">
      <span><i style="background:#FEF3C7;border-left:3px solid #F59E0B"></i>Самостоятельно</span>
      <span><i style="background:#FCE7F3;border-left:3px solid #EC4899"></i>Индивидуально</span>
      <span><i style="background:#DBEAFE;border-left:3px solid #3B82F6"></i>Группа</span>
    </div>`;
    return html;
  }

  function clearAll(fighterId) {
    if (!confirm('Очистить весь месяц?')) return;
    const f = DB.fighters.find(x => x.id === fighterId);
    Object.keys(f.calendar).forEach(k => {
      const dt = new Date(k);
      if (dt.getFullYear() === viewYear && dt.getMonth() === viewMonth) delete f.calendar[k];
    });
    saveData(DB); renderFighterDetail();
  }

  function upcoming(daysAhead = 1) {
    const now = new Date();
    const out = [];
    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()+i);
      const key = dateStr(d);
      DB.fighters.forEach(f => {
        (f.calendar[key]||[]).forEach(s => out.push({
          when: new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.hour),
          fighter: f.name, block: exerciseName(s.blockId), hour: s.hour, mode: s.mode
        }));
      });
    }
    return out.sort((a,b)=>a.when-b.when);
  }

  function notifyUpcoming() {
    if (!('Notification' in window)) return;
    if (!DB.settings.notifications) return;
    if (Notification.permission !== 'granted') return;
    const list = upcoming(1).filter(x => {
      const diff = x.when - Date.now();
      return diff > 0 && diff < 3600*1000;
    });
    list.forEach(x => {
      new Notification('🥊 Тренировка скоро', {
        body: `${x.fighter} — ${x.block} в ${String(x.hour).padStart(2,'0')}:00`
      });
    });
  }

  function requestPerm() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  return { render, shift, today, clearAll, upcoming, notifyUpcoming, requestPerm };
})();

setInterval(() => Calendar.notifyUpcoming(), 5 * 60 * 1000);

/* ================== КАЛЕНДАРЬ ТРЕНЕРА (НЕДЕЛЯ) ================== */
const CoachCalendar = (() => {
  let start = (() => {
    const n = new Date();
    const day = (n.getDay() + 6) % 7;
    const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - day);
    s.setHours(0,0,0,0);
    return s;
  })();

  function shiftWeek(delta) {
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta*7);
  }
  function thisWeek() {
    const n = new Date();
    const day = (n.getDay() + 6) % 7;
    start = new Date(n.getFullYear(), n.getMonth(), n.getDate() - day);
    start.setHours(0,0,0,0);
  }
  function weekLabel() {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    return `${fmt(start)} — ${fmt(end)}.${end.getFullYear()}`;
  }

  function render() {
    const hours = Array.from({length: 17}, (_,i)=>i+6);
    const days = Array.from({length: 7}, (_,i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, ds: dateStr(d) };
    });
    const t = todayStr();
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

    let html = `
      <div class="cal-toolbar">
        <button onclick="CoachCalendar.shiftWeek(-1);renderDashboard()">‹</button>
        <b>${weekLabel()}</b>
        <button onclick="CoachCalendar.shiftWeek(1);renderDashboard()">›</button>
        <button onclick="CoachCalendar.thisWeek();renderDashboard()">Текущая неделя</button>
        <button onclick="openAssignTrainingModal(null, null, null)">+ Назначить тренировку</button>
      </div>
      <div class="legend">
        <span><i style="background:#FEF3C7;border-left:3px solid #F59E0B"></i>Самостоятельно</span>
        <span><i style="background:#FCE7F3;border-left:3px solid #EC4899"></i>Индивидуально</span>
        <span><i style="background:#DBEAFE;border-left:3px solid #3B82F6"></i>Группа</span>
      </div>
      <div class="coach-cal-wrap">
        <div class="coach-cal">
          <div class="corner"></div>
          ${days.map((d,i) => `
            <div class="day-head ${d.ds===t?'today':''}">
              ${dayNames[i]}<br><small>${String(d.date.getDate()).padStart(2,'0')}.${String(d.date.getMonth()+1).padStart(2,'0')}</small>
            </div>`).join('')}
    `;

    hours.forEach(h => {
      html += `<div class="hour">${String(h).padStart(2,'0')}:00</div>`;
      days.forEach(d => {
        const events = [];
        DB.fighters.forEach(f => {
          (f.calendar[d.ds] || []).forEach((s, idx) => {
            if (s.hour === h) events.push({ f, s, idx });
          });
        });

        // Агрегируем события (по бойцу или по группе)
        const aggregated = aggregateSlotEvents(events);

        html += `<div class="cell" onclick="openAssignTrainingModal(null,'${d.ds}',${h})">`;
        aggregated.forEach(agg => {
          // Формируем список событий для тултипа
          const tooltip = agg.events.map(ev => {
            const exName = ev.s.blockId ? exerciseName(ev.s.blockId) : 'без упражнения';
            return `${ev.f.name} — ${exName}`;
          }).join('\n');

          // Определяем класс формата (берём из первого события агрегата)
          const modeClass = agg.mode === 'group' && agg.count > 1
            ? 'group' // групповой формат отображения
            : agg.events[0].s.mode;

          html += `<div class="ev ${modeClass}"
                        title="${tooltip}"
                        onclick="event.stopPropagation();openAggregatedTraining('${d.ds}',${h})">
            <b>${agg.label}</b>
          </div>`;
        });
        html += `</div>`;
      });
    });

    html += `</div></div>`;
    return html;
  }

  return { render, shiftWeek, thisWeek };
})();

/* ================== ДЕЙСТВИЯ: КЛИК ПО АГРЕГИРОВАННОЙ ТРЕНИРОВКЕ ==================
   Показывает список всех бойцов и их тренировок в этом слоте.
*/
window.openAggregatedTraining = (dateStr, hour) => {
  // Собираем все события в этом слоте
  const events = [];
  DB.fighters.forEach(f => {
    (f.calendar[dateStr] || []).forEach((s, idx) => {
      if (s.hour === hour) events.push({ f, s, idx });
    });
  });
  if (!events.length) return;

  // Группируем по группам для удобства
  const byGroup = {};
  events.forEach(ev => {
    const key = ev.f.group;
    if (!byGroup[key]) byGroup[key] = [];
    byGroup[key].push(ev);
  });

  const groupsHtml = Object.keys(byGroup).map(gKey => `
    <div style="margin: 10px 0;">
      <div style="font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px;">
        ${groupName(gKey)}
      </div>
      ${byGroup[gKey].map(ev => {
        const exName = ev.s.blockId ? exerciseName(ev.s.blockId) : 'Без упражнения';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;">
            <div>
              <b>${ev.f.name}</b><br>
              <small style="color:#666;">${exName} • ${modeLabel(ev.s.mode)}</small>
              ${ev.s.comment ? `<br><small style="color:#888;">💬 ${ev.s.comment}</small>` : ''}
            </div>
            <button class="small danger" onclick="deleteTrainingFromAggregated('${ev.f.id}','${dateStr}',${ev.idx})">✕</button>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');

  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Тренировки ${formatDateRu(dateStr)}, ${String(hour).padStart(2,'0')}:00</h3>
      ${groupsHtml}
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Закрыть</button>
      </div>
    </div>
  `);
};

window.deleteTrainingFromAggregated = (fighterId, dateStr, idx) => {
  deleteTraining(fighterId, dateStr, idx);
  Modal.close();
  renderDashboard();
};