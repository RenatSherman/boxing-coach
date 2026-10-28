/* ============================================================
   DASHBOARD.JS — главный экран (дашборд)
   ============================================================ */

function renderDashboard() {
  const groups = getFighterGroups();

  const groupsCards = groups.map(g => {
    const count = DB.fighters.filter(f => f.group === g.key).length;
    return `<div class="card"><h3>${g.name}</h3><p class="big">${count}</p></div>`;
  }).join('');

  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '—';
  const fighterAvg = f => {
    const end = getEndAssess(f);
    return end ? avgAll(end.data) : 0;
  };
  const top = [...DB.fighters].sort((a,b)=>fighterAvg(b)-fighterAvg(a)).slice(0,3);

  const forgotten = getForgottenFighters(14);
  const recent = getRecentTrainings(15);

  const today = todayStr();
  const todaySessions = getTrainingSessions(today);

  app.innerHTML = `
    ${todaySessions.length ? `
      <div class="card" style="border-left:4px solid #22c55e;background:#f0fdf4; margin-top: 0; margin-bottom: 12px; padding: 12px;">
        <div style="font-size:14px; font-weight:600; color:#166534; margin-bottom:4px;">📅 Сегодня тренировки (${todaySessions.length})</div>
        <button class="success" style="width:100%; padding:10px;" onclick="state.tab='attendance';Attendance.setToday();setActiveTab('attendance');render()">
          Перейти к отметке
        </button>
      </div>
    ` : ''}

    <h3 style="margin-top:0;">Календарь</h3>
    ${CoachCalendar.render()}

    <!-- Аккордеоны под календарем -->
    <details class="dash-accordion">
      <summary>📋 Последние тренировки</summary>
      <div class="dash-accordion-content">
        ${renderRecentTrainingsContent(recent)}
      </div>
    </details>

    <details class="dash-accordion">
      <summary>⚠️ Требуют внимания (${forgotten.length})</summary>
      <div class="dash-accordion-content">
        ${renderForgottenList(forgotten)}
      </div>
    </details>

    <!-- Всё остальное (статистика, группы) убрано вниз -->
    <details class="dash-accordion">
      <summary>📊 Статистика и группы</summary>
      <div class="dash-accordion-content">
        <div class="grid" style="margin-bottom:12px;">
          ${groupsCards}
          <div class="card"><h3>Средний рост</h3><p class="big">${avg(DB.fighters.map(f=>+f.height))} см</p></div>
        </div>
        <h3>Топ-3 бойца (из ${MAX_SCORE})</h3>
        <ol style="margin-top:4px; padding-left:20px;">
          ${top.map(f=>`<li>${f.name} — ${fighterAvg(f).toFixed(2)}</li>`).join('') || '<i>нет данных</i>'}
        </ol>
        <h3>Динамика сезона</h3>
        <canvas id="dashChart" height="160"></canvas>
      </div>
    </details>
  `;
  
  // Отрисовка графика, если аккордеон открыт
  setTimeout(() => {
    if (document.getElementById('dashChart')) drawDashChart();
  }, 100);

  if (DB.settings.notifications) Calendar.requestPerm();
}

function renderRecentTrainingsContent(recent) {
  if (!recent.length) {
    return `<p style="color:#666;font-size:14px;margin:0;">Пока тренировок нет. Назначьте первую в календаре.</p>`;
  }

  const items = recent.map(t => {
    const [y, m, d] = t.date.split('-');
    const exName = t.blockId ? exerciseName(t.blockId) : 'Без упражнения';
    const commentHtml = t.comment ? `<br><small class="comment">💬 ${t.comment}</small>` : '';
    return `
      <div class="journal-item" onclick="openFighter('${t.fighter.id}')">
        <div class="j-date"><b>${d}.${m}</b>${String(t.hour).padStart(2,'0')}:00</div>
        <div class="j-info"><b>${t.fighter.name}</b><small>${exName}</small>${commentHtml}</div>
        <span class="j-mode ${t.mode}">${modeLabel(t.mode)}</span>
      </div>
    `;
  }).join('');

  return `<div class="journal-list">${items}</div>`;
}

function renderForgottenList(forgotten) {
  if (forgotten.length === 0) {
    return '<p style="color:#16a34a;margin:0;">Все бойцы тренируются регулярно. Отлично!</p>';
  }
  return `
    <ul class="forgotten-list" style="margin:0;">
      ${forgotten.map(({fighter, daysAgo}) => `
        <li class="forgotten-item" onclick="openFighter('${fighter.id}')">
          <div class="info"><b>${fighter.name}</b><small>${groupName(fighter.group)}</small></div>
          <span class="days">${daysAgo === null ? 'Нет тренировок' : daysAgo + ' дн.'}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function drawDashChart() {
  const ctx = document.getElementById('dashChart');
  if (!ctx || !DB.fighters.length) return;
  if (ctx._chart) ctx._chart.destroy();
  const labels = DB.fighters.map(f => f.name);
  const startVals = DB.fighters.map(f => {
    const s = getStartAssess(f);
    return s ? avgAll(s.data) : 0;
  });
  const endVals = DB.fighters.map(f => {
    const e = getEndAssess(f);
    return e ? avgAll(e.data) : 0;
  });
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Начало сезона', data: startVals, backgroundColor: '#87CEEB' },
        { label: 'Конец сезона', data: endVals, backgroundColor: '#4A90E2' }
      ]
    },
    options: { scales: { y: { beginAtZero: true, max: MAX_SCORE } } }
  });
}