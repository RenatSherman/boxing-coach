# CHECKPOINT — Разделение модулей Boxing Coach

> **Как пользоваться:** этот файл — твоя «точка сохранения». Если чат оборвётся, в новом чате прикрепи этот файл + файлы проекта (список в конце) и напиши «продолжаем с шага N».

---

## Статус: ШАГ 2 завершён (вынос utils.js)

**Дата последнего обновления:** шаг 2

---

## Что уже сделано

### Шаг 1 — config.js (ГОТОВО)
- [x] Создан `config.js` со всеми константами:
  - `SUPABASE_URL`, `SUPABASE_KEY`
  - `MAX_SCORE`
  - `DEFAULT_FIGHTER_GROUPS`, `DEFAULT_DIRECTIONS`, `DEFAULT_EXERCISE_GROUPS`, `DEFAULT_MEASUREMENT_GROUPS`
  - `STORE_KEY`, `PENDING_SYNC_KEY`
  - `defaultDB()`
- [x] `data.js` переписан — константы убраны.
- [x] `index.html` обновлён: `<script src="config.js">` подключён перед `data.js`.

### Шаг 2 — utils.js (ГОТОВО)
- [x] Создан `utils.js` со всеми утилитами:
  - `uid`
  - `calcAge`
  - `avgObj`, `avgAll`
  - `emptyAssess` (защищён проверкой `typeof DB`)
  - `allExerciseItems`, `exerciseName`
  - `allMeasurementItems`, `measurementById`
  - `sortAssessments`, `getStartAssess`, `getEndAssess`
  - `sortMeasurements`
  - `modeLabel`
  - `todayStr`, `dateStr`, `formatDateRu`
  - `toast`
  - `getForgottenFighters`
  - `trainingDisplayName`
  - `aggregateSlotEvents`
  - группы бойцов: `makeGroupShort`, `getFighterGroups`, `groupByKey`, `groupName`, `groupShort`, `groupIsKids`
  - рекомендации: `CRITERION_TO_EXERCISES`, `getRecommendationsForCriterion`, `getWeakPoints`
  - журнал: `getRecentTrainings`, `getLastTrainingDays`
- [x] `data.js` похудел: остались миграции, `loadLocal/saveLocal`, `DB`, `Cloud`, `saveData`, слушатели, функции посещаемости.
- [x] `let DB` → `var DB` в `data.js` (защита от TDZ — см. «Технические заметки»).
- [x] `index.html` обновлён: `<script src="utils.js">` между `config.js` и `data.js`.

---

## Что проверено на шаге 2

Отметь галочками, когда проверишь (или напиши мне — я обновлю):

- [ ] Вход работает
- [ ] Дашборд грузится (карточки групп, средний рост, «Требуют внимания», последние тренировки, топ-3, график)
- [ ] Бойцы видны, группы корректны
- [ ] Карточка бойца открывается (оценки, замеры, план, календарь, бои)
- [ ] Отметка работает (чек-боксы, отметка присутствия)
- [ ] Отчёт работает (цифры, графики, PDF)
- [ ] Сравнение работает (таблица и радар)
- [ ] Упражнения и замеры работают (обе вкладки)
- [ ] Настройки работают (группы, направления, экспорт/импорт)
- [ ] **Создание нового бойца работает** ← главный тест `emptyAssess`
- [ ] Значок синхронизации зелёный

---

## Текущий порядок скриптов в `index.html`
