# CHECKPOINT — Разделение модулей Boxing Coach

## Статус: ШАГ 1 завершён (вынос config.js)

## Что сделано
- [x] Шаг 1: создан `config.js` со всеми константами (SUPABASE_URL, MAX_SCORE, DEFAULT_*, STORE_KEY, defaultDB).
- [x] `data.js` переписан — константы убраны, остались только функции и объекты: Cloud, DB, saveLocal/loadLocal, миграции, утилиты, работа с посещаемостью, журнал.
- [x] `index.html` обновлён: `<script src="config.js"></script>` подключён ПЕРЕД `data.js`.

## Что проверено
- [ ] Вход работает
- [ ] Дашборд грузится
- [ ] Бойцы видны
- [ ] Карточка бойца открывается
- [ ] Отметка работает

## Карта файлов сейчас (до начала работы)
| Файл | Строк | Статус |
|---|---|---|
| config.js | ~120 | ✅ создан на шаге 1 |
| data.js | ~800 | ✅ переписан на шаге 1 (ушли константы) |
| fighters.js | ~1000 | ⏳ ждёт разбивки (шаги 5–7) |
| calendar.js | ~400 | ✅ не трогаем |
| attendance.js | ~400 | ✅ не трогаем |
| reports.js | ~200 | ✅ не трогаем |
| exercises.js | ~150 | ✅ не трогаем |
| pdf.js | ~600 | ✅ не трогаем |
| app.js | ~400 | ⏳ ждёт разбивки (шаг 8) |
| index.html | — | ✅ обновлён на шаге 1 |
| style.css | ~700 | ✅ не трогаем |
| sw.js | ~100 | ⏳ обновить в шаге 9 |

## План (порядок шагов)
- [x] **Шаг 1.** config.js (константы) — ГОТОВО
- [ ] **Шаг 2.** utils.js (утилиты из data.js)
- [ ] **Шаг 3.** cloud.js (Cloud, saveData, миграции из data.js)
- [ ] **Шаг 4.** attendance-data.js + journal.js (посещаемость и журнал из data.js)
- [ ] **Шаг 5.** fighters-core.js (тренировки, создание бойца, фото из fighters.js)
- [ ] **Шаг 6.** assessments.js + measurements.js (оценки и замеры)
- [ ] **Шаг 7.** fighter-detail.js (экран бойца целиком)
- [ ] **Шаг 8.** nav.js + dashboard.js + compare.js + settings.js (резать app.js)
- [ ] **Шаг 9.** sw.js — добавить новые файлы в APP_FILES, обновить CACHE_NAME

## Итоговая структура файлов (к чему стремимся)
**Фундамент (порядок в index.html):**
1. config.js — константы и справочники по умолчанию
2. data.js — DB, loadLocal/saveLocal, миграции, saveData
3. cloud.js — объект Cloud, слушатели online/offline
4. utils.js — утилиты (uid, avgAll, groupName, toast, даты, ...)
5. attendance-data.js — getTrainingSessions, isAttended, setAttendance, гости
6. journal.js — getWeakPoints, getRecommendationsForCriterion, getRecentTrainings

**Функционал (порядок в index.html):**
7. fighters-core.js — addTraining, модалка назначения, создание бойца, фото
8. assessments.js — модалки оценок, drawRadarAll, setScore
9. measurements.js — модалки замеров, drawMeasurementChart
10. calendar.js — БЕЗ ИЗМЕНЕНИЙ
11. fighter-detail.js — renderFighters, renderFighterDetail, карточки
12. attendance.js — БЕЗ ИЗМЕНЕНИЙ
13. reports.js — БЕЗ ИЗМЕНЕНИЙ
14. exercises.js — БЕЗ ИЗМЕНЕНИЙ
15. pdf.js — БЕЗ ИЗМЕНЕНИЙ

**Интерфейс (порядок в index.html):**
16. nav.js — setActiveTab, Modal, LockScreen, render (роутер)
17. dashboard.js — renderDashboard, drawDashChart
18. compare.js — renderCompare, doCompare
19. settings.js — renderSettings, управление группами и направлениями
20. app.js — только init и экспорт/импорт JSON

## Правила работы (договорились)
- Один шаг = один файл (или группа связанных).
- После каждого шага — коммит и проверка в браузере (Ctrl+F5).
- Модули прописываются ПОЛНОСТЬЮ, не фрагментами.
- После каждого шага — обновление этого чекпоинта.

## Что делать в новом чате
1. Прикрепи этот CHECKPOINT.md
2. Прикрепи файлы: `config.js`, `data.js`, `index.html` (текущее состояние)
3. Скажи: «продолжаем с шага N»