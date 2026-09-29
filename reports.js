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

  /* Собрать данные по всем бойцам за месяц */
  function collect(year, month) {
    const rows = DB.fighters.map(f => {
      let total = 0, personal = 0, self = 0, group = 0;
      Object.entries(f.calendar).forEach(([date, slots]) => {
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
      return { id: f.id, name: f.name, group: f.group, total, personal, self, group };
    });
    const sum = rows.reduce((a,r)=>({
      total: a.total + r.total,
      personal: a.personal + r.personal,
      self: a.self + r.self,
      group: a.group + r.group
    }), { total:0, personal:0, self:0, group:0 });
    return { rows, sum };
  }

  /* Количество тренировок по дням месяца */
  function perDay(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    const arr = Array(days).fill(0);
    DB.fighters.forEach(f => {
      Object.entries(f.calendar).forEach(([date, slots]) => {
        const dt = new Date(date);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          arr[dt.getDate() - 1] += slots.length;
        }
      });
    });
    return arr;
  }

  /* Детальный список тренировок за месяц (для PDF полного отчёта) */
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

  /* Отрисовка вкладки «Отчёт» */
  function render() {
    const { rows, sum } = collect(currentYear, currentMonth);
    const weekData = perDay(currentYear, currentMonth);
    const labels = weekData.map((_,i)=>i+1);

    /* Графики рисуем после вставки HTML */
    setTimeout(() => {
      const ctx = document.getElementById('repDays');
      if (ctx) {
        if (ctx._chart) ctx._chart.destroy();
        ctx._chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Тренировок в день',
              data: weekData,
              borderColor: '#4A90E2',
              backgroundColor: 'rgba(135,206,235,.3)',
              tension: .3,
              fill: true
            }]
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
          }
        });
      }
    }, 50);

    return `
      <h2>Отчёт — ${monthName(currentMonth)} ${currentYear}</h2>
      <div class="cal-toolbar">
        <button onclick="Reports.shift(-1)">‹</button>
        <b>${monthName(currentMonth)} ${currentYear}</b>
        <button onclick="Reports.shift(1)">›</button>
        <button onclick="exportReportPDF(${currentYear},${currentMonth})">📄 Краткий отчёт</button>
        <button onclick="exportMonthReportFullPDF(${currentYear},${currentMonth})">📊 Полный отчёт тренера</button>
      </div>

      <div class="grid">
        <div class="card"><h3>Всего тренировок</h3><p class="big">${sum.total}</p></div>
        <div class="card"><h3>Персональных</h3><p class="big">${sum.personal}</p></div>
        <div class="card"><h3>Групповых</h3><p class="big">${sum.group}</p></div>
        <div class="card"><h3>Самостоятельных</h3><p class="big">${sum.self}</p></div>
      </div>

      <h3>По дням месяца</h3>
      <canvas id="repDays" height="100"></canvas>

      <h3>Распределение по формату</h3>
      <canvas id="repModes" height="100"></canvas>

      <h3>По бойцам</h3>
      <table>
        <tr>
          <th>Боец</th><th>Группа</th><th>Тренировок</th>
          <th>Индивид.</th><th>Группа</th><th>Самост.</th><th></th>
        </tr>
        ${rows.map(r => `
          <tr>
            <td>${r.name}</td>
            <td>${groupShort(r.group)}</td>
            <td>${r.total}</td>
            <td>${r.personal}</td>
            <td>${r.group}</td>
            <td>${r.self}</td>
            <td>
              <button onclick="exportFighterMonthPDF('${r.id}',${currentYear},${currentMonth})">PDF</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  /* Переключение месяца */
  function shift(d) {
    currentMonth += d;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  }

  return { render, shift, collect, perDay, allSlots, monthName };
})();