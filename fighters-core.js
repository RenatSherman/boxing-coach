/* ============================================================
   FIGHTERS-CORE.JS — тренировки, создание бойца, фото
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
  const groups = getFighterGroups();

  const groupsForList = groups.map(g => ({
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

  // Генерируем кнопки для групп
  const groupButtonsHtml = groups.map(g => {
    const count = DB.fighters.filter(f => f.group === g.key).length;
    if (!count) return '';
    return `<button type="button" class="group-pick-btn" data-group="${g.key}" onclick="toggleGroupSelect('${g.key}', event)">
      ${g.name} (${count})
    </button>`;
  }).join('');

  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Назначить тренировку</h3>
      <label>Дата</label>
      <input id="tr_date" type="date" value="${presetDate || todayStr()}">
      
      <div style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label>Час</label>
          <select id="tr_hour">
            ${Array.from({length: 17}, (_,i)=>i+6).map(h =>
              `<option value="${h}" ${h === selectedHour ? 'selected' : ''}>${String(h).padStart(2,'0')}:00</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;">
          <label>Формат</label>
          <select id="tr_mode">
            <option value="self">Самостоятельно</option>
            <option value="personal">Индивидуально</option>
            <option value="group">Группа</option>
          </select>
        </div>
      </div>

      <label>Упражнение (необязательно)</label>
      <select id="tr_block">
        ${exerciseOptionsHtml}
      </select>

      <label>Комментарий</label>
      <textarea id="tr_comment" placeholder="Заметки к тренировке…" rows="2"></textarea>

      <label style="margin-top:16px; font-size:16px; font-weight:600;">Кому назначить</label>
      
      <!-- Кнопки быстрого выбора групп -->
      <div class="group-pick-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
        ${groupButtonsHtml}
        <button type="button" class="group-pick-btn" onclick="pickAll(event)">Все бойцы</button>
        <button type="button" class="group-pick-btn" onclick="clearAllFighters(event)" style="background:#fef2f2; color:#e63946; border-color:#fee2e2;">Очистить</button>
      </div>

      <!-- Выпадающий список для точечного выбора -->
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

      <div class="modal-actions" style="margin-top:20px;">
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
    
    if (presetFighterId) {
      const btn = document.getElementById('tr_dropdown_btn');
      if (btn) btn.classList.add('open');
      const menu = document.getElementById('tr_dropdown_menu');
      if (menu) menu.classList.add('open');
    }
  }, 30);
};

// Логика переключения целой группы
window.toggleGroupSelect = (groupKey, e) => {
  if (e) e.stopPropagation();
  const checkboxes = [...document.querySelectorAll('#tr_dropdown_menu .tr_fighter')];
  const groupFighters = checkboxes.filter(cb => {
    const f = DB.fighters.find(x => x.id === cb.value);
    return f && f.group === groupKey;
  });

  const allChecked = groupFighters.every(cb => cb.checked);
  groupFighters.forEach(cb => cb.checked = !allChecked);
  
  const btn = document.querySelector(`.group-pick-btn[data-group="${groupKey}"]`);
  if (btn) {
    if (!allChecked) {
      btn.style.background = '#e63946';
      btn.style.color = '#fff';
      btn.style.borderColor = '#e63946';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }

  updateFightersDropdownText();
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

window.pickAll = (e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => cb.checked = true);
  document.querySelectorAll('.group-pick-btn').forEach(btn => {
    btn.style.background = '#e63946'; btn.style.color = '#fff'; btn.style.borderColor = '#e63946';
  });
  updateFightersDropdownText();
};

window.clearAllFighters = (e) => {
  if (e) e.stopPropagation();
  document.querySelectorAll('#tr_dropdown_menu .tr_fighter').forEach(cb => cb.checked = false);
  document.querySelectorAll('.group-pick-btn').forEach(btn => {
    btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
  });
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
  const groups = getFighterGroups();
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
        ${groups.map(g => `<option value="${g.key}">${g.name}</option>`).join('')}
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

/* ================== БАЗОВЫЕ ДАННЫЕ ================== */
window.upd = (field, val) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  if (!f) return;
  f[field] = val; saveData(DB);
};

window.updBirth = (val) => {
  const f = DB.fighters.find(x => x.id === state.currentFighter);
  if (!f) return;
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

/* ================== ЗАГРУЗКА ФОТО СО СЖАТИЕМ ================== */
window.uploadPhoto = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast('Это не изображение', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();

    img.onload = () => {
      const MAX_SIDE = 300;
      let w = img.width;
      let h = img.height;

      if (w > h && w > MAX_SIDE) {
        h = Math.round(h * MAX_SIDE / w);
        w = MAX_SIDE;
      } else if (h > w && h > MAX_SIDE) {
        w = Math.round(w * MAX_SIDE / h);
        h = MAX_SIDE;
      } else if (w === h && w > MAX_SIDE) {
        w = MAX_SIDE;
        h = MAX_SIDE;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      } catch (err) {
        toast('Не удалось обработать фото', 'error');
        return;
      }

      const sizeKB = Math.round(dataUrl.length / 1024);
      if (sizeKB > 200) {
        const ok = confirm(`Фото весит ${sizeKB} КБ. Это больше обычного.\n\nВсё равно сохранить?`);
        if (!ok) return;
      }

      const f = DB.fighters.find(x => x.id === state.currentFighter);
      if (!f) {
        toast('Боец не найден', 'error');
        return;
      }

      f.photo = dataUrl;
      saveData(DB);

      const imgEl = document.getElementById('fphoto');
      if (imgEl) imgEl.src = dataUrl;

      toast(`Фото сохранено (${sizeKB} КБ)`, 'ok');
    };

    img.onerror = () => {
      toast('Не удалось прочитать изображение', 'error');
    };

    img.src = e.target.result;
  };

  reader.onerror = () => {
    toast('Не удалось прочитать файл', 'error');
  };

  reader.readAsDataURL(file);
};