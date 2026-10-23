/* ============================================================
   FIGHTERS.JS — отрисовка списка и карточки бойца
   ============================================================
   Зависимости: fighters-core.js, assessments.js, measurements.js.
   ============================================================ */

function renderFighters() {
  const groups = getFighterGroups().map((g, gi) => ({
    ...g,
    gi,
    fighters: DB.fighters.filter(f => f.group === g.key)
  }));

  app.innerHTML = `
    <h2>Бойцы</h2>
    <div class="row" style="margin-bottom:16px">
      <button onclick="openAddFighterModal()">+ Добавить бойца</button>
      <button onclick="openAddGroupModal()">+ Добавить группу</button>
    </div>
    ${groups.map(g => `
      <div class="group-head">
        <h3>${g.name} (${g.fighters.length})</h3>
        <div class="group-actions">
          <button onclick="openRenameGroupModal(${g.gi})" title="Переименовать группу">✎</button>
          <button class="danger" onclick="deleteFighterGroup(${g.gi})" title="Удалить группу">✕</button>
        </div>
      </div>
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
  const groups = getFighterGroups();

  app.innerHTML = `
    <button onclick="state.tab='fighters';render()">← Назад</button>
    <h2>${f.name} <span style="font-size:16px;color:#666;font-weight:400">— ${ageText} • ${groupName(f.group)}</span></h2>

    <div class="grid">
      <div class="card">
        <img id="fphoto" src="${f.photo || 'https://via.placeholder.com/120'}" width="120"/>
        <input type="file" accept="image/*" onchange="uploadPhoto(event)"/>
        <p style="font-size:12px;color:#888;margin-top:4px;">
          Фото автоматически сжимается до 300×300 — чтобы не переполнять память.
        </p>
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
            ${groups.map(g => `<option value="${g.key}" ${f.group===g.key?'selected':''}>${g.name}</option>`).join('')}
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

function renderAttendanceCard(f) {
  const stats = getAttendanceStats(f);
  const now = new Date();
  const monthStats = getAttendanceStatsMonth(f, now.getFullYear(), now.getMonth());

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