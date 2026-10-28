/* ============================================================
   REPORTS.JS — отчёты за месяц, агрегация, графики
   ============================================================ */

const Reports = (() => {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function monthName(m) {
    return ['Январь','Февраль','Март','Апрель','Май','Июнь',
            'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][m];
  }

  function collect(year, month) {
    const rows = DB.fighters.map(f => {
      let total = 0, personal = 0, self = 0, group = 0;
      Object.entries(f.calendar || {}).forEach(([date, slots]) => {
        const dt = new Date(date);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          slots.forEach(s => {
            total++;
            if (s.mode === 'personal') personal++;
            else if (s.mode === 'self') self++;
            else group++;
          });
        }
      });
      const att = getAttendanceStatsMonth(f, year, month);
      return {
        id: f.id, name: f.name, group: f.group,
        total, personal, self, group,
        attTotal: att.total, attPresent: att.present, attPercent: att.percent
      };
    });
    const sum = rows.reduce((a,r)=>({
      total: a.total + r.total,
      personal: a.personal + r.personal,
      self: a.self + r.self,
      group: a.group + r.group,
      attTotal: a.attTotal + r.attTotal,
      attPresent: a.attPresent + r.attPresent
    }), { total:0, personal:0, self:0, group:0, attTotal:0, attPresent:0 });
    sum.attPercent = sum.attTotal ? Math.round(sum.attPresent / sum.attTotal * 100) : 0;
    return { rows, sum };
  }

  function perDay(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    const arr = Array(days).fill(0);
    DB.fighters.forEach(f => {
      Object.entries(f.calendar || {}).forEach(([date, slots]) => {
        const dt = new Date(date);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          arr[dt.getDate() - 1] += slots.length;
        }
      });
    });
    return arr;
  }

  function allSlots(year, month) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const list = [];
    DB.fighters.forEach(f => {
      Object.entries(f.calendar || {}).forEach(([ds, slots]) => {
        const d = new Date(ds + 'T00:00:00');
        if (d >= monthStart && d <= monthEnd) {
          slots.forEach(s => {
            list.push({
              fighter: f.name,
              group: groupShort(f.group),
              date: ds,
              hour: s.hour,
              blockId: s.blockId,
              mode: s.mode,
              comment: s.comment || ''
            });
          });
        }
      });
    });
    list.sort((a,b) =>
      (a.date + String(a.hour).padStart(2,'0') + a.fighter)
        .localeCompare(b.date + String(b.hour).padStart(2,'0') + b.fighter)
    );
    return list;
  }

  function render() {
    const { rows, sum } = collect(currentYear, currentMonth);
    const weekData = perDay(currentYear, currentMonth);
    const labels = weekData.map((_,i)=>i+1);

    setTimeout(() => {
      const ctx = document.getElementById('repDays');
      if (ctx) {
        if (ctx._chart) ctx._chart.destroy();
        ctx._chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Тренировок',
              data: weekData,
              borderColor: '#4A90E2',
              backgroundColor: 'rgba(135,206,235,.3)',
              tension: .3,
              fill: true
            }]
          },
          options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
          }
        });
      }

      const ctx2 = document.getElementById('repModes');
      if (ctx2) {
        if (ctx2._chart) ctx2._chart.destroy();
        ctx2._chart = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: ['Самостоятельно','Индивидуально','Группа'],
            datasets: [{
              data: [sum.self, sum.personal, sum.group],
              backgroundColor: ['#F59E0B','#EC4899','#3B82F6']
            }]
          },
          options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
          }
        });
      }
    }, 50);

    return `
      <h2>Отчёт</h2>
      <div class="cal-toolbar" style="justify-content: space-between;">
        <div>
          <button onclick="Reports.shift(-1)">‹</button>
          <b>${monthName(currentMonth)} ${currentYear}</b>
          <button onclick="Reports.shift(1)">›</button>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="small" onclick="exportReportPDF(${currentYear},${currentMonth})">📄 Краткий</button>
          <button class="small" onclick="exportMonthReportFullPDF(${currentYear},${currentMonth})">📊 Полный</button>
        </div>
      </div>

      <div class="grid" style="margin-bottom: 16px;">
        <div class="card" style="padding:12px; text-align:center;">
          <div style="font-size:12px; color:#666;">Всего тренировок</div>
          <p class="big" style="font-size:24px; margin-top:4px;">${sum.total}</p>
        </div>
        <div class="card" style="padding:12px; text-align:center;">
          <div style="font-size:12px; color:#666;">Посещаемость</div>
          <p class="big" style="font-size:24px; color:#22c55e; margin-top:4px;">${sum.attPercent}%</p>
        </div>
      </div>

      <h3>По дням месяца</h3>
      <div class="report-chart-wrap">
        <canvas id="repDays"></canvas>
      </div>

      <h3>Распределение</h3>
      <div class="report-chart-wrap" style="height: 180px;">
        <canvas id="repModes"></canvas>
      </div>

      <h3 style="margin-top:20px;">По бойцам</h3>
      <div class="report-cards-list">
        ${rows.map(r => `
          <div class="report-card">
            <div class="report-card-header">
              <b>${r.name}</b>
              <span class="report-group">${groupShort(r.group)}</span>
            </div>
            
            <div class="report-stats">
              <div class="r-stat"><span>Тренировок</span><b>${r.total}</b></div>
              <div class="r-stat"><span>Индивид.</span><b>${r.personal}</b></div>
              <div class="r-stat"><span>Группа</span><b>${r.group}</b></div>
              <div class="r-stat"><span>Самост.</span><b>${r.self}</b></div>
              <div class="r-stat"><span>Посещений</span><b>${r.attPresent}/${r.attTotal}</b></div>
              <div class="r-stat"><span>%</span><b>${r.attPercent}%</b></div>
            </div>
            
            <button class="ghost small" style="width:100%; margin-top:10px;" onclick="exportFighterMonthPDF('${r.id}',${currentYear},${currentMonth})">
              📄 Скачать PDF
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function shift(d) {
    currentMonth += d;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  }

  return { render, shift, collect, perDay, allSlots, monthName };
})();