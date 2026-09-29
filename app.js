/* ============================================================
   APP.JS — роутинг, окна, дашборд, сравнение, настройки, init
   ============================================================ */

/* ================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ================== */
const app = document.getElementById('app');
const state = { tab: 'dashboard', currentFighter: null, exTab: 'exercises' };

/* ================== НАВИГАЦИЯ ================== */
document.querySelectorAll('#mainNav button').forEach(b => {
  b.onclick = () => { state.tab = b.dataset.tab; render(); toggleMenu(false); };
});
document.getElementById('menuToggle').onclick = () => toggleMenu();
function toggleMenu(force) {
  const nav = document.getElementById('mainNav');
  const open = force !== undefined ? force : !nav.classList.contains('open');
  nav.classList.toggle('open', open);
}

/* ================== МОДАЛЬНЫЕ ОКНА ================== */
const Modal = (() => {
  const root = () => document.getElementById('modalRoot');
  function open(html) {
    root().innerHTML = `<div class="modal-overlay" onclick="Modal.closeOnOverlay(event)">${html}</div>`;
  }
  function close() { root().innerHTML = ''; }
  function closeOnOverlay(e) {
    if (e.target.classList.contains('modal-overlay')) close();
  }
  return { open, close, closeOnOverlay };
})();
window.Modal = Modal;

/* ================== ЭКРАН ВХОДА ================== */
const LockScreen = (() => {
  function showTab(name) {
    document.getElementById('tabLogin').classList.toggle('active', name === 'login');
    document.getElementById('tabRegister').classList.toggle('active', name === 'register');
    document.getElementById('paneLogin').style.display = name === 'login' ? 'block' : 'none';
    document.getElementById('paneRegister').style.display = name === 'register' ? 'block' : 'none';
    document.getElementById('loginError').textContent = '';
    document.getElementById('regError').textContent = '';
  }
  async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    err.textContent = '';
    if (!email || !pass) { err.textContent = 'Введите email и пароль'; return; }
    try { await Cloud.login(email, pass); toast('Вход выполнен', 'ok'); }
    catch (e) { err.textContent = translateError(e.message); }
  }
  async function doRegister() {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPass2').value;
    const err = document.getElementById('regError');
    err.textContent = '';
    if (!email || !pass) { err.textContent = 'Введите email и пароль'; return; }
    if (pass.length < 6) { err.textContent = 'Пароль минимум 6 символов'; return; }
    if (pass !== pass2) { err.textContent = 'Пароли не совпадают'; return; }
    try { await Cloud.register(email, pass); toast('Регистрация успешна', 'ok'); }
    catch (e) { err.textContent = translateError(e.message); }
  }
  function translateError(msg) {
    if (!msg) return 'Неизвестная ошибка';
    if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль';
    if (msg.includes('User already registered')) return 'Такой email уже зарегистрирован. Войдите.';
    if (msg.includes('Email not confirmed')) return 'Подтверждение email включено. Отключите его в Supabase.';
    if (msg.includes('Password should be at least')) return 'Пароль слишком короткий';
    if (msg.includes('Unable to validate email')) return 'Некорректный email';
    if (msg.includes('For security purposes')) return 'Слишком часто. Подождите минуту.';
    return msg;
  }
  function init() {
    document.getElementById('loginPass').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
    document.getElementById('regPass2').onkeydown = e => { if (e.key === 'Enter') doRegister(); };
  }
  return { init, showTab, doLogin, doRegister };
})();
window.LockScreen = LockScreen;

/* ================== РОУТИНГ ================== */
function render() {
  if (state.tab === 'dashboard') renderDashboard();
  else if (state.tab === 'fighters') renderFighters();
  else if (state.tab === 'reports') app.innerHTML = Reports.render();
  else if (state.tab === 'compare') renderCompare();
  else if (state.tab === 'exercises') renderExercisesAndMeasurements();
  else if (state.tab === 'settings') renderSettings();
}

/* ================== ДАШБОРД ================== */
function renderDashboard() {
  const kidsJunior = DB.fighters.filter(f => f.group === 'kids_junior');
  const kidsMiddle = DB.fighters.filter(f => f.group === 'kids_middle');
  const adults = DB.fighters.filter(f => f.group === 'adults');
  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '—';
  const fighterAvg = f => {
    const end = getEndAssess(f);
    return end ? avgAll(end.data) : 0;
  };
  const top = [...DB.fighters].sort((a,b)=>fighterAvg(b)-fighterAvg(a)).slice(0,3);

  const forgotten = getForgottenFighters(14);
  const recent = getRecentTrainings(15);

  app.innerHTML = `
    <h2>Дашборд</h2>
    <div class="grid">
      <div class="card"><h3>Младшая группа</h3><p class="big">${kidsJunior.length}</p></div>
      <div class="card"><h3>Средняя группа</h3><p class="big">${kidsMiddle.length}</p></div>
      <div class="card"><h3>Взрослые</h3><p class="big">${adults.length}</p></div>
      <div class="card"><h3>Средний рост</h3><p class="big">${avg(DB.fighters.map(f=>+f.height))} см</p></div>
    </div>

    <div class="card">
      <h3>⚠️ Требуют внимания (${forgotten.length})</h3>
      ${forgotten.length === 0
        ? '<p style="color:#16a34a">Все бойцы тренируются регулярно. Отлично!</p>'
        : `<p style="font-size:13px;color:#666;margin-bottom:8px">Бойцы без тренировок 14+ дней</p>
          <ul class="forgotten-list">
            ${forgotten.map(({fighter, daysAgo}) => `
              <li class="forgotten-item" onclick="openFighter('${fighter.id}')">
                <div class="info">
                  <b>${fighter.name}</b>
                  <small>${groupName(fighter.group)}</small>
                </div>
                <span class="days">
                  ${daysAgo === null ? 'Нет тренировок' : daysAgo + ' дн.'}
                </span>
              </li>
            `).join('')}
          </ul>`
      }
    </div>

    <h3>Календарь тренера</h3>
    ${CoachCalendar.render()}

    ${renderRecentTrainingsCard(recent)}

    <h3>Топ-3 бойца (конец сезона, из ${MAX_SCORE})</h3>
    <ol>${top.map(f=>`<li>${f.name} — ${fighterAvg(f).toFixed(2)}</li>`).join('') || '<i>нет данных</i>'}</ol>
    <h3>Динамика сезона</h3>
    <canvas id="dashChart" height="120"></canvas>
  `;
  drawDashChart();
  if (DB.settings.notifications) Calendar.requestPerm();
}

/* ================== ЖУРНАЛ ПОСЛЕДНИХ ТРЕНИРОВОК ================== */
function renderRecentTrainingsCard(recent) {
  if (!recent.length) {
    return `
      <div class="card">
        <h3>📋 Последние тренировки</h3>
        <p style="color:#666;font-size:14px;margin:0;">Пока тренировок нет. Назначьте первую в календаре.</p>
      </div>
    `;
  }

  const items = recent.map(t => {
    const [y, m, d] = t.date.split('-');
    const exName = t.blockId ? exerciseName(t.blockId) : 'Без упражнения';
    const commentHtml = t.comment
      ? `<br><small class="comment">💬 ${t.comment}</small>`
      : '';
    return `
      <div class="journal-item" onclick="openFighter('${t.fighter.id}')">
        <div class="j-date">
          <b>${d}.${m}</b>
          ${String(t.hour).padStart(2,'0')}:00
        </div>
        <div class="j-info">
          <b>${t.fighter.name}</b>
          <small>${exName}</small>
          ${commentHtml}
        </div>
        <span class="j-mode ${t.mode}">${modeLabel(t.mode)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <h3>📋 Последние тренировки</h3>
      <p style="color:#666;font-size:13px;margin-top:0;">
        Свежие события по всем бойцам. Кликните, чтобы открыть карточку бойца.
      </p>
      <div class="journal-list">
        ${items}
      </div>
    </div>
  `;
}

/* ================== ГРАФИК ДАШБОРДА ================== */
function drawDashChart() {
  const ctx = document.getElementById('dashChart');
  if (!ctx || !DB.fighters.length) return;
  if (ctx._chart) ctx._chart.destroy();
  const labels = DB.fighters.map(f => f.name);
  const startVals = DB.fighters.map(f => {
    const s = getStartAssess(f);
    return s ? avgAll(s.data) : 0;
  });
  const endVals = DB.fighters.map(f => {
    const e = getEndAssess(f);
    return e ? avgAll(e.data) : 0;
  });
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Начало сезона', data: startVals, backgroundColor: '#87CEEB' },
        { label: 'Конец сезона', data: endVals, backgroundColor: '#4A90E2' }
      ]
    },
    options: { scales: { y: { beginAtZero: true, max: MAX_SCORE } } }
  });
}

/* ================== СРАВНЕНИЕ БОЙЦОВ ================== */
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

/* ================== НАСТРОЙКИ ================== */
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

/* Направления и критерии */
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

/* ================== ЭКСПОРТ / ИМПОРТ JSON ================== */
window.exportAllJSON = () => {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `boxcoach_backup_${Date.now()}.json`;
  a.click();
};

window.importAllJSON = (event) => {
  const file = event.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.fighters) throw new Error('bad format');
      DB = parsed;
      if (!DB.directions) DB.directions = structuredClone(DEFAULT_DIRECTIONS);
      if (!DB.exerciseGroups) DB.exerciseGroups = structuredClone(DEFAULT_EXERCISE_GROUPS);
      if (!DB.measurementGroups) DB.measurementGroups = structuredClone(DEFAULT_MEASUREMENT_GROUPS);
      migrateFighterGroups(DB);
      migrateAssessments(DB);
      saveData(DB);
      toast('Импорт выполнен', 'ok');
      render();
    } catch (err) { toast('Ошибка импорта: ' + err.message, 'error'); }
  };
  r.readAsText(file);
};

/* ================== ИНИЦИАЛИЗАЦИЯ ================== */
LockScreen.init();
Cloud.init();

/* ================== PWA SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  const swCode = `
    const CACHE = 'boxcoach-v17';
    self.addEventListener('install', e => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', e => {
      if (e.request.method !== 'GET') return;
      e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
          if (resp.ok && e.request.url.startsWith(self.location.origin)) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(()=>caches.match('./index.html')))
      );
    });
  `;
  const blob = new Blob([swCode], { type: 'application/javascript' });
  navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(()=>{});
}