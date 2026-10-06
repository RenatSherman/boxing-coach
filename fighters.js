/* ============================================================
   FIGHTERS.JS — бойцы, оценки, замеры, тренировки
   ============================================================ */

/* ================== ТРЕНИРОВКИ ================== */
function addTraining(fighterIds, dateStr, hour, blockId, mode, comment) {
  let added = 0;
  fighterIds.forEach(id => {
    const f = DB.fighters.find(x => x.id === id);
    if (!f) return;
    f.calendar[dateStr] = f.calendar[dateStr] || [];
    f.calendar[dateStr].push({ hour, blockId: blockId || '', mode, comment: comment || '' });
    added++;
  });
  if (added > 0) saveData(DB);
  return added;
}

window.openAssignTrainingModal = (presetFighterId, presetDate, presetHour) => {
  const items = allExerciseItems();

  const groupsForList = FIGHTER_GROUPS.map(g => ({
    ...g,
    fighters: DB.fighters.filter(f => f.group === g.key)
      .sort((a,b)=>a.name.localeCompare(b.name))
  })).filter(g => g.fighters.length);

  const groupsHtml = groupsForList.map(g => `
    <div class="group-title">${g.name}</div>
    ${g.fighters.map(f => `
      <label>
        <input type="checkbox" class="tr_fighter" value="${f.id}"
          ${presetFighterId === f.id ? 'checked' : ''}>
        <span>${f.name}</span>
      </label>
    `).join('')}
  `).join('');

  const selectedHour = (presetHour !== null && presetHour !== undefined && !isNaN(presetHour))
    ? +presetHour : 9;

  const exerciseOptionsHtml = `
    <optgroup label="Без упражнения">
      <option value="">— Без упражнения —</option>
    </optgroup>
    ${DB.exerciseGroups.map(g => `
      <optgroup label="${g.name}">
        ${g.exercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
      </optgroup>
    `).join('')}
  `;

  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Назначить тренировку</h3>
      <label>Дата</label>
      <input id="tr_date" type="date" value="${presetDate || todayStr()}">
      <label>Час (06:00–22:00)</label>
      <select id="tr_hour">
        ${Array.from({length: 17}, (_,i)=>i+6).map(h =>
          `<option value="${h}" ${h === selectedHour ? 'selected' : ''}>${String(h).padStart(2,'0')}:00</option>`).join('')}
      </select>
      <label>Упражнение (необязательно)</label>
      <select id="tr_block">
        ${exerciseOptionsHtml}
      </select>
      <label>Формат</label>
      <select id="tr_mode">
        <option value="self">Самостоятельно</option>
        <option value="personal">Индивидуально с тренером</option>
        <option value="group">Работа в группе</option>
      </select>
      <label>Комментарий</label>
      <textarea id="tr_comment" placeholder="Заметки к тренировке…"></textarea>
      <label style="margin-top:14px">Кому назначить</label>
      <div class="group-buttons">
        ${FIGHTER_GROUPS.map(g =>
          `<button type="button" onclick="pickGroup('${g.key}', event)">Вся группа: ${g.short}</button>`
        ).join('')}
        <button type="button" onclick="pickAllKids(event)">Все дети</button>
        <button type="button" onclick="pickAll(event)">Все бойцы</button>
        <button type="button" onclick="clearAllFighters(event)">Очистить</button>
      </div>
      <div class="fighters-dropdown" id="tr_dropdown">
        <button type="button" class="fighters-dropdown-btn" id="tr_dropdown_btn"
                onclick="toggleFightersDropdown(event)">
          <span id="tr_dropdown_text">Выберите бойцов</span>
          <span class="arrow">▾</span>
        </button>
        <div class="fighters-dropdown-menu" id="tr_dropdown_menu">
          ${groupsHtml || '<div class="empty">Нет бойцов</div>'}
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitAssignTraining()">Назначить</button>
      </div>
    </div>
  `);

  setTimeout(() => {
    document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => {
      cb.addEventListener('change', updateFightersDropdownText);
    });
    updateFightersDropdownText();
    document.addEventListener('click', outsideDropdownClick, true);
  }, 30);
};

function outsideDropdownClick(e) {
  const dd = document.getElementById('tr_dropdown');
  if (!dd) {
    document.removeEventListener('click', outsideDropdownClick, true);
    return;
  }
  if (!dd.contains(e.target)) {
    const menu = document.getElementById('tr_dropdown_menu');
    const btn = document.getElementById('tr_dropdown_btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.classList.remove('open');
  }
}

window.toggleFightersDropdown = (e) => {
  e.stopPropagation();
  const menu = document.getElementById('tr_dropdown_menu');
  const btn = document.getElementById('tr_dropdown_btn');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
};

window.updateFightersDropdownText = () => {
  const checked = [...document.querySelectorAll('#tr_dropdown_menu .tr_fighter:checked')];
  const total = document.querySelectorAll('#tr_dropdown_menu .tr_fighter').length;
  const text = document.getElementById('tr_dropdown_text');
  if (!text) return;
  if (checked.length === 0) text.textContent = 'Выберите бойцов';
  else if (checked.length === total) text.textContent = `Все (${total})`;
  else if (checked.length === 1) {
    const f = DB.fighters.find(x => x.id === checked[0].value);
    text.textContent = f ? f.name : '1 боец';
  }
  else text.textContent = `Выбрано: ${checked.length}`;
};

window.pickGroup = (groupKey, e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => {
    const f = DB.fighters.find(x => x.id === cb.value);
    cb.checked = f && f.group === groupKey;
  });
  updateFightersDropdownText();
  toast('Выбрана группа: ' + groupName(groupKey), 'ok');
};
window.pickAllKids = (e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => {
    const f = DB.fighters.find(x => x.id === cb.value);
    const g = FIGHTER_GROUPS.find(x => x.key === f?.group);
    cb.checked = !!(f && g && g.isKids);
  });
  updateFightersDropdownText();
  toast('Выбраны все дети', 'ok');
};
window.pickAll = (e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => cb.checked = true);
  updateFightersDropdownText();
};
window.clearAllFighters = (e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => cb.checked = false);
  updateFightersDropdownText();
};

window.submitAssignTraining = () => {
  const dateStr = document.getElementById('tr_date').value;
  const hour = +document.getElementById('tr_hour').value;
  const blockId = document.getElementById('tr_block').value;
  const mode = document.getElementById('tr_mode').value;
  const comment = document.getElementById('tr_comment').value.trim();
  const selected = [...document.querySelectorAll('.tr_fighter:checked')].map(c => c.value);

  if (!dateStr) { toast('Укажите дату', 'error'); return; }
  if (!selected.length) { toast('Выберите хотя бы одного бойца', 'error'); return; }
  if (hour < 6 || hour > 22) { toast('Час должен быть 06:00–22:00', 'error'); return; }

  const n = addTraining(selected, dateStr, hour, blockId, mode, comment);
  const menu = document.getElementById('tr_dropdown_menu');
  if (menu) menu.classList.remove('open');
  Modal.close();
  toast(`Назначено ${n} тренировк${n===1?'а':'и'}`, 'ok');
  if (state.tab === 'dashboard') renderDashboard();
  else if (state.tab === 'fighters' && state.currentFighter) renderFighterDetail();
  else render();
};

window.deleteTraining = (fighterId, dateStr, idx) => {
  const f = DB.fighters.find(x => x.id === fighterId);
  if (!f) return;
  if (!confirm('Удалить тренировку?')) return;
  f.calendar[dateStr].splice(idx, 1);
  if (!f.calendar[dateStr].length) delete f.calendar[dateStr];
  saveData(DB);
  if (state.tab === 'dashboard') renderDashboard();
  else if (state.currentFighter) renderFighterDetail();
};

/* ================== ДОБАВЛЕНИЕ БОЙЦА ================== */
window.openAddFighterModal = () => {
  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Новый боец</h3>
      <label>ФИО</label>
      <input id="nf_name" placeholder="Иванов Иван Иванович" autofocus>
      <label>Дата рождения</label>
      <input id="nf_birth" type="date" oninput="updateAgeHint()">
      <div id="nf_age_hint" style="margin-top:6px;font-size:13px;color:#666"></div>
      <label>Группа</label>
      <select id="nf_group">
        ${FIGHTER_GROUPS.map(g => `<option value="${g.key}">${g.name}</option>`).join('')}
      </select>
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="createFighter()">Создать</button>
      </div>
    </div>
  `);
  setTimeout(()=>document.getElementById('nf_name')?.focus(), 50);
};

window.updateAgeHint = () => {
  const bd = document.getElementById('nf_birth').value;
  const hint = document.getElementById('nf_age_hint');
  if (!bd) { hint.textContent = ''; return; }
  hint.innerHTML = `Возраст: <span class="age-hint">${calcAge(bd)} лет</span>`;
};

window.createFighter = () => {
  const name = document.getElementById('nf_name').value.trim();
  const birthDate = document.getElementById('nf_birth').value;
  const group = document.getElementById('nf_group').value;
  if (!name) { toast('Укажите ФИО', 'error'); return; }
  const assess = emptyAssess();
  const today = todayStr();
  DB.fighters.push({
    id: uid(), group, name, photo: '',
    birthDate, age: birthDate ? calcAge(birthDate) : '',
    height: '', weight: '', stance: 'right',
    assessments: [
      { id: uid(), date: today, type: 'start', name: 'Начало сезона', data: structuredClone(assess) },
      { id: uid(), date: today, type: 'end', name: 'Конец сезона', data: structuredClone(assess) }
    ],
    measurements: [],
    attendance: [],
    workPlan: [], calendar: {}, fights: []
  });
  saveData(DB);
  Modal.close();
  toast('Боец создан', 'ok');
  render();
};

/* ================== ОЦЕНКИ ПО НАПРАВЛЕНИЯМ ================== */
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

/* ================== ЗАМЕРЫ БОЙЦА ================== */
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

/* ================== ГРАФИКИ ================== */
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

/* ================== СПИСОК И КАРТОЧКА БОЙЦА ================== */
function renderFighters() {
  const groups = FIGHTER_GROUPS.map(g => ({
    ...g,
    fighters: DB.fighters.filter(f => f.group === g.key)
  }));
  app.innerHTML = `
    <h2>Бойцы</h2>
    <button onclick="openAddFighterModal()">+ Добавить бойца</button>
    ${groups.map(g => `
      <h3>${g.name} (${g.fighters.length})</h3>
      <div class="fighters-grid">${g.fighters.map(fighterCard).join('') || '<i>пусто</i>'}</div>
    `).join('')}
  `;
}

function fighterCard(f) {
  const end = getEndAssess(f);
  const avg = end ? avgAll(end.data).toFixed(1) : '0.0';
  const age = calcAge(f.birthDate);
  const ageText = age === '—' ? 'возраст не указан' : `${age} лет`;
  return `<div class="card fighter" onclick="openFighter('${f.id}')">
    <img src="${f.photo || 'https://via.placeholder.com/80'}" />
    <b>${f.name}</b>
    <small>${ageText} • ${f.weight || '?'} кг</small><br>
    <small>⭐ ${avg}/${MAX_SCORE}</small>
  </div>`;
}

window.openFighter = id => { state.currentFighter = id; renderFighterDetail(); };

function renderFighterDetail() {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  if (!f) return renderFighters();
  const age = calcAge(f.birthDate);
  const ageText = age === '—' ? '—' : `${age} лет`;

  app.innerHTML = `
    <button onclick="state.tab='fighters';render()">← Назад</button>
    <h2>${f.name} <span style="font-size:16px;color:#666;font-weight:400">— ${ageText} • ${groupName(f.group)}</span></h2>

    <div class="grid">
      <div class="card">
        <img id="fphoto" src="${f.photo || 'https://via.placeholder.com/120'}" width="120"/>
        <input type="file" accept="image/*" onchange="uploadPhoto(event)"/>
        <p><label>ФИО <input value="${f.name}" onchange="upd('name',this.value)"/></label></p>
        <p><label>Дата рождения <input type="date" value="${f.birthDate}" onchange="updBirth(this.value)"/></label>
           <span id="ageBadge" class="age-hint">${ageText}</span></p>
        <p><label>Рост <input type="number" value="${f.height}" onchange="upd('height',this.value)"/></label></p>
        <p><label>Вес <input type="number" value="${f.weight}" onchange="upd('weight',this.value)"/></label></p>
        <p><label>Стойка
          <select onchange="upd('stance',this.value)">
            <option value="right" ${f.stance==='right'?'selected':''}>Правша</option>
            <option value="left" ${f.stance==='left'?'selected':''}>Левша</option>
          </select></label></p>
        <p><label>Группа
          <select onchange="upd('group',this.value)">
            ${FIGHTER_GROUPS.map(g => `<option value="${g.key}" ${f.group===g.key?'selected':''}>${g.name}</option>`).join('')}
          </select></label></p>
        <button onclick="delFighter('${f.id}')" class="danger">Удалить бойца</button>
      </div>

      <div class="card">
        <h3>Динамика оценок</h3>
        <div class="radars">
          <canvas id="radarAll" height="300"></canvas>
        </div>
      </div>

      ${renderWeakPointsCard(f)}
    </div>

    ${renderAttendanceCard(f)}

    <h3>Оценки по направлениям (0–${MAX_SCORE})</h3>
    <p style="font-size:13px;color:#666">
      Дата каждой оценки редактируется прямо в шапке таблицы. Для полного редактирования (название, тип, оценки) нажмите ✎ в списке ниже.
    </p>
    <button onclick="openAddAssessModal('${f.id}')">+ Добавить оценку</button>
    ${renderAssessTimeline(f)}
    ${assessTable(f)}

    <h3>Замеры</h3>
    <p style="font-size:13px;color:#666">
      Замеры — это количество повторений упражнений (отжимания, подтягивания, пресс и др.).
      Список доступных замеров редактируется в разделе
      «<a href="#" onclick="state.tab='exercises';state.exTab='measurements';render();return false">Упражнения и замеры → Замеры</a>».
    </p>
    <button onclick="openAddMeasurementModal('${f.id}')">+ Добавить замер</button>
    ${renderMeasurementsGrid(f)}

    <h3>План работы</h3>
    ${workPlanTable(f)}

    <h3>Календарь бойца</h3>
    ${Calendar.render(f.id)}

    <h3>Бои</h3>
    ${fightsTable(f)}

    <div class="actions">
      <button onclick="exportFighterShortPDF('${f.id}')">📄 PDF для бойца</button>
      <button onclick="exportFighterPDF('${f.id}')">📊 PDF для тренера (полный)</button>
      <button onclick="exportAllJSON()">💾 Экспорт базы</button>
    </div>
  `;
  drawRadarAll(f);
  allMeasurementItems().forEach(m => {
    drawMeasurementChart('meas_chart_' + m.id, f, m.id);
  });
}

/* ================== КАРТОЧКА «ПОСЕЩАЕМОСТЬ» ================== */
function renderAttendanceCard(f) {
  const stats = getAttendanceStats(f);
  const now = new Date();
  const monthStats = getAttendanceStatsMonth(f, now.getFullYear(), now.getMonth());

  // Последние 10 отметок
  const recent = (f.attendance || [])
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const recentHtml = recent.map(a => {
    const icon = a.present ? '✅' : '❌';
    const [y, m, d] = a.date.split('-');
    const label = a.present ? 'Был' : 'Отсутствовал';
    return `
      <div class="att-history-item">
        <span class="att-h-date">${d}.${m}.${y} ${String(a.hour).padStart(2,'0')}:00</span>
        <span class="att-h-info">${icon} ${label}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="card" style="border-left:4px solid #22c55e;">
      <h3>Посещаемость</h3>
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 12px;">
        <div style="text-align:center; padding: 10px; background:#f0fdf4; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; color:#166534;">${stats.present}</div>
          <div style="font-size: 12px; color:#166534;">Всего посещений</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#fef2f2; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; color:#991b1b;">${stats.absent}</div>
          <div style="font-size: 12px; color:#991b1b;">Пропусков</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#eff6ff; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; color:#1e40af;">${stats.percent}%</div>
          <div style="font-size: 12px; color:#1e40af;">Явка</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#fefce8; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; color:#854d0e;">${monthStats.present}/${monthStats.total}</div>
          <div style="font-size: 12px; color:#854d0e;">В этом месяце</div>
        </div>
      </div>
      ${recent.length ? `
        <p style="font-size:13px;color:#666;margin:0 0 6px;">Последние отметки</p>
        <div>${recentHtml}</div>
      ` : '<p style="font-size:13px;color:#999;">Отметок ещё нет. Отмечайте посещения в разделе «Отметка».</p>'}
    </div>
  `;
}

/* ================== КАРТОЧКА «СЛАБЫЕ СТОРОНЫ» ================== */
function renderWeakPointsCard(f) {
  const weak = getWeakPoints(f, 6);

  if (!weak.length) {
    const list = sortAssessments(f);
    let hasAnyScore = false;
    list.forEach(a => {
      DB.directions.forEach(d => {
        Object.values(a.data[d.key] || {}).forEach(v => { if (+v > 0) hasAnyScore = true; });
      });
    });

    if (!hasAnyScore) {
      return `
        <div class="card" style="border-left:4px solid #cbd5e1;">
          <h3>Слабые стороны и рекомендации</h3>
          <p style="color:#666;font-size:14px;margin:0;">
            Оценки ещё не выставлены. Добавьте замер, чтобы увидеть анализ.
          </p>
        </div>`;
    }

    return `
      <div class="card" style="border-left:4px solid #22c55e;background:#f0fdf4;">
        <h3>Слабые стороны и рекомендации</h3>
        <p style="color:#166534;font-size:14px;margin:0;">
          🎉 Все критерии выше ${6}/${MAX_SCORE}. Слабых сторон не выявлено.
        </p>
      </div>`;
  }

  const rowsHtml = weak.map(w => {
    const recsHtml = w.recommendations.length
      ? w.recommendations.map(r => `<span class="rec-chip">${r.name}</span>`).join(' ')
      : '<span style="color:#999;font-size:12px;">Нет подходящих упражнений в блоках. Добавьте их в разделе «Упражнения и замеры».</span>';

    const scoreColor = w.score < 3 ? '#dc2626'
                     : w.score < 5 ? '#ea580c'
                     : '#eab308';

    return `
      <div class="weak-row">
        <div class="weak-head">
          <div>
            <b>${w.critName}</b>
            <span class="weak-dir">${w.dirName}</span>
          </div>
          <span class="weak-score" style="background:${scoreColor};">${w.score.toFixed(1)}/${MAX_SCORE}</span>
        </div>
        <div class="weak-recs">${recsHtml}</div>
      </div>
    `;
  }).join('');

  const lastDate = weak[0].assessment?.date;
  const dateLabel = lastDate ? `по замеру от ${formatDateRu(lastDate)}` : '';

  return `
    <div class="card" style="border-left:4px solid #f59e0b;">
      <h3>Слабые стороны и рекомендации</h3>
      <p style="color:#666;font-size:13px;margin-top:0;">
        Критерии ниже ${6}/${MAX_SCORE} ${dateLabel}
      </p>
      <div class="weak-list">
        ${rowsHtml}
      </div>
    </div>
  `;
}

/* ================== TIMELINE, ЗАМЕРЫ, ТАБЛИЦЫ ================== */
function renderAssessTimeline(f) {
  const list = sortAssessments(f);
  if (!list.length) return '<i>нет оценок</i>';
  return `<div class="timeline">
    ${list.map(a => {
      const avg = avgAll(a.data).toFixed(2);
      const typeLabel = a.type === 'start' ? 'Начало сезона'
                      : a.type === 'end' ? 'Конец сезона'
                      : 'Промежуточный';
      return `<div class="tl-item ${a.type}" data-assess-id="${a.id}">
        <div class="tl-info">
          <b>${a.name || formatDateRu(a.date)}</b>
          <small>${formatDateRu(a.date)} • ${typeLabel} • Средний балл: ${avg}/${MAX_SCORE}</small>
        </div>
        <div class="tl-actions">
          <button class="small" onclick="editAssess('${f.id}','${a.id}')">✎</button>
          <button class="small danger" onclick="deleteAssess('${f.id}','${a.id}')">✕</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderMeasurementsGrid(f) {
  const items = allMeasurementItems();
  if (!items.length) return '<i>нет доступных замеров</i>';
  return `<div class="physical-grid">
    ${items.map(m => {
      const list = sortMeasurements(f, m.id);
      const latest = list.length ? list[list.length-1] : null;
      const prev = list.length > 1 ? list[list.length-2] : null;
      const delta = latest && prev ? latest.value - prev.value : null;
      return `
        <div class="physical-card">
          <h4>${m.name} <small style="font-weight:400;color:#888">(${m.unit})</small></h4>
          <div class="latest">
            <span class="val">${latest ? latest.value : '—'}</span>
            <span class="unit">${m.unit}</span>
            ${delta !== null
              ? `<span class="delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}">${delta > 0 ? '+' : ''}${delta}</span>`
              : ''}
          </div>
          <div class="chart-wrap">
            <canvas id="meas_chart_${m.id}" height="130"></canvas>
          </div>
          ${list.length === 0 ? '<div style="text-align:center;color:#999;font-size:12px;margin-top:6px">Нет данных</div>' : ''}
          <div style="margin-top:8px">
            ${list.slice().reverse().slice(0, 3).map(t => `
              <div class="physical-entry">
                <span>${formatDateRu(t.date)}</span>
                <b>${t.value} ${m.unit}</b>
                <button class="small danger" onclick="deleteMeasurement('${f.id}','${t.id}')">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

function assessTable(f) {
  const list = sortAssessments(f);
  return `<div class="assess-wrap"><table class="assess">
    <tr>
      <th>Направление</th><th>Критерий</th>
      ${list.map(a => `
        <th class="col-assess">
          <div class="col-head-name">${(a.name || formatDateRu(a.date)).replace(/</g,'&lt;')}</div>
          <div class="col-head-date">
            <input type="date" class="col-date-mini" value="${a.date}"
                   onchange="inlineUpdateAssessDate('${a.id}',this.value)"
                   title="Изменить дату">
          </div>
          <div class="col-head-type">${
            a.type === 'start' ? 'начало' : a.type === 'end' ? 'конец' : 'промежуточный'
          }</div>
        </th>`).join('')}
    </tr>
    ${DB.directions.map(d => d.criteria.map((c, ci) => `
      <tr>
        ${ci === 0 ? `<td rowspan="${d.criteria.length}"><b>${d.name}</b></td>` : ''}
        <td>${c.name}</td>
        ${list.map(a => {
          const val = (a.data[d.key] && a.data[d.key][c.key]) || 0;
          return `<td>
            <input type="number" min="0" max="${MAX_SCORE}" value="${val}"
                   onchange="setScore('${a.id}','${d.key}','${c.key}',this.value)" style="width:70px"/>
          </td>`;
        }).join('')}
      </tr>`).join('')).join('')}
  </table></div>`;
}

function workPlanTable(f) {
  const items = allExerciseItems();
  return `
    <button onclick="addWorkWeek()">+ Неделя</button>
    <table>
      <tr><th>Неделя</th><th>Упражнение</th><th>Вариант</th><th></th></tr>
      ${f.workPlan.map((w,i) => `
        <tr>
          <td>${w.week}</td>
          <td>
            <select onchange="updPlan(${i},'blockId',this.value)">
              ${items.map(b=>`<option value="${b.id}" ${w.blockId===b.id?'selected':''}>${b.fullName}</option>`).join('')}
            </select>
          </td>
          <td>
            <select onchange="updPlan(${i},'mode',this.value)">
              <option value="self" ${w.mode==='self'?'selected':''}>Самостоятельно</option>
              <option value="personal" ${w.mode==='personal'?'selected':''}>Индивидуально</option>
              <option value="group" ${w.mode==='group'?'selected':''}>Работа в группе</option>
            </select>
          </td>
          <td>
            <button onclick="delPlan(${i})" class="danger small">✕</button>
          </td>
        </tr>`).join('')}
    </table>`;
}

window.addWorkWeek = () => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  const first = allExerciseItems()[0];
  if (!first) return toast('Сначала добавьте упражнения','error');
  f.workPlan.push({ week: f.workPlan.length + 1, blockId: first.id, mode: 'self' });
  saveData(DB); renderFighterDetail();
};
window.updPlan = (i, k, v) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  f.workPlan[i][k] = v; saveData(DB);
};
window.delPlan = i => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  f.workPlan.splice(i,1); saveData(DB); renderFighterDetail();
};

function fightsTable(f) {
  return `
    <button onclick="addFight()">+ Бой</button>
    <table>
      <tr><th>Дата</th><th>Вес. категория</th><th>Соперник</th><th>Результат</th><th>Примечание</th><th></th></tr>
      ${f.fights.map((fg,i) => `
        <tr>
          <td>${fg.date}</td><td>${fg.weightClass}</td><td>${fg.opponent}</td>
          <td>${fg.result}</td><td>${fg.note}</td>
          <td><button onclick="delFight(${i})" class="danger small">✕</button></td>
        </tr>`).join('') || '<tr><td colspan="6" style="color:#999;text-align:center">Нет боёв</td></tr>'}
    </table>`;
}
window.addFight = () => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  const date = prompt('Дата (YYYY-MM-DD):'); if (!date) return;
  const weightClass = prompt('Весовая категория:') || '';
  const opponent = prompt('Соперник:') || '';
  const result = prompt('Результат (победа/поражение/ничья):') || '';
  const note = prompt('Примечание:') || '';
  f.fights.push({ date, weightClass, opponent, result, note });
  saveData(DB); renderFighterDetail();
};
window.delFight = i => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  f.fights.splice(i,1); saveData(DB); renderFighterDetail();
};

window.upd = (field, val) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  f[field] = val; saveData(DB);
};
window.updBirth = (val) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  f.birthDate = val;
  f.age = val ? calcAge(val) : '';
  saveData(DB);
  const badge = document.getElementById('ageBadge');
  if (badge) badge.textContent = f.age === '' ? '—' : `${f.age} лет`;
};
window.delFighter = id => {
  if (!confirm('Удалить бойца?')) return;
  DB.fighters = DB.fighters.filter(x => x.id !== id);
  saveData(DB); state.tab = 'fighters'; render();
};
window.uploadPhoto = e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    const f = DB.fighters.find(x => x.id === state.currentFighter);
    f.photo = ev.target.result; saveData(DB);
    document.getElementById('fphoto').src = ev.target.result;
  };
  r.readAsDataURL(file);
};