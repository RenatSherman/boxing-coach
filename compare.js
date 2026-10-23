/* ============================================================
   COMPARE.JS — сравнение бойцов
   ============================================================ */

function renderCompare() {
  const opts = DB.fighters.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  app.innerHTML = `
    <h2>Сравнение бойцов</h2>
    <div class="row">
      <select id="c1">${opts}</select>
      <select id="c2">${opts}</select>
      <button onclick="doCompare()">Сравнить</button>
    </div>
    <div id="compareResult"></div>
  `;
}

window.doCompare = () => {
  const a = DB.fighters.find(f => f.id === document.getElementById('c1').value);
  const b = DB.fighters.find(f => f.id === document.getElementById('c2').value);
  if (!a || !b) return;
  const aEnd = getEndAssess(a);
  const bEnd = getEndAssess(b);
  document.getElementById('compareResult').innerHTML = `
    <canvas id="cmpChart" height="140"></canvas>
    <table>
      <tr><th>Критерий</th><th>${a.name}</th><th>${b.name}</th><th>Δ</th></tr>
      ${DB.directions.map(d => {
        const va = aEnd ? avgObj(aEnd.data[d.key]) : 0;
        const vb = bEnd ? avgObj(bEnd.data[d.key]) : 0;
        return `<tr><td><b>${d.name}</b></td><td>${va}</td><td>${vb}</td>
          <td class="${va-vb>0?'pos':va-vb<0?'neg':''}">${(va-vb).toFixed(2)}</td></tr>`;
      }).join('')}
    </table>`;
  const ctx = document.getElementById('cmpChart');
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: DB.directions.map(d => d.name),
      datasets: [
        { label: a.name, data: DB.directions.map(d => aEnd ? avgObj(aEnd.data[d.key]) : 0),
          borderColor: '#87CEEB', backgroundColor: 'rgba(135, 206, 235, 0.5)', borderWidth: 2,
          pointBackgroundColor: '#87CEEB' },
        { label: b.name, data: DB.directions.map(d => bEnd ? avgObj(bEnd.data[d.key]) : 0),
          borderColor: '#4A90E2', backgroundColor: 'rgba(74, 144, 226, 0.5)', borderWidth: 2,
          pointBackgroundColor: '#4A90E2' }
      ]
    },
    options: {
      scales: { r: { min: 0, max: MAX_SCORE, ticks: { stepSize: 2, backdropColor: 'transparent' },
        grid: { color: '#dbeafe' }, angleLines: { color: '#dbeafe' },
        pointLabels: { font: { size: 12 } } } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
};