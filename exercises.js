/* ============================================================
   EXERCISES.JS — раздел «Упражнения и замеры»
   ============================================================ */

function renderExercisesAndMeasurements() {
  const tab = state.exTab || 'exercises';
  app.innerHTML = `
    <h2>Упражнения и замеры</h2>
    <div class="tabs">
      <button class="${tab==='exercises'?'active':''}" onclick="state.exTab='exercises';render()">Упражнения</button>
      <button class="${tab==='measurements'?'active':''}" onclick="state.exTab='measurements';render()">Замеры</button>
    </div>
    ${tab === 'exercises' ? renderExercisesTab() : renderMeasurementsTab()}
  `;
}

function renderExercisesTab() {
  return `
    <p style="font-size:13px;color:#666">
      Блоки упражнений и сами упражнения можно переименовывать, удалять и добавлять новые.
      Эти упражнения используются в календаре и плане работы.
    </p>
    <button onclick="addExerciseGroup()">+ Добавить блок</button>
    ${DB.exerciseGroups.map((g, gi) => `
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h3 style="margin:0">${g.name}</h3>
          <button class="small" onclick="renameExerciseGroup(${gi})">✎ Переименовать</button>
          <button class="small danger" onclick="deleteExerciseGroup(${gi})">Удалить блок</button>
        </div>
        <ul style="margin-top:12px">
          ${g.exercises.map((e, ei) => `<li style="margin:6px 0">
            ${e.name}
            <button class="small" onclick="renameExercise(${gi},${ei})">✎</button>
            <button class="small danger" onclick="deleteExercise(${gi},${ei})">✕</button>
          </li>`).join('') || '<i style="color:#999">Нет упражнений</i>'}
        </ul>
        <button onclick="addExercise(${gi})">+ Добавить упражнение</button>
      </div>`).join('')}
  `;
}

function renderMeasurementsTab() {
  return `
    <p style="font-size:13px;color:#666">
      Здесь настраиваются упражнения для замеров (отжимания, подтягивания, пресс и т.д.).
      Для каждого бойца вы потом вводите количество повторений.
    </p>
    <button onclick="addMeasurementGroup()">+ Добавить группу</button>
    ${DB.measurementGroups.map((g, gi) => `
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h3 style="margin:0">${g.name}</h3>
          <button class="small" onclick="renameMeasurementGroup(${gi})">✎ Переименовать</button>
          <button class="small danger" onclick="deleteMeasurementGroup(${gi})">Удалить группу</button>
        </div>
        <ul style="margin-top:12px">
          ${g.measurements.map((m, mi) => `<li style="margin:6px 0">
            <b>${m.name}</b>
            <span style="color:#888;font-size:12px"> — ${m.unit || 'раз'}</span>
            <button class="small" onclick="editMeasurement(${gi},${mi})">✎</button>
            <button class="small danger" onclick="deleteMeasurement(${gi},${mi})">✕</button>
          </li>`).join('') || '<i style="color:#999">Нет замеров</i>'}
        </ul>
        <button onclick="addMeasurement(${gi})">+ Добавить замер</button>
      </div>`).join('')}
  `;
}

window.addExerciseGroup = () => {
  const name = prompt('Название блока:'); if (!name) return;
  DB.exerciseGroups.push({ key: 'g_' + uid(), name, exercises: [] });
  saveData(DB); render();
};
window.renameExerciseGroup = (gi) => {
  const name = prompt('Новое название:', DB.exerciseGroups[gi].name);
  if (name) { DB.exerciseGroups[gi].name = name; saveData(DB); render(); }
};
window.deleteExerciseGroup = (gi) => {
  if (!confirm('Удалить блок и все его упражнения?')) return;
  DB.exerciseGroups.splice(gi, 1);
  saveData(DB); render();
};
window.addExercise = (gi) => {
  const name = prompt('Название упражнения:'); if (!name) return;
  DB.exerciseGroups[gi].exercises.push({ id: uid(), name });
  saveData(DB); render();
};
window.renameExercise = (gi, ei) => {
  const name = prompt('Новое название:', DB.exerciseGroups[gi].exercises[ei].name);
  if (name) {
    DB.exerciseGroups[gi].exercises[ei].name = name;
    saveData(DB); render();
  }
};
window.deleteExercise = (gi, ei) => {
  if (!confirm('Удалить упражнение?')) return;
  DB.exerciseGroups[gi].exercises.splice(ei, 1);
  saveData(DB); render();
};

window.addMeasurementGroup = () => {
  const name = prompt('Название группы замеров:'); if (!name) return;
  DB.measurementGroups.push({ key: 'mg_' + uid(), name, measurements: [] });
  saveData(DB); render();
};
window.renameMeasurementGroup = (gi) => {
  const name = prompt('Новое название:', DB.measurementGroups[gi].name);
  if (name) {
    DB.measurementGroups[gi].name = name;
    saveData(DB); render();
  }
};
window.deleteMeasurementGroup = (gi) => {
  if (!confirm('Удалить группу замеров и все её замеры?')) return;
  DB.measurementGroups.splice(gi, 1);
  saveData(DB); render();
};
window.addMeasurement = (gi) => {
  const name = prompt('Название замера:'); if (!name) return;
  const unit = prompt('Единица измерения (раз/сек/кг):', 'раз') || 'раз';
  DB.measurementGroups[gi].measurements.push({ id: 'm_' + uid(), name, unit });
  saveData(DB); render();
};
window.editMeasurement = (gi, mi) => {
  const m = DB.measurementGroups[gi].measurements[mi];
  const name = prompt('Название:', m.name); if (!name) return;
  const unit = prompt('Единица измерения:', m.unit || 'раз') || 'раз';
  m.name = name;
  m.unit = unit;
  saveData(DB); render();
};
window.deleteMeasurement = (gi, mi) => {
  if (!confirm('Удалить замер? Данные бойцов по этому замеру останутся, но не будут отображаться.')) return;
  DB.measurementGroups[gi].measurements.splice(mi, 1);
  saveData(DB); render();
};