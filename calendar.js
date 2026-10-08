/* ============================================================
   CALENDAR.JS — календарь бойца (месяц), календарь тренера (день+неделя)
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

/* ================== КАЛЕНДАРЬ ТРЕНЕРА (НОВАЯ ВЕРСИЯ) ==================
   Особенности:
   - Лента дней сверху — горизонтальный скролл, дни всегда видны.
   - Часы слева — вертикальный скролл. Время не уезжает.
   - Клик по часу → назначаем тренировку.
   - Клик по событию → окно с деталями.
   - Выбранный день хранится в ГЛОБАЛЬНОЙ переменной, чтобы
     сохраняться между перерисовками дашборда.
*/

/* Глобальное состояние календаря тренера — живёт вне функции,
   чтобы клик по дню не сбрасывал его при перерисовке. */
let __coachCalState = {
  weekStart: (() => {
    const n = new Date();
    const day = (n.getDay() + 6) % 7;
    const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - day);
    s.setHours(0,0,0,0);
    return s;
  })(),
  selectedDayIndex: (() => {
    const n = new Date();
    return (n.getDay() + 6) % 7;
  })()
};

const CoachCalendar = (() => {
  const START_HOUR = 6;
  const END_HOUR = 22;

  function shiftWeek(delta) {
    __coachCalState.weekStart = new Date(
      __coachCalState.weekStart.getFullYear(),
      __coachCalState.weekStart.getMonth(),
      __coachCalState.weekStart.getDate() + delta*7
    );
  }

  function thisWeek() {
    const n = new Date();
    const day = (n.getDay() + 6) % 7;
    __coachCalState.weekStart = new Date(n.getFullYear(), n.getMonth(), n.getDate() - day);
    __coachCalState.weekStart.setHours(0,0,0,0);
    __coachCalState.selectedDayIndex = day;
  }

  function weekLabel() {
    const start = __coachCalState.weekStart;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const months = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
    const d1 = start.getDate();
    const d2 = end.getDate();
    const m1 = months[start.getMonth()];
    const m2 = months[end.getMonth()];
    if (start.getMonth() === end.getMonth()) {
      return `${d1}–${d2} ${m2}`;
    }
    return `${d1} ${m1} – ${d2} ${m2}`;
  }

  function getDays() {
    const start = __coachCalState.weekStart;
    return Array.from({length: 7}, (_,i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, ds: dateStr(d) };
    });
  }

  /* Обработчики навигации — вызывают renderDashboard,
     состояние сохраняется в глобальной переменной */
  function goPrevWeek() {
    shiftWeek(-1);
    renderDashboard();
  }
  function goNextWeek() {
    shiftWeek(1);
    renderDashboard();
  }
  function goThisWeek() {
    thisWeek();
    renderDashboard();
  }
  function selectDay(i) {
    __coachCalState.selectedDayIndex = i;
    renderDashboard();
  }

  function render() {
    const days = getDays();
    const t = todayStr();
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const monthsShort = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

    // Лента дней
    const daysStripHtml = days.map((d, i) => {
      const isToday = d.ds === t;
      const isSelected = i === __coachCalState.selectedDayIndex;
      const dayNum = d.date.getDate();
      const monthName = monthsShort[d.date.getMonth()];
      let cnt = 0;
      DB.fighters.forEach(f => {
        cnt += (f.calendar[d.ds] || []).length;
      });
      return `
        <button class="day-chip ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}"
                onclick="CoachCalendar.selectDay(${i})">
          <span class="day-chip-name">${dayNames[i]}</span>
          <span class="day-chip-num">${dayNum}</span>
          <span class="day-chip-month">${monthName}</span>
          ${cnt ? `<span class="day-chip-badge">${cnt}</span>` : ''}
        </button>
      `;
    }).join('');

    // Выбранный день
    const selectedDs = days[__coachCalState.selectedDayIndex].ds;
    const selectedDate = days[__coachCalState.selectedDayIndex].date;

    // Строки по часам
    let hoursHtml = '';
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const events = [];
      DB.fighters.forEach(f => {
        (f.calendar[selectedDs] || []).forEach((s, idx) => {
          if (s.hour === h) events.push({ f, s, idx });
        });
      });

      const aggregated = aggregateSlotEvents(events);

      const isNow = (() => {
        const now = new Date();
        return dateStr(now) === selectedDs && now.getHours() === h;
      })();

      hoursHtml += `
        <div class="hour-row ${isNow ? 'is-now' : ''}">
          <div class="hour-label">${String(h).padStart(2,'0')}:00</div>
          <div class="hour-cell"
               onclick="openAssignTrainingModal(null,'${selectedDs}',${h})">
            ${aggregated.length
              ? aggregated.map(agg => {
                  const tooltip = agg.events.map(ev => {
                    const exName = ev.s.blockId ? exerciseName(ev.s.blockId) : 'без упражнения';
                    return `${ev.f.name} — ${exName}`;
                  }).join('\n');
                  const modeClass = agg.mode === 'group' && agg.count > 1
                    ? 'group'
                    : agg.events[0].s.mode;
                  return `
                    <div class="hour-event ${modeClass}"
                         title="${tooltip}"
                         onclick="event.stopPropagation();openAggregatedTraining('${selectedDs}',${h})">
                      <b>${agg.label}</b>
                    </div>
                  `;
                }).join('')
              : ''}
            <div class="hour-add" title="Назначить тренировку">+</div>
          </div>
        </div>
      `;
    }

    const selectedDateLabel = selectedDate.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    return `
      <div class="coach-cal-header">
        <div class="coach-cal-toolbar">
          <button class="ghost" onclick="CoachCalendar.goPrevWeek()">‹</button>
          <b class="coach-cal-week">${weekLabel()}</b>
          <button class="ghost" onclick="CoachCalendar.goNextWeek()">›</button>
          <button class="ghost" onclick="CoachCalendar.goThisWeek()">Текущая</button>
          <button class="success" style="margin-left:auto" onclick="openAssignTrainingModal(null, '${selectedDs}', null)">+ Тренировка</button>
        </div>
        <div class="days-strip">
          ${daysStripHtml}
        </div>
        <div class="selected-day-label">${selectedDateLabel}</div>
        <div class="legend">
          <span><i style="background:#FEF3C7;border-left:3px solid #F59E0B"></i>Самостоятельно</span>
          <span><i style="background:#FCE7F3;border-left:3px solid #EC4899"></i>Индивидуально</span>
          <span><i style="background:#DBEAFE;border-left:3px solid #3B82F6"></i>Группа</span>
        </div>
      </div>
      <div class="hours-list">
        ${hoursHtml}
      </div>
    `;
  }

  return {
    render,
    shiftWeek,
    thisWeek,
    selectDay,
    goPrevWeek,
    goNextWeek,
    goThisWeek
  };
})();

/* ================== ДЕЙСТВИЯ С ТРЕНИРОВКОЙ ================== */
window.openAggregatedTraining = (dateStr, hour) => {
  const events = [];
  DB.fighters.forEach(f => {
    (f.calendar[dateStr] || []).forEach((s, idx) => {
      if (s.hour === hour) events.push({ f, s, idx });
    });
  });
  if (!events.length) return;

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