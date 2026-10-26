/* ============================================================
   CLOUD.JS — синхронизация с Supabase
   ============================================================ */
const Cloud = (() => {
  let supabase = null, enabled = false, userId = null, userEmail = null;
  let badge = null, saveTimer = null, lastRemoteUpdate = 0, realtimeChannel = null;

  function setBadge(state) {
    if (!badge) badge = document.getElementById('syncBadge');
    if (!badge) return;
    badge.className = 'sync-badge ' + state;
    badge.title = state === 'online' ? 'Облако: синхронизировано'
                : state === 'syncing' ? 'Облако: синхронизация…'
                : state === 'offline' ? 'Локальный режим (офлайн)'
                : 'Ошибка синхронизации';
  }

  async function init() {
    if (!navigator.onLine) setBadge('offline');
    try {
      if (!supabase) supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setBadge('offline'); return; }

      userId = user.id; userEmail = user.email; enabled = true;
      await loadFromCloud();
      await subscribeRealtime();
      setBadge('online');
      document.getElementById('lockScreen').style.display = 'none';
      document.getElementById('appRoot').style.display = 'block';
      if (typeof render === 'function') render();
    } catch (e) {
      console.warn('[Cloud] Ошибка инициализации:', e);
      setBadge('error'); enabled = false;
      if (!navigator.onLine) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData?.session?.user;
          if (user) {
            userId = user.id; userEmail = user.email; enabled = true;
            setBadge('offline');
            document.getElementById('lockScreen').style.display = 'none';
            document.getElementById('appRoot').style.display = 'block';
            if (typeof render === 'function') render();
          }
        } catch (e2) {}
      }
    }
  }

  async function loadFromCloud() {
    if (!enabled || !supabase || !userId) return;
    const { data: cloudRows, error } = await supabase
      .from('coach_data').select('data, updated_at').eq('user_id', userId)
      .order('updated_at', { ascending: false }).limit(1);
    if (error) throw error;

    if (cloudRows && cloudRows.length > 0) {
      const cloudData = cloudRows[0];
      const remoteTs = new Date(cloudData.updated_at).getTime();
      const localTs = +(localStorage.getItem(STORE_KEY + '_ts') || 0);
      if (remoteTs >= localTs) {
        DB = cloudData.data;
        if (!DB.directions) DB.directions = structuredClone(DEFAULT_DIRECTIONS);
        if (!DB.exerciseGroups) DB.exerciseGroups = structuredClone(DEFAULT_EXERCISE_GROUPS);
        if (!DB.measurementGroups) DB.measurementGroups = structuredClone(DEFAULT_MEASUREMENT_GROUPS);
        migrateFighterGroups(DB);
        migrateAssessments(DB);
        saveLocal(DB);
        localStorage.setItem(STORE_KEY + '_ts', remoteTs);
      } else {
        await pushToCloud();
      }
    } else {
      await pushToCloud();
    }
  }

  async function subscribeRealtime() {
    if (!supabase || !userId) return;
    if (realtimeChannel) {
      try { await supabase.removeChannel(realtimeChannel); } catch(e){}
      realtimeChannel = null;
    }
    realtimeChannel = supabase.channel('coach_data_' + userId + '_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_data', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!payload.new) return;
          const remoteTs = new Date(payload.new.updated_at).getTime();
          if (remoteTs > lastRemoteUpdate + 500) {
            lastRemoteUpdate = remoteTs;
            DB = payload.new.data;
            migrateFighterGroups(DB); migrateAssessments(DB);
            saveLocal(DB); localStorage.setItem(STORE_KEY + '_ts', remoteTs);
            if (typeof render === 'function') render();
          }
        }
      ).subscribe();
  }

  async function pushToCloud() {
    if (!enabled || !supabase || !userId) return;
    const payload = { user_id: userId, data: DB, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('coach_data').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }

  function push() {
    saveLocal(DB);
    localStorage.setItem(STORE_KEY + '_ts', Date.now());
    if (!enabled) { setBadge('offline'); return; }
    if (!navigator.onLine) { localStorage.setItem(PENDING_SYNC_KEY, '1'); setBadge('offline'); return; }
    setBadge('syncing');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await pushToCloud(); setBadge('online'); localStorage.removeItem(PENDING_SYNC_KEY); }
      catch (e) { localStorage.setItem(PENDING_SYNC_KEY, '1'); setBadge('offline'); }
    }, 600);
  }

  async function trySyncPending() {
    if (!navigator.onLine || !enabled || !userId) return;
    if (localStorage.getItem(PENDING_SYNC_KEY) !== '1') return;
    try { await pushToCloud(); localStorage.removeItem(PENDING_SYNC_KEY); setBadge('online'); } catch (e) {}
  }

  async function register(email, password) {
    if (!supabase) throw new Error('Нет подключения');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Не удалось создать пользователя');
    if (!data.session) throw new Error('Включено подтверждение email. Отключите его в Supabase.');
    await onAuthChanged(data.user);
  }
  
  async function login(email, password) {
    if (!supabase) {
      if (!window.supabase) throw new Error('Библиотека не загрузилась. Проверьте интернет.');
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await onAuthChanged(data.user);
  }
  
  async function logout() {
    if (!supabase) return;
    if (realtimeChannel) { try { await supabase.removeChannel(realtimeChannel); } catch(e){} }
    try { await supabase.auth.signOut(); } catch(e){}
    userId = null; userEmail = null; enabled = false;
    DB = defaultDB(); saveLocal(DB);
    localStorage.removeItem(STORE_KEY + '_ts'); localStorage.removeItem(PENDING_SYNC_KEY);
    document.getElementById('lockScreen').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
    setBadge('offline');
  }
  
  async function onAuthChanged(user) {
    userId = user.id; userEmail = user.email; enabled = true;
    await loadFromCloud(); await subscribeRealtime(); setBadge('online');
    document.getElementById('lockScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'block';
    if (typeof render === 'function') render();
  }

  return { init, push, register, login, logout, onAuthChanged, trySyncPending, isEnabled: () => enabled, getUser: () => ({ userId, userEmail, enabled }), getSupabase: () => supabase };
})();

window.addEventListener('online', () => { Cloud.trySyncPending(); });
window.addEventListener('offline', () => {});
setInterval(() => Cloud.trySyncPending(), 60000);

function saveData(d) { if (d) DB = d; Cloud.push(); }