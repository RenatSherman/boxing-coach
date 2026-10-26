/* ============================================================
   APP.JS — инициализация приложения и экспорт/импорт базы
   ============================================================ */
window.exportAllJSON = () => {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `boxcoach_backup_${Date.now()}.json`; a.click();
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
      migrateFighterGroups(DB); migrateAssessments(DB); saveData(DB);
      toast('Импорт выполнен', 'ok'); render();
    } catch (err) { toast('Ошибка импорта: ' + err.message, 'error'); }
  };
  r.readAsText(file);
};

window.addEventListener('DOMContentLoaded', () => {
  LockScreen.init();
  Cloud.init();
  setActiveTab('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => console.log('[SW] Зарегистрирован'))
      .catch(err => console.warn('[SW] Ошибка:', err));
  }
});