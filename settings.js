/* ============================================================
   SETTINGS.JS — настройки, управление группами и направлениями
   ============================================================ */

function renderSettings() {
  const u = Cloud.getUser();
  app.innerHTML = `
    <h2>Настройки</h2>

    <div class="card">
      <h3>Аккаунт</h3>
      <p>Статус: <span class="cloud-status auth">🟢 Вход выполнен</span></p>
      ${u.userEmail ? `<p style="font-size:13px;color:#666">Email: <b>${u.userEmail}</b></p>` : ''}
      ${u.userId ? `<p style="font-size:11px;color:#aaa;word-break:break-all">ID: ${u.userId}</p>` : ''}
      <p style="font-size:13px;color:#666">Данные синхронизируются между всеми устройствами, где вы вошли под этим email.</p>
      <button onclick="logoutCloud()" class="danger">Выйти</button>
    </div>

    <div class="card">
      <h3>Тренер</h3>
      <p><label>Имя: <input value="${DB.settings.coachName}" onchange="updSetting('coachName',this.value)"/></label></p>
      <p><label>Сезон: <input value="${DB.settings.season}" onchange="updSetting('season',this.value)"/></label></p>
      <p><label><input type="checkbox" ${DB.settings.notifications?'checked':''}
          onchange="updSetting('notifications',this.checked)"/> Уведомления о тренировках</label></p>
    </div>

    <div class="card">
      <h3>Направления и критерии (для оценок)</h3>
      <p style="font-size:13px;color:#666">
        Изменения применяются ко всем бойцам. Переименование не сбрасывает оценки.
      </p>
      ${DB.directions.map((d, di) => `
        <div style="border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b>${d.name}</b>
            <button class="small" onclick="renameDirection(${di})">✎ Направление</button>
            <button class="small danger" onclick="deleteDirection(${di})">Удалить</button>
          </div>
          <ul style="margin:8px 0 0 20px">
            ${d.criteria.map((c, ci) => `<li style="margin:4px 0">
              ${c.name}
              <button class="small" onclick="renameCriterion(${di},${ci})">✎</button>
              <button class="small danger" onclick="deleteCriterion(${di},${ci})">✕</button>
            </li>`).join('')}
          </ul>
          <button class="small" style="margin-top:8px" onclick="addCriterion(${di})">+ Критерий</button>
        </div>
      `).join('')}
      <button onclick="addDirection()">+ Добавить направление</button>
    </div>

    <div class="card">
      <h3>Данные</h3>
      <button onclick="exportAllJSON()">💾 Экспорт JSON</button>
      <label class="file-btn">
        📥 Импорт JSON
        <input type="file" accept="application/json" onchange="importAllJSON(event)" hidden/>
      </label>
    </div>
  `;
}

window.logoutCloud = async () => {
  if (!confirm('Выйти из аккаунта? Данные останутся в облаке.')) return;
  try { await Cloud.logout(); toast('Вы вышли', 'ok'); }
  catch (e) { toast('Ошибка выхода: ' + e.message, 'error'); }
};

window.updSetting = (k, v) => { DB.settings[k] = v; saveData(DB); };

/* ================== УПРАВЛЕНИЕ ГРУППАМИ БОЙЦОВ ================== */
window.openAddGroupModal = () => {
  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Новая группа бойцов</h3>
      <label>Название группы</label>
      <input id="newGroupName" placeholder="Например, Подростки" autofocus>
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;">
        <input type="checkbox" id="newGroupIsKids" style="width:auto;margin:0;">
        <span>Детская группа</span>
      </label>
      <p style="font-size:12px;color:#888;margin:6px 0 0;">
        Галочка влияет на кнопку «Все дети» в календаре.
      </p>
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitAddGroup()">Создать</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('newGroupName')?.focus(), 50);
};

window.submitAddGroup = () => {
  const nameInput = document.getElementById('newGroupName');
  const name = nameInput ? nameInput.value.trim() : '';
  const isKids = document.getElementById('newGroupIsKids')?.checked || false;

  if (!name) { toast('Введите название группы', 'error'); return; }

  const exists = getFighterGroups().some(g => g.name.toLowerCase() === name.toLowerCase());
  if (exists) { toast('Группа с таким названием уже есть', 'error'); return; }

  DB.fighterGroups = DB.fighterGroups || [];
  DB.fighterGroups.push({
    key: 'g_' + uid(),
    name,
    isKids
  });
  saveData(DB);
  Modal.close();
  toast('Группа добавлена', 'ok');
  render();
};

window.openRenameGroupModal = (gi) => {
  const g = getFighterGroups()[gi];
  if (!g) return;
  Modal.open(`
    <div class="modal" onclick="event.stopPropagation()">
      <h3>Переименовать группу</h3>
      <label>Название</label>
      <input id="renameGroupName" value="${g.name}" autofocus>
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;">
        <input type="checkbox" id="renameGroupIsKids" style="width:auto;margin:0;" ${g.isKids?'checked':''}>
        <span>Детская группа</span>
      </label>
      <div class="modal-actions">
        <button class="secondary" onclick="Modal.close()">Отмена</button>
        <button class="primary" onclick="submitRenameGroup(${gi})">Сохранить</button>
      </div>
    </div>
  `);
  setTimeout(() => {
    const inp = document.getElementById('renameGroupName');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
};

window.submitRenameGroup = (gi) => {
  const g = getFighterGroups()[gi];
  if (!g) return;
  const nameInput = document.getElementById('renameGroupName');
  const name = nameInput ? nameInput.value.trim() : '';
  const isKids = document.getElementById('renameGroupIsKids')?.checked || false;

  if (!name) { toast('Введите название', 'error'); return; }

  g.name = name;
  g.isKids = isKids;
  saveData(DB);
  Modal.close();
  toast('Группа обновлена', 'ok');
  render();
};

window.deleteFighterGroup = (gi) => {
  const groups = getFighterGroups();
  const g = groups[gi];
  if (!g) return;

  const fightersInGroup = DB.fighters.filter(f => f.group === g.key);
  if (fightersInGroup.length > 0) {
    alert(
      `Нельзя удалить группу «${g.name}».\n\n` +
      `В ней ${fightersInGroup.length} бойц${fightersInGroup.length === 1 ? '' : 'ов'}.\n\n` +
      `Сначала переведите их в другую группу, потом удаляйте.`
    );
    return;
  }

  if (groups.length <= 1) {
    alert('Нельзя удалить последнюю группу. Должна остаться хотя бы одна.');
    return;
  }

  if (!confirm(`Удалить группу «${g.name}»?`)) return;

  DB.fighterGroups.splice(gi, 1);
  saveData(DB);
  toast('Группа удалена', 'ok');
  render();
};

/* ================== УПРАВЛЕНИЕ НАПРАВЛЕНИЯМИ ================== */
window.addDirection = () => {
  const name = prompt('Название направления:'); if (!name) return;
  const newDir = { key: 'd_' + uid(), name, criteria: [] };
  DB.directions.push(newDir);
  DB.fighters.forEach(f => {
    (f.assessments || []).forEach(a => { a.data[newDir.key] = {}; });
  });
  saveData(DB); render();
};
window.renameDirection = (di) => {
  const name = prompt('Новое название:', DB.directions[di].name);
  if (name) { DB.directions[di].name = name; saveData(DB); render(); }
};
window.deleteDirection = (di) => {
  if (!confirm('Удалить направление и все его оценки?')) return;
  const key = DB.directions[di].key;
  DB.fighters.forEach(f => {
    (f.assessments || []).forEach(a => { delete a.data[key]; });
  });
  DB.directions.splice(di, 1);
  saveData(DB); render();
};
window.addCriterion = (di) => {
  const name = prompt('Название критерия:'); if (!name) return;
  const cKey = 'c_' + uid();
  DB.directions[di].criteria.push({ key: cKey, name });
  DB.fighters.forEach(f => {
    (f.assessments || []).forEach(a => {
      if (!a.data[DB.directions[di].key]) a.data[DB.directions[di].key] = {};
      a.data[DB.directions[di].key][cKey] = 0;
    });
  });
  saveData(DB); render();
};
window.renameCriterion = (di, ci) => {
  const name = prompt('Новое название:', DB.directions[di].criteria[ci].name);
  if (name) { DB.directions[di].criteria[ci].name = name; saveData(DB); render(); }
};
window.deleteCriterion = (di, ci) => {
  if (!confirm('Удалить критерий и его оценки?')) return;
  const cKey = DB.directions[di].criteria[ci].key;
  const dKey = DB.directions[di].key;
  DB.fighters.forEach(f => {
    (f.assessments || []).forEach(a => {
      if (a.data[dKey]) delete a.data[dKey][cKey];
    });
  });
  DB.directions[di].criteria.splice(ci, 1);
  saveData(DB); render();
};