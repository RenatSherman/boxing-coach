/* ============================================================
   FIGHTER-DETAIL.JS — экран бойца и все его карточки
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
      <button onclick="openAddFighterModal()" style="flex:1;">+ Добавить бойца</button>
      <button onclick="openAddGroupModal()" class="ghost" style="flex:1;">+ Группа</button>
    </div>
    
    <div class="fighters-accordion-list">
      ${groups.map(g => `
        <details class="fighters-group-acc">
          <summary>
            <div class="summary-left">
              <b>${g.name}</b>
              <span class="badge-count">${g.fighters.length}</span>
            </div>
            <div class="group-actions-mini" onclick="event.preventDefault(); event.stopPropagation();">
              <button onclick="openRenameGroupModal(${g.gi})" title="Переименовать">✎</button>
              <button class="danger" onclick="deleteFighterGroup(${g.gi})" title="Удалить">✕</button>
            </div>
          </summary>
          <div class="fighters-grid" style="padding:12px;">
            ${g.fighters.map(fighterCard).join('') || '<div style="color:#999; font-size:14px; padding:10px;">В группе пока нет бойцов</div>'}
          </div>
        </details>
      `).join('')}
    </div>
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
    <div class="rating-badge">⭐ ${avg}/${MAX_SCORE}</div>
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
    <button class="ghost small" onclick="state.tab='fighters';render()" style="margin-bottom:12px;">← Назад к списку</button>
    <h2>${f.name} <span style="font-size:15px;color:#666;font-weight:400">— ${ageText} • ${groupName(f.group)}</span></h2>

    <div class="grid" style="grid-template-columns: 1fr;">
      <!-- Карточка профиля -->
      <div class="card profile-card">
        <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
          <div style="text-align:center;">
            <img id="fphoto" src="${f.photo || 'https://via.placeholder.com/120'}" width="90" style="border-radius:50%; object-fit:cover; width:90px; height:90px; margin-bottom:8px;"/>
            <label class="file-btn small" style="font-size:12px; padding:6px 10px;">
              📷 Фото
              <input type="file" accept="image/*" onchange="uploadPhoto(event)" hidden/>
            </label>
          </div>
          <div style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:10px;">
            <label style="margin:0;">ФИО <input value="${f.name}" onchange="upd('name',this.value)"/></label>
            <div style="display:flex; gap:8px;">
              <label style="margin:0; flex:1;">Рост <input type="number" value="${f.height}" onchange="upd('height',this.value)"/></label>
              <label style="margin:0; flex:1;">Вес <input type="number" value="${f.weight}" onchange="upd('weight',this.value)"/></label>
            </div>
            <label style="margin:0;">Дата рождения <input type="date" value="${f.birthDate}" onchange="updBirth(this.value)"/></label>
            <div style="display:flex; gap:8px;">
              <label style="margin:0; flex:1;">Стойка
                <select onchange="upd('stance',this.value)">
                  <option value="right" ${f.stance==='right'?'selected':''}>Правша</option>
                  <option value="left" ${f.stance==='left'?'selected':''}>Левша</option>
                </select>
              </label>
              <label style="margin:0; flex:1;">Группа
                <select onchange="upd('group',this.value)">
                  ${groups.map(g => `<option value="${g.key}" ${f.group===g.key?'selected':''}>${g.name}</option>`).join('')}
                </select>
              </label>
            </div>
          </div>
        </div>
        <button onclick="delFighter('${f.id}')" class="danger" style="width:100%; margin-top:16px; background:#fef2f2; color:#e63946; border:1px solid #fee2e2;">Удалить бойца</button>
      </div>

      <!-- Динамика -->
      <div class="card">
        <h3>Динамика оценок</h3>
        <div class="radars"><canvas id="radarAll" height="260"></canvas></div>
      </div>

      ${renderWeakPointsCard(f)}
    </div>

    ${renderAttendanceCard(f)}

    <!-- Оценки (В виде карточек) -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; margin-bottom:12px;">
      <h3 style="margin:0;">История оценок</h3>
      <button onclick="openAddAssessModal('${f.id}')" class="small success">+ Оценка</button>
    </div>
    ${renderAssessTimeline(f)}

    <!-- Замеры -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; margin-bottom:12px;">
      <h3 style="margin:0;">Замеры</h3>
      <button onclick="openAddMeasurementModal('${f.id}')" class="small success">+ Замер</button>
    </div>
    ${renderMeasurementsGrid(f)}

    <h3 style="margin-top:24px;">План работы</h3>
    ${workPlanTable(f)}

    <h3 style="margin-top:24px;">Календарь бойца</h3>
    ${Calendar.render(f.id)}

    <h3 style="margin-top:24px;">Бои</h3>
    ${fightsTable(f)}

    <div class="actions" style="margin-top:30px; border-top:1px solid #ddd; padding-top:20px;">
      <button onclick="exportFighterShortPDF('${f.id}')" class="ghost" style="flex:1;">📄 PDF для бойца</button>
      <button onclick="exportFighterPDF('${f.id}')" style="flex:1;">📊 PDF для тренера</button>
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

  return `
    <div class="card" style="border-left:4px solid #22c55e; margin-top:12px;">
      <h3>Посещаемость</h3>
      <div class="grid" style="grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;">
        <div style="text-align:center; padding: 10px; background:#f0fdf4; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 700; color:#166534;">${stats.present}</div>
          <div style="font-size: 11px; color:#166534;">Был</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#fef2f2; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 700; color:#991b1b;">${stats.absent}</div>
          <div style="font-size: 11px; color:#991b1b;">Пропуск</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#eff6ff; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 700; color:#1e40af;">${stats.percent}%</div>
          <div style="font-size: 11px; color:#1e40af;">Явка</div>
        </div>
        <div style="text-align:center; padding: 10px; background:#fefce8; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 700; color:#854d0e;">${monthStats.present}/${monthStats.total}</div>
          <div style="font-size: 11px; color:#854d0e;">В месяце</div>
        </div>
      </div>
      ${stats.cancelled ? `<div style="font-size:12px; color:#666; text-align:center;">Отменено тренером: <b>${stats.cancelled}</b></div>` : ''}
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
      return `<div class="card" style="border-left:4px solid #cbd5e1;"><h3>Слабые стороны</h3><p style="color:#666;font-size:14px;margin:0;">Оценок пока нет.</p></div>`;
    }
    return `<div class="card" style="border-left:4px solid #22c55e;background:#f0fdf4;"><h3>Слабые стороны</h3><p style="color:#166534;font-size:14px;margin:0;">🎉 Все критерии в норме!</p></div>`;
  }

  const rowsHtml = weak.map(w => {
    const recsHtml = w.recommendations.length
      ? w.recommendations.map(r => `<span class="rec-chip">${r.name}</span>`).join(' ')
      : '<span style="color:#999;font-size:12px;">Нет упражнений.</span>';

    const scoreColor = w.score < 3 ? '#dc2626' : w.score < 5 ? '#ea580c' : '#eab308';

    return `
      <div class="weak-row">
        <div class="weak-head">
          <div><b>${w.critName}</b> <span class="weak-dir">${w.dirName}</span></div>
          <span class="weak-score" style="background:${scoreColor};">${w.score.toFixed(1)}</span>
        </div>
        <div class="weak-recs">${recsHtml}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="card" style="border-left:4px solid #f59e0b;">
      <h3>Слабые стороны</h3>
      <div class="weak-list">${rowsHtml}</div>
    </div>
  `;
}

/* ================== ОЦЕНКИ В ВИДЕ КАРТОЧЕК ================== */
function renderAssessTimeline(f) {
  const list = sortAssessments(f).reverse(); // Новые сверху
  if (!list.length) return '<i>нет оценок</i>';
  
  return `<div class="assess-history-list">
    ${list.map(a => {
      const avg = avgAll(a.data).toFixed(2);
      const typeLabel = a.type === 'start' ? 'Начало сезона' : a.type === 'end' ? 'Конец сезона' : 'Промежуточный';
      const typeColor = a.type === 'start' ? '#87CEEB' : a.type === 'end' ? '#4A90E2' : '#f59e0b';
      
      return `
        <div class="assess-history-item" style="border-left-color: ${typeColor};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <b style="font-size:15px;">${a.name || formatDateRu(a.date)}</b>
              <div style="font-size:12px; color:#666; margin-top:2px;">${formatDateRu(a.date)} • ${typeLabel}</div>
            </div>
            <div class="rating-badge" style="margin:0; font-size:14px;">${avg} / ${MAX_SCORE}</div>
          </div>
          
          <div style="display:flex; gap:6px; margin-top:10px;">
            <button class="ghost small" style="flex:1;" onclick="editAssess('${f.id}','${a.id}')">✎ Редактировать</button>
            <button class="danger small" style="width:40px;" onclick="deleteAssess('${f.id}','${a.id}')">✕</button>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

/* ================== ЗАМЕРЫ В ВИДЕ КАРТОЧЕК ================== */
function renderMeasurementsGrid(f) {
  const items = allMeasurementItems();
  if (!items.length) return '<i>нет доступных замеров</i>';
  return `<div class="physical-grid" style="grid-template-columns: 1fr;">
    ${items.map(m => {
      const list = sortMeasurements(f, m.id);
      const latest = list.length ? list[list.length-1] : null;
      const prev = list.length > 1 ? list[list.length-2] : null;
      const delta = latest && prev ? latest.value - prev.value : null;
      return `
        <div class="physical-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 style="margin:0;">${m.name} <small style="font-weight:400;color:#888">(${m.unit})</small></h4>
            <div class="latest" style="margin:0;">
              <span class="val" style="font-size:22px;">${latest ? latest.value : '—'}</span>
              ${delta !== null ? `<span class="delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}">${delta > 0 ? '+' : ''}${delta}</span>` : ''}
            </div>
          </div>
          
          <div class="chart-wrap" style="height:100px;">
            <canvas id="meas_chart_${m.id}"></canvas>
          </div>
          
          ${list.length === 0 ? '<div style="text-align:center;color:#999;font-size:12px;margin-top:6px">Нет данных</div>' : ''}
          
          <div style="margin-top:10px;">
            ${list.slice().reverse().slice(0, 3).map(t => `
              <div class="physical-entry" style="padding:6px 0;">
                <span>${formatDateRu(t.date)}</span>
                <b>${t.value} ${m.unit}</b>
                <button class="small danger" style="padding:2px 6px;" onclick="deleteMeasurement('${f.id}','${t.id}')">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

function workPlanTable(f) {
  const items = allExerciseItems();
  return `
    <button onclick="addWorkWeek()" class="small ghost" style="margin-bottom:12px;">+ Добавить неделю</button>
    <div class="table-wrap">
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
                <option value="self" ${w.mode==='self'?'selected':''}>Самост.</option>
                <option value="personal" ${w.mode==='personal'?'selected':''}>Индивид.</option>
                <option value="group" ${w.mode==='group'?'selected':''}>Группа</option>
              </select>
            </td>
            <td><button onclick="delPlan(${i})" class="danger small">✕</button></td>
          </tr>`).join('')}
      </table>
    </div>`;
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
    <button onclick="addFight()" class="small ghost" style="margin-bottom:12px;">+ Добавить бой</button>
    <div class="table-wrap">
      <table>
        <tr><th>Дата</th><th>Соперник</th><th>Рез.</th><th></th></tr>
        ${f.fights.map((fg,i) => `
          <tr>
            <td>${fg.date}</td>
            <td>${fg.opponent}<br><small style="color:#666">${fg.weightClass||''}</small></td>
            <td>${fg.result}</td>
            <td><button onclick="delFight(${i})" class="danger small">✕</button></td>
          </tr>`).join('') || '<tr><td colspan="4" style="color:#999;text-align:center">Нет боёв</td></tr>'}
      </table>
    </div>`;
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