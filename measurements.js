/* ============================================================
   MEASUREMENTS.JS — замеры бойца
   ============================================================
   Зависимости: config.js, utils.js, data.js, cloud.js.
   
   Что внутри:
   - Модалка добавления замеров
   - Сохранение и удаление замеров
   - Отрисовка графиков (drawMeasurementChart)
   ============================================================ */

window.openAddMeasurementModal = (fighterId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const items = allMeasurementItems();
  if (!items.length) {
    toast('Сначала добавьте замеры в разделе «Упражнения и замеры → Замеры»', 'error');
    return;
  }

  const groupsHtml = DB.measurementGroups.map(g => {
    if (!g.measurements.length) return '';
    return `
      <fieldset style="border:1px solid #eee;border-radius:8px;padding:10px;margin:8px 0">
        <legend style="font-size:13px;font-weight:600;color:#333">${g.name}</legend>
        ${g.measurements.map(m => {
          const list = sortMeasurements(f, m.id);
          const latest = list.length ? list[list.length-1] : null;
          const placeholder = latest ? `Последнее: ${latest.value} ${m.unit || 'раз'}` : 'Например, 30';
          return `
            <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
              <span style="flex:1;font-size:14px">${m.name}</span>
              <input type="number" min="0" step="1"
                     class="m_bulk_value"
                     data-measure-id="${m.id}"
                     placeholder="${placeholder}"
                     style="width:140px">
              <span style="font-size:12px;color:#888;min-width:40px">${m.unit || 'раз'}</span>
            </div>
          `;
        }).join('')}
      </fieldset>
    `;
  }).join('');

  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Новый замер</h3>
      <p style="font-size:13px;color:#666;margin:4px 0 12px">
        Заполните только те замеры, которые делали. Пустые поля будут пропущены.
      </p>
      <label>Дата</label>
      <input id="m_bulk_date" type="date" value="${todayStr()}">
      <div style="margin-top:10px">${groupsHtml}</div>
      <label>Комментарий (общий для всех)</label>
      <textarea id="m_bulk_comment" placeholder="Заметки к замерам…"></textarea>
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitAddMeasurement('${f.id}')">Сохранить</button>
      </div>
    </div>
  `);
};

window.submitAddMeasurement = (fighterId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const date = document.getElementById('m_bulk_date').value;
  const comment = document.getElementById('m_bulk_comment').value.trim();
  if (!date) { toast('Укажите дату', 'error'); return; }

  const inputs = [...document.querySelectorAll('.m_bulk_value')];
  const toSave = [];
  inputs.forEach(inp => {
    const raw = inp.value.trim();
    if (raw === '') return;
    const v = +raw;
    if (isNaN(v)) return;
    if (v < 0) return;
    toSave.push({ measureId: inp.dataset.measureId, value: v });
  });

  if (!toSave.length) {
    toast('Заполните хотя бы один замер', 'error');
    return;
  }

  f.measurements = f.measurements || [];
  toSave.forEach(item => {
    f.measurements.push({
      id: uid(),
      date,
      measureId: item.measureId,
      value: item.value,
      comment
    });
  });

  saveData(DB);
  Modal.close();
  toast(`Сохранено замеров: ${toSave.length}`, 'ok');
  renderFighterDetail();
};

window.deleteMeasurement = (fighterId, measureId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  if (!confirm('Удалить замер?')) return;
  f.measurements = (f.measurements || []).filter(t => t.id !== measureId);
  saveData(DB);
  renderFighterDetail();
};

function drawMeasurementChart(canvasId, f, measureId) {
  const list = sortMeasurements(f, measureId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  if (!list.length) return;
  const m = measurementById(measureId);
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: list.map(t => formatDateRu(t.date)),
      datasets: [{
        label: m ? m.name : '',
        data: list.map(t => t.value),
        borderColor: '#e63946',
        backgroundColor: 'rgba(230,57,70,.15)',
        tension: .3, fill: true,
        pointRadius: 4, pointBackgroundColor: '#e63946', pointBorderColor: '#fff'
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}