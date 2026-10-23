/* ============================================================
   CONFIG.JS — константы, настройки по умолчанию, ключи Supabase
   ============================================================
   Этот файл подключается ПЕРВЫМ, до data.js.
   Здесь только «неизменяемые» вещи: адреса, ключи, справочники.
   Никакой логики — только данные.
   ============================================================ */

/* ================== SUPABASE CONFIG ================== */
const SUPABASE_URL = 'https://sfealuhkjpdauycbgsvo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWFsdWhranBkYXV5Y2Jnc3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDkwNjksImV4cCI6MjEwNTgyNTA2OX0.s0srvgtLGWyJgoP64-fDETI01GISpWH_ZRWjs-PaoPw';

/* ================== SCALE ================== */
const MAX_SCORE = 10;

/* ================== ГРУППЫ БОЙЦОВ ПО УМОЛЧАНИЮ ==================
   Используются только при первом запуске — дальше живут в DB.fighterGroups.
*/
const DEFAULT_FIGHTER_GROUPS = [
  { key: 'kids_junior', name: 'Младшая группа', isKids: true },
  { key: 'kids_middle', name: 'Средняя группа', isKids: true },
  { key: 'adults', name: 'Взрослые', isKids: false }
];

/* ================== Справочники по умолчанию ================== */
const DEFAULT_DIRECTIONS = [
  { key: 'technique', name: 'Техника',
    criteria: [
      { key: 'straight', name: 'Прямые' },
      { key: 'side', name: 'Боковые' },
      { key: 'uppercut', name: 'Удары снизу' }
    ] },
  { key: 'physical', name: 'Физика',
    criteria: [
      { key: 'strength', name: 'Сила' },
      { key: 'speed', name: 'Скорость' },
      { key: 'coordination', name: 'Координация' },
      { key: 'endurance', name: 'Выносливость' },
      { key: 'flexibility', name: 'Гибкость' }
    ] },
  { key: 'tactics', name: 'Тактика',
    criteria: [
      { key: 'longRange', name: 'Дистанция' },
      { key: 'closeRange', name: 'Ближняя дистанция' },
      { key: 'footwork', name: 'Работа ногами' }
    ] },
  { key: 'psychology', name: 'Психология',
    criteria: [
      { key: 'stability', name: 'Устойчивость' },
      { key: 'stress', name: 'Стресс' },
      { key: 'defeat', name: 'Реакция на поражения' }
    ] }
];

const DEFAULT_EXERCISE_GROUPS = [
  { key: 'frontHand', name: 'Передняя рука',
    exercises: [
      { id: 'fh1', name: 'Джеб' },
      { id: 'fh2', name: 'Хук' },
      { id: 'fh3', name: 'Удар снизу' }
    ] },
  { key: 'strongHand', name: 'Сильнейшая рука',
    exercises: [
      { id: 'sh1', name: 'Джеб' },
      { id: 'sh2', name: 'Хук' },
      { id: 'sh3', name: 'Удар снизу' }
    ] },
  { key: 'legs', name: 'Ноги',
    exercises: [
      { id: 'lg1', name: 'Челнок' },
      { id: 'lg2', name: 'Передвижения' }
    ] }
];

const DEFAULT_MEASUREMENT_GROUPS = [
  { key: 'test1', name: 'Силовые замеры', measurements: [
    { id: 'pushup', name: 'Отжимания', unit: 'раз' },
    { id: 'pullup', name: 'Подтягивания', unit: 'раз' },
    { id: 'abspress', name: 'Пресс', unit: 'раз' }
  ]}
];

/* ================== ХРАНИЛИЩЕ ================== */
const STORE_KEY = 'boxingCoachV19';
const PENDING_SYNC_KEY = 'boxingCoach_pendingSync';

/* ================== ПУСТАЯ БАЗА ================== */
function defaultDB() {
  return {
    fighters: [],
    fighterGroups: structuredClone(DEFAULT_FIGHTER_GROUPS),
    directions: structuredClone(DEFAULT_DIRECTIONS),
    exerciseGroups: structuredClone(DEFAULT_EXERCISE_GROUPS),
    measurementGroups: structuredClone(DEFAULT_MEASUREMENT_GROUPS),
    settings: { coachName: 'Ильнур Нуриев', season: '2025', notifications: true }
  };
}