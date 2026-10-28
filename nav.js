/* ============================================================
   NAV.JS — навигация, модальные окна, вход, роутер
   ============================================================ */
let app;
const state = { tab: 'dashboard', currentFighter: null, exTab: 'exercises' };

/* ================== НАВИГАЦИЯ ================== */
function setActiveTab(tab) {
  document.querySelectorAll('button[data-tab]').forEach(x => {
    x.classList.toggle('active', x.dataset.tab === tab);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  app = document.getElementById('app');

  document.querySelectorAll('button[data-tab]').forEach(b => {
    b.onclick = () => {
      state.tab = b.dataset.tab;
      state.currentFighter = null;
      setActiveTab(state.tab);
      
      // Если переходим в Отметку, сначала сбрасываем дату, потом рендерим
      if (state.tab === 'attendance' && window.Attendance) {
        Attendance.setToday(); // Это изменит viewDate на todayStr() без рендера
      }
      
      render(); // Рендерим вкладку
    };
  });
});

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
  if (!app) app = document.getElementById('app');
  if (!app) return;
  
  try {
    if (state.tab === 'dashboard') renderDashboard();
    else if (state.tab === 'fighters') renderFighters();
    else if (state.tab === 'attendance') {
      if (typeof Attendance === 'undefined') {
        app.innerHTML = `<h2>Отметка</h2><div class="card">Модуль не загружен.</div>`;
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
    app.innerHTML = `<div class="card" style="border-left:4px solid #dc2626;background:#fef2f2;padding:16px;">
        <h3 style="margin-top:0;color:#991b1b;">Ошибка в разделе «${state.tab}»</h3>
        <p>${e.message}</p></div>`;
  }
}