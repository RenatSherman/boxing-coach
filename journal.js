/* ============================================================
   JOURNAL.JS — рекомендации и журнал тренировок
   ============================================================
   Зависимости: utils.js (sortAssessments, allExerciseItems),
   data.js (DB).

   Подключается ПОСЛЕ attendance-data.js.

   Что внутри:
   - CRITERION_TO_EXERCISES — карта «критерий → ключевые слова»
   - getRecommendationsForCriterion — упражнения под критерий
   - getWeakPoints — слабые стороны бойца по последнему замеру
   - getRecentTrainings — журнал последних тренировок (для дашборда)
   - getLastTrainingDays — сколько дней прошло с последней тренировки
   ============================================================ */

const CRITERION_TO_EXERCISES = {
  straight:    ['джеб', 'прям'],
  side:        ['хук', 'боков'],
  uppercut:    ['снизу', 'апперкот'],
  strength:    ['сил', 'отжим', 'подтяг', 'пресс', 'штанг', 'гир'],
  speed:       ['скорост', 'быстр', 'рывок'],
  coordination:['координ', 'челнок', 'реакц'],
  endurance:   ['выносл', 'бег', 'скакал', 'круг'],
  flexibility: ['гибк', 'растяж'],
  longRange:   ['дистанц', 'джеб', 'прям'],
  closeRange:  ['ближн', 'хук', 'снизу'],
  footwork:    ['передвиж', 'челнок', 'ног', 'шаг'],
  stability:   ['устойчив', 'стойк', 'баланс'],
  stress:      ['стресс', 'спарринг', 'бой'],
  defeat:      ['поражен', 'реакц']
};

function getRecommendationsForCriterion(critKey) {
  const keywords = CRITERION_TO_EXERCISES[critKey] || [];
  if (!keywords.length) return [];
  const items = allExerciseItems();
  const found = items.filter(item => {
    const lower = item.name.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  });
  return found.slice(0, 5);
}

function getWeakPoints(f, threshold = 6) {
  const list = sortAssessments(f);
  if (!list.length) return [];

  let lastFilled = null;
  for (let i = list.length - 1; i >= 0; i--) {
    let hasAny = false;
    DB.directions.forEach(d => {
      Object.values(list[i].data[d.key] || {}).forEach(v => { if (+v > 0) hasAny = true; });
    });
    if (hasAny) { lastFilled = list[i]; break; }
  }
  if (!lastFilled) return [];

  const weak = [];
  DB.directions.forEach(d => {
    d.criteria.forEach(c => {
      const score = +(lastFilled.data[d.key]?.[c.key] || 0);
      if (score > 0 && score < threshold) {
        weak.push({
          dirKey: d.key,
          dirName: d.name,
          critKey: c.key,
          critName: c.name,
          score,
          assessment: lastFilled,
          recommendations: getRecommendationsForCriterion(c.key)
        });
      }
    });
  });

  weak.sort((a, b) => a.score - b.score);
  return weak.slice(0, 5);
}

function getRecentTrainings(limit = 30) {
  const list = [];
  DB.fighters.forEach(f => {
    Object.entries(f.calendar || {}).forEach(([ds, slots]) => {
      slots.forEach((s, idx) => {
        list.push({
          date: ds,
          hour: s.hour,
          blockId: s.blockId,
          mode: s.mode,
          comment: s.comment || '',
          fighter: f,
          idx
        });
      });
    });
  });
  list.sort((a, b) => {
    const ka = a.date + String(a.hour).padStart(2, '0');
    const kb = b.date + String(b.hour).padStart(2, '0');
    return kb.localeCompare(ka);
  });
  return list.slice(0, limit);
}

function getLastTrainingDays(f) {
  let lastTs = 0;
  Object.keys(f.calendar || {}).forEach(ds => {
    const slots = f.calendar[ds] || [];
    if (slots.length) {
      const t = new Date(ds + 'T00:00:00').getTime();
      if (t > lastTs) lastTs = t;
    }
  });
  if (!lastTs) return null;
  return Math.floor((Date.now() - lastTs) / 86400000);
}