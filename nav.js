/* ============================================================
   NAV.JS — навигация, модальные окна, вход, роутер
   ============================================================ */
const app = document.getElementById('app');
const state = { tab: 'dashboard', currentFighter: null, exTab: 'exercises' };

/* ================== НАВИГАЦИЯ ================== */
function setActiveTab(tab) {
  document.querySelectorAll('#mainNav button').forEach(x => {
    x.classList.toggle('active', x.dataset.tab === tab);
  });
}

document.querySelectorAll('#mainNav button').forEach(b => {
  b.onclick = () => {
    state.tab = b.dataset.tab;
    state.currentFighter = null;
    setActiveTab(state.tab);
    render();
    toggleMenu(false);
  };
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
  try {
    if (state.tab === 'dashboard') renderDashboard();
    else if (state.tab === 'fighters') renderFighters();
    else if (state.tab === 'attendance') {
      if (typeof Attendance === 'undefined') {
        app.innerHTML = `
          <h2>Отметка тренировки</h2>
          <div class="card" style="border-left:4px solid #dc2626;background:#fef2f2;">
            <b style="color:#991b1b;">Модуль attendance.js не загружен.</b>
            <p style="color:#666;font-size:14px;margin:8px 0 0;">
              Проверьте, что файл <code>attendance.js</code> существует и подключён в <code>index.html</code>
              перед <code>app.js</code>. Затем обновите страницу (Ctrl+F5).
            </p>
          </div>`;
      } else {
        Attendance.render();
      }
    }
    else if (state.tab === 'reports') app.innerHTML = Reports.render();
    else if (state.tab === 'compare') renderCompare();
    else if (state.tab === 'exercises') renderExercisesAndMeasurements();
    else if (state.tab === 'settings') renderSettings();
  } catch (e) {
    console.error('[render] Ошибка:', e);
    app.innerHTML = `
      <div class="card" style="border-left:4px solid #dc2626;background:#fef2f2;">
        <h3 style="margin-top:0;color:#991b1b;">Ошибка в разделе «${state.tab}»</h3>
        <p style="color:#666;">${e.message || 'Неизвестная ошибка'}</p>
        <pre style="background:#fff;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">${(e.stack || '').split('\n').slice(0,5).join('\n')}</pre>
      </div>`;
  }
}