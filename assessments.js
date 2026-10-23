/* ============================================================
   ASSESSMENTS.JS — оценки по направлениям
   ============================================================
   Зависимости: config.js, utils.js, data.js, cloud.js.
   
   Что внутри:
   - Модалка добавления оценки
   - Модалка редактирования оценки
   - Сохранение и удаление оценок
   - Быстрое изменение даты в таблице
   - Изменение баллов (setScore)
   - Отрисовка радара (drawRadarAll)
   ============================================================ */

window.openAddAssessModal = (fighterId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const defaultName = 'Оценка от ' + formatDateRu(todayStr());
  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Новая оценка по направлениям</h3>
      <label>Название</label>
      <input id="am_name" value="${defaultName}" placeholder="Например, Осенний замер">
      <label>Дата</label>
      <input id="am_date" type="date" value="${todayStr()}">
      <label>Тип</label>
      <select id="am_type">
        <option value="checkpoint">Промежуточный</option>
        <option value="start">Начало сезона</option>
        <option value="end">Конец сезона</option>
      </select>
      <p style="font-size:13px;color:#666;margin:8px 0">
        Оценки по направлениям (0–${MAX_SCORE}). Можно заполнить позже.
      </p>
      ${DB.directions.map(d => `
        <fieldset style="border:1px solid #eee;border-radius:8px;padding:10px;margin:8px 0">
          <legend style="font-size:13px;font-weight:600;color:#333">${d.name}</legend>
          ${d.criteria.map(c => `
            <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
              <span style="flex:1;font-size:13px">${c.name}</span>
              <input type="number" min="0" max="${MAX_SCORE}" value="0"
                     data-dir="${d.key}" data-crit="${c.key}" class="am_score" style="width:70px">
            </div>
          `).join('')}
        </fieldset>
      `).join('')}
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitAddAssess('${f.id}')">Сохранить</button>
      </div>
    </div>
  `);
};

window.submitAddAssess = (fighterId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const name = document.getElementById('am_name').value.trim() || 'Оценка';
  const date = document.getElementById('am_date').value;
  const type = document.getElementById('am_type').value;
  if (!date) { toast('Укажите дату', 'error'); return; }
  const data = emptyAssess();
  document.querySelectorAll('.am_score').forEach(inp => {
    const dk = inp.dataset.dir, ck = inp.dataset.crit;
    let v = +inp.value || 0;
    if (v < 0) v = 0; if (v > MAX_SCORE) v = MAX_SCORE;
    if (!data[dk]) data[dk] = {};
    data[dk][ck] = v;
  });
  f.assessments = f.assessments || [];
  f.assessments.push({ id: uid(), date, type, name, data });
  saveData(DB);
  Modal.close();
  toast('Оценка добавлена', 'ok');
  renderFighterDetail();
};

window.deleteAssess = (fighterId, assessId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  if (!f.assessments) return;
  if (f.assessments.length <= 1) { toast('Нельзя удалить последнюю оценку', 'error'); return; }
  if (!confirm('Удалить оценку?')) return;
  f.assessments = f.assessments.filter(a => a.id !== assessId);
  saveData(DB);
  renderFighterDetail();
};

window.editAssess = (fighterId, assessId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const a = f.assessments.find(x => x.id === assessId);
  if (!a) return;
  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Редактирование оценки</h3>
      <label>Название</label>
      <input id="am_name" value="${a.name || ''}">
      <label>Дата</label>
      <input id="am_date" type="date" value="${a.date}">
      <label>Тип</label>
      <select id="am_type">
        <option value="start" ${a.type==='start'?'selected':''}>Начало сезона</option>
        <option value="checkpoint" ${a.type==='checkpoint'?'selected':''}>Промежуточный</option>
        <option value="end" ${a.type==='end'?'selected':''}>Конец сезона</option>
      </select>
      ${DB.directions.map(d => `
        <fieldset style="border:1px solid #eee;border-radius:8px;padding:10px;margin:8px 0">
          <legend style="font-size:13px;font-weight:600;color:#333">${d.name}</legend>
          ${d.criteria.map(c => {
            const val = (a.data[d.key] && a.data[d.key][c.key]) || 0;
            return `
              <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
                <span style="flex:1;font-size:13px">${c.name}</span>
                <input type="number" min="0" max="${MAX_SCORE}" value="${val}"
                       data-dir="${d.key}" data-crit="${c.key}" class="am_score" style="width:70px">
              </div>
            `;
          }).join('')}
        </fieldset>
      `).join('')}
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitEditAssess('${f.id}','${a.id}')">Сохранить</button>
      </div>
    </div>
  `);
};

window.submitEditAssess = (fighterId, assessId) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  const a = f.assessments.find(x => x.id === assessId);
  if (!a) return;
  a.name = document.getElementById('am_name').value.trim() || a.name;
  a.date = document.getElementById('am_date').value;
  a.type = document.getElementById('am_type').value;
  document.querySelectorAll('.am_score').forEach(inp => {
    const dk = inp.dataset.dir, ck = inp.dataset.crit;
    let v = +inp.value || 0;
    if (v < 0) v = 0; if (v > MAX_SCORE) v = MAX_SCORE;
    if (!a.data[dk]) a.data[dk] = {};
    a.data[dk][ck] = v;
  });
  saveData(DB);
  Modal.close();
  toast('Оценка обновлена', 'ok');
  renderFighterDetail();
};

window.inlineUpdateAssessDate = (assessId, value) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  if (!f) return;
  const a = f.assessments.find(x => x.id === assessId);
  if (!a) return;
  if (!value) return;
  a.date = value;
  saveData(DB);
  const tlItem = document.querySelector(`.tl-item[data-assess-id="${assessId}"]`);
  if (tlItem) {
    const small = tlItem.querySelector('small');
    if (small) {
      const typeLabel = a.type === 'start' ? 'Начало сезона'
                       : a.type === 'end' ? 'Конец сезона'
                       : 'Промежуточный';
      const avg = avgAll(a.data).toFixed(2);
      small.textContent = `${formatDateRu(a.date)} • ${typeLabel} • Средний балл: ${avg}/${MAX_SCORE}`;
    }
  }
  drawRadarAll(f);
};

window.setScore = (assessId, group, key, val) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  const a = f.assessments.find(x => x.id === assessId);
  if (!a) return;
  let v = +val; if (v < 0) v = 0; if (v > MAX_SCORE) v = MAX_SCORE;
  if (!a.data[group]) a.data[group] = {};
  a.data[group][key] = v;
  saveData(DB);
  drawRadarAll(f);
};

function drawRadarAll(f) {
  const labels = DB.directions.map(d => d.name);
  const list = sortAssessments(f);
  if (!list.length) return;
  const colors = [
    { bg: 'rgba(135, 206, 235, 0.25)', border: '#87CEEB' },
    { bg: 'rgba(74, 144, 226, 0.25)',  border: '#4A90E2' },
    { bg: 'rgba(245, 158, 11, 0.25)',  border: '#F59E0B' },
    { bg: 'rgba(236, 72, 153, 0.25)',  border: '#EC4899' },
    { bg: 'rgba(59, 130, 246, 0.25)',  border: '#3B82F6' },
    { bg: 'rgba(139, 92, 246, 0.25)',  border: '#8B5CF6' }
  ];
  const datasets = list.map((a, idx) => {
    const label = a.name || (a.type === 'start' ? `Начало (${formatDateRu(a.date)})`
                : a.type === 'end' ? `Конец (${formatDateRu(a.date)})`
                : formatDateRu(a.date));
    let color;
    if (a.type === 'start') color = colors[0];
    else if (a.type === 'end') color = colors[1];
    else color = colors[2 + ((idx - 2 + colors.length) % (colors.length - 2))];
    return {
      label,
      data: DB.directions.map(d => avgObj(a.data[d.key])),
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
      pointBackgroundColor: color.border,
      pointBorderColor: '#fff',
      pointRadius: 3
    };
  });
  const ctx = document.getElementById('radarAll');
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      scales: {
        r: { min: 0, max: MAX_SCORE,
          ticks: { stepSize: 2, backdropColor: 'transparent' },
          grid: { color: '#dbeafe' }, angleLines: { color: '#dbeafe' },
          pointLabels: { font: { size: 12 } } }
      },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } }
    }
  });
}