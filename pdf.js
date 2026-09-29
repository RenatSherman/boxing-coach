/* ============================================================
   PDF.JS — экспорт в PDF (тренер, боец, отчёты)
   ============================================================ */

/* ================== ШРИФТ ДЛЯ PDF (кириллица) ================== */
const PDF_FONT_NAME = 'PTSans';
let pdfFontLoaded = false;
let pdfFontBase64 = null;

async function loadPdfFont() {
  if (pdfFontLoaded) return pdfFontBase64;
  try {
    const url = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PT_Sans-Web-Regular.ttf';
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    pdfFontBase64 = btoa(binary);
    pdfFontLoaded = true;
    return pdfFontBase64;
  } catch (e) {
    console.warn('[PDF] Не удалось загрузить шрифт', e);
    pdfFontLoaded = false;
    return null;
  }
}

async function setupPdfFont(doc) {
  const b64 = await loadPdfFont();
  if (!b64) return false;
  try {
    doc.addFileToVFS('PTSans.ttf', b64);
    doc.addFont('PTSans.ttf', PDF_FONT_NAME, 'normal');
    doc.addFont('PTSans.ttf', PDF_FONT_NAME, 'bold');
    return true;
  } catch (e) {
    console.warn('[PDF] Не удалось зарегистрировать шрифт', e);
    return false;
  }
}

/* ================== ХЕЛПЕРЫ РЕНДЕРА ГРАФИКОВ ================== */
function canvasToPng(canvas) {
  try { return canvas.toDataURL('image/png'); } catch (e) { return null; }
}

async function renderChartToPng(type, data, options, width = 800, height = 500) {
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-9999px';
  wrap.style.top = '0';
  wrap.style.width = width + 'px';
  wrap.style.height = height + 'px';
  wrap.style.background = '#fff';
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
  const chart = new Chart(cv, {
    type, data,
    options: Object.assign({ responsive: false, animation: false, maintainAspectRatio: false }, options || {})
  });
  await new Promise(r => setTimeout(r, 250));
  const png = canvasToPng(cv);
  chart.destroy();
  document.body.removeChild(wrap);
  return png;
}

async function renderRadarForPDF(f, width, height) {
  const labels = DB.directions.map(d => d.name);
  const list = sortAssessments(f);
  if (!list.length) return null;

  const colors = [
    { bg: 'rgba(135, 206, 235, 0.20)', border: '#87CEEB' },
    { bg: 'rgba(74, 144, 226, 0.30)',  border: '#4A90E2' },
    { bg: 'rgba(245, 158, 11, 0.20)',  border: '#F59E0B' },
    { bg: 'rgba(236, 72, 153, 0.20)',  border: '#EC4899' },
    { bg: 'rgba(59, 130, 246, 0.20)',  border: '#3B82F6' },
    { bg: 'rgba(139, 92, 246, 0.20)',  border: '#8B5CF6' }
  ];

  const datasets = list.map((a, idx) => {
    const label = a.name || (a.type === 'start' ? `Начало (${formatDateRu(a.date)})`
                : a.type === 'end' ? `Конец (${formatDateRu(a.date)})`
                : formatDateRu(a.date));
    let color;
    if (a.type === 'start') color = colors[0];
    else if (a.type === 'end') color = colors[1];
    else color = colors[2 + ((idx - 2 + colors.length) % (colors.length - 2))];
    return {
      label,
      data: DB.directions.map(d => avgObj(a.data[d.key])),
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
      pointBackgroundColor: color.border,
      pointBorderColor: '#fff',
      pointRadius: 4
    };
  });

  return await renderChartToPng('radar', { labels, datasets }, {
    scales: {
      r: {
        min: 0, max: MAX_SCORE,
        ticks: { stepSize: 2, backdropColor: 'transparent', color: '#555', font: { size: 14 } },
        grid: { color: '#cbd5e1' },
        angleLines: { color: '#cbd5e1' },
        pointLabels: { font: { size: 15 }, color: '#111' }
      }
    },
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 13 }, color: '#111', boxWidth: 14, padding: 10 } }
    }
  }, width, height);
}

async function renderLineChartForPDF(labels, values, datasetLabel, color) {
  return await renderChartToPng('line', {
    labels,
    datasets: [{
      label: datasetLabel,
      data: values,
      borderColor: color,
      backgroundColor: 'rgba(230,57,70,.15)',
      tension: 0.3,
      fill: true,
      pointRadius: 5,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0, color: '#555', font: { size: 12 } }, grid: { color: '#e5e7eb' } },
      x: { ticks: { color: '#555', font: { size: 12 } }, grid: { display: false } }
    }
  }, 800, 280);
}

/* Хелпер: есть ли у бойца хоть одна ненулевая оценка в замере */
function assessHasAnyValue(a) {
  let has = false;
  DB.directions.forEach(d => {
    Object.values(a.data[d.key] || {}).forEach(v => { if (+v > 0) has = true; });
  });
  return has;
}

/* Хелпер: список тренировок бойца — от сегодня до конца следующего месяца */
function getUpcomingTrainings(f) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59);
  const upcoming = [];
  Object.entries(f.calendar || {}).forEach(([ds, slots]) => {
    const d = new Date(ds + 'T00:00:00');
    if (d >= today && d <= endOfNextMonth) {
      slots.forEach(s => {
        upcoming.push({ date: ds, hour: s.hour, blockId: s.blockId, mode: s.mode, comment: s.comment || '' });
      });
    }
  });
  upcoming.sort((a, b) =>
    (a.date + String(a.hour).padStart(2, '0'))
      .localeCompare(b.date + String(b.hour).padStart(2, '0'))
  );
  return { items: upcoming, periodStart: today, periodEnd: endOfNextMonth };
}

/* ================== PDF ДЛЯ ТРЕНЕРА (ПОЛНЫЙ) ================== */
window.exportFighterPDF = async (id) => {
  const f = DB.fighters.find(x => x.id === id);
  if (!f) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  let y = M;

  const useCyr = await setupPdfFont(doc);
  const FONT = useCyr ? PDF_FONT_NAME : 'helvetica';

  const setFont = (size, style='normal') => {
    doc.setFont(FONT, style === 'bold' && !useCyr ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const txt = (str, x, yPos) => doc.text(str, x, yPos);
  const checkPage = (need=10) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
  };

  setFont(18, 'bold');
  txt('Карточка бойца', M, y); y += 8;
  setFont(14, 'bold');
  txt(f.name, M, y); y += 7;
  setFont(10);
  txt(`Группа: ${groupName(f.group)}`, M, y); y += 5;
  txt(`Дата рождения: ${f.birthDate ? formatDateRu(f.birthDate) : '—'}  •  Возраст: ${calcAge(f.birthDate)} лет`, M, y); y += 5;
  txt(`Рост: ${f.height || '—'} см  •  Вес: ${f.weight || '—'} кг  •  Стойка: ${f.stance === 'right' ? 'Правша' : 'Левша'}`, M, y); y += 8;

  if (f.photo) {
    try {
      const img = new Image();
      img.src = f.photo;
      await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1000); });
      doc.addImage(f.photo, 'JPEG', W - M - 35, M, 35, 45);
    } catch (e) {}
  }

  const radarPng = await renderRadarForPDF(f, 800, 500);
  if (radarPng) {
    checkPage(95);
    setFont(12, 'bold');
    txt('Динамика оценок по направлениям', M, y); y += 6;
    const imgW = W - 2*M, imgH = imgW * 0.55;
    doc.addImage(radarPng, 'PNG', M, y, imgW, imgH);
    y += imgH + 6;
  }

  checkPage(40);
  setFont(12, 'bold');
  txt('Оценки по направлениям', M, y); y += 6;
  const assessList = sortAssessments(f);
  if (assessList.length && doc.autoTable) {
    const head = [['Направление', 'Критерий', ...assessList.map(a => `${a.name || 'Оценка'}\n${formatDateRu(a.date)}`)]];
    const body = [];
    DB.directions.forEach(d => {
      d.criteria.forEach((c, ci) => {
        const row = [
          ci === 0 ? d.name : '',
          c.name,
          ...assessList.map(a => String((a.data[d.key] && a.data[d.key][c.key]) || 0))
        ];
        body.push(row);
      });
    });
    doc.autoTable({
      startY: y,
      head, body,
      styles: { font: FONT, fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', textColor: [17,17,17] },
      headStyles: { fillColor: [230, 57, 70], textColor: 255, fontSize: 8, font: FONT, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 38 } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    setFont(10);
    txt('Нет данных', M, y); y += 6;
  }

  checkPage(40);
  setFont(12, 'bold');
  txt('Замеры (количество повторений)', M, y); y += 6;
  const measures = allMeasurementItems();
  if (measures.length && (f.measurements || []).length && doc.autoTable) {
    const dates = [...new Set((f.measurements || []).map(t => t.date))].sort();
    const head = [['Замер', ...dates.map(formatDateRu)]];
    const body = measures.map(m => {
      const row = [m.name];
      dates.forEach(ds => {
        const rec = (f.measurements || []).find(t => t.measureId === m.id && t.date === ds);
        row.push(rec ? String(rec.value) : '—');
      });
      return row;
    });
    doc.autoTable({
      startY: y,
      head, body,
      styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: [17,17,17] },
      headStyles: { fillColor: [74, 144, 226], textColor: 255, fontSize: 8, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    setFont(10);
    txt('Нет данных', M, y); y += 6;
  }

  checkPage(30);
  setFont(12, 'bold');
  txt('План работы', M, y); y += 6;
  setFont(10);
  if (f.workPlan && f.workPlan.length) {
    f.workPlan.forEach((w, i) => {
      checkPage(6);
      txt(`${i+1}. Неделя ${w.week} — ${exerciseName(w.blockId)} (${modeLabel(w.mode)})`, M + 2, y);
      y += 5;
    });
  } else {
    txt('Нет плана', M, y); y += 5;
  }
  y += 4;

  checkPage(30);
  setFont(12, 'bold');
  txt('План тренировок', M, y); y += 6;
  setFont(9);
  const upcomingData = getUpcomingTrainings(f);
  txt(`Период: ${formatDateRu(dateStr(upcomingData.periodStart))} — ${formatDateRu(dateStr(upcomingData.periodEnd))}`, M, y); y += 5;

  if (!upcomingData.items.length) {
    setFont(10);
    txt('Нет запланированных тренировок на этот период.', M, y); y += 6;
  } else if (doc.autoTable) {
    const body = upcomingData.items.map(t => [
      formatDateRu(t.date),
      String(t.hour).padStart(2, '0') + ':00',
      exerciseName(t.blockId),
      modeLabel(t.mode),
      t.comment
    ]);
    doc.autoTable({
      startY: y,
      head: [['Дата', 'Время', 'Упражнение', 'Формат', 'Комментарий']],
      body,
      styles: { font: FONT, fontSize: 9, cellPadding: 1.8, textColor: [17,17,17] },
      headStyles: { fillColor: [74, 144, 226], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    setFont(10);
    txt('Нет запланированных тренировок на этот период.', M, y); y += 6;
  }

  if (f.fights && f.fights.length && doc.autoTable) {
    checkPage(30);
    setFont(12, 'bold');
    txt('Бои', M, y); y += 6;
    const head = [['Дата', 'Категория', 'Соперник', 'Результат', 'Примечание']];
    const body = f.fights.map(fg => [formatDateRu(fg.date), fg.weightClass || '', fg.opponent || '', fg.result || '', fg.note || '']);
    doc.autoTable({
      startY: y,
      head, body,
      styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: [17,17,17] },
      headStyles: { fillColor: [17, 17, 17], textColor: 255, fontSize: 8, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  doc.save(`${f.name}_полный.pdf`);
};

/* ================== PDF ДЛЯ БОЙЦА (КОМПАКТНЫЙ) ================== */
window.exportFighterShortPDF = async (id) => {
  const f = DB.fighters.find(x => x.id === id);
  if (!f) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  let y = M;

  const useCyr = await setupPdfFont(doc);
  const FONT = useCyr ? PDF_FONT_NAME : 'helvetica';

  const setFont = (size, style='normal') => {
    doc.setFont(FONT, style === 'bold' && !useCyr ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const txt = (str, x, yPos) => doc.text(str, x, yPos);
  const checkPage = (need=10) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
  };

  setFont(20, 'bold');
  txt('Карточка бойца', M, y); y += 9;
  setFont(15, 'bold');
  txt(f.name, M, y); y += 7;
  setFont(11);
  txt(`Группа: ${groupName(f.group)}`, M, y); y += 5;
  txt(`Возраст: ${calcAge(f.birthDate)} лет  •  Рост: ${f.height || '—'} см  •  Вес: ${f.weight || '—'} кг`, M, y); y += 9;

  if (f.photo) {
    try {
      const img = new Image();
      img.src = f.photo;
      await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1000); });
      doc.addImage(f.photo, 'JPEG', W - M - 35, M, 35, 45);
    } catch (e) {}
  }

  const radarPng = await renderRadarForPDF(f, 800, 500);
  if (radarPng) {
    checkPage(95);
    setFont(13, 'bold');
    txt('Динамика оценок', M, y); y += 6;
    const imgW = W - 2*M, imgH = imgW * 0.55;
    doc.addImage(radarPng, 'PNG', M, y, imgW, imgH);
    y += imgH + 8;
  }

  /* Оценки — показываем только заполненные замеры */
  checkPage(40);
  setFont(13, 'bold');
  txt('Оценки по направлениям', M, y); y += 6;

  const filledAssess = sortAssessments(f).filter(assessHasAnyValue);

  if (!filledAssess.length) {
    setFont(10);
    txt('Оценки пока не выставлены.', M, y); y += 6;
  } else if (doc.autoTable) {
    const head = [['Направление', ...filledAssess.map(a => {
      const typeLabel = a.type === 'start' ? 'Начало'
                      : a.type === 'end' ? 'Конец'
                      : 'Промеж.';
      return `${typeLabel}\n${formatDateRu(a.date)}`;
    }), 'Δ']];

    const body = DB.directions.map(d => {
      const row = [d.name];
      const vals = [];
      filledAssess.forEach(a => {
        const v = avgObj(a.data[d.key]);
        vals.push(v);
        row.push(v > 0 ? v.toFixed(2) : '—');
      });
      const nonZero = vals.filter(v => v > 0);
      const lastAssess = filledAssess[filledAssess.length - 1];
      let delta = '—';
      if (nonZero.length >= 2 && (lastAssess.type === 'end' || lastAssess.type === 'checkpoint')) {
        const first = vals.find(v => v > 0);
        const last = vals.slice().reverse().find(v => v > 0);
        if (first !== undefined && last !== undefined) {
          const dd = last - first;
          delta = (dd > 0 ? '+' : '') + dd.toFixed(2);
        }
      }
      row.push(delta);
      return row;
    });

    doc.autoTable({
      startY: y,
      head, body,
      styles: { font: FONT, fontSize: 9, cellPadding: 1.8, textColor: [17,17,17] },
      headStyles: { fillColor: [230, 57, 70], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 45 } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  /* Замеры — графики */
  const measures = allMeasurementItems();
  const hasMeasureData = measures.some(m => sortMeasurements(f, m.id).length > 0);
  if (hasMeasureData) {
    checkPage(50);
    setFont(13, 'bold');
    txt('Замеры', M, y); y += 7;

    for (const m of measures) {
      const list = sortMeasurements(f, m.id);
      if (!list.length) continue;

      checkPage(55);
      setFont(11, 'bold');
      txt(`${m.name} (${m.unit || 'раз'})`, M, y); y += 5;
      const latest = list[list.length - 1];
      setFont(9);
      txt(`Последнее: ${latest.value} ${m.unit || 'раз'}  •  ${formatDateRu(latest.date)}`, M, y); y += 5;

      const png = await renderLineChartForPDF(
        list.map(t => formatDateRu(t.date)),
        list.map(t => t.value),
        m.name,
        '#e63946'
      );
      if (png) {
        const imgW = W - 2*M, imgH = imgW * 0.35;
        doc.addImage(png, 'PNG', M, y, imgW, imgH);
        y += imgH + 6;
      }
    }
  }

  /* План тренировок: от сегодня до конца следующего месяца */
  checkPage(30);
  setFont(13, 'bold');
  txt('План тренировок', M, y); y += 6;
  setFont(9);
  const upcomingData = getUpcomingTrainings(f);
  txt(`Период: ${formatDateRu(dateStr(upcomingData.periodStart))} — ${formatDateRu(dateStr(upcomingData.periodEnd))}`, M, y); y += 5;

  if (!upcomingData.items.length) {
    setFont(10);
    txt('Нет запланированных тренировок на этот период.', M, y); y += 6;
  } else if (doc.autoTable) {
    const body = upcomingData.items.map(t => [
      formatDateRu(t.date),
      String(t.hour).padStart(2, '0') + ':00',
      exerciseName(t.blockId),
      modeLabel(t.mode)
    ]);
    doc.autoTable({
      startY: y,
      head: [['Дата', 'Время', 'Упражнение', 'Формат']],
      body,
      styles: { font: FONT, fontSize: 9, cellPadding: 1.8, textColor: [17,17,17] },
      headStyles: { fillColor: [74, 144, 226], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  doc.save(`${f.name}_карточка_бойца.pdf`);
};

/* ================== PDF — ОТЧЁТ ЗА МЕСЯЦ ПО БОЙЦУ ================== */
window.exportFighterMonthPDF = async (id, year, month) => {
  const f = DB.fighters.find(x => x.id === id);
  if (!f) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 12;
  let y = M;

  const useCyr = await setupPdfFont(doc);
  const FONT = useCyr ? PDF_FONT_NAME : 'helvetica';
  const setFont = (size, style='normal') => {
    doc.setFont(FONT, style === 'bold' && !useCyr ? 'bold' : 'normal');
    doc.setFontSize(size);
  };

  setFont(16, 'bold');
  doc.text(`${f.name} — отчёт за ${month+1}.${year}`, M, y); y += 8;
  setFont(11);
  doc.text(`Группа: ${groupName(f.group)}`, M, y); y += 6;

  let total = 0;
  const rows = [];
  Object.entries(f.calendar || {}).forEach(([date, slots]) => {
    const dt = new Date(date);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      slots.forEach(s => {
        rows.push([
          formatDateRu(date),
          String(s.hour).padStart(2,'0') + ':00',
          exerciseName(s.blockId),
          modeLabel(s.mode),
          s.comment || ''
        ]);
        total++;
      });
    }
  });

  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      head: [['Дата', 'Время', 'Упражнение', 'Формат', 'Комментарий']],
      body: rows.length ? rows : [['—','—','Нет тренировок','—','—']],
      styles: { font: FONT, fontSize: 9, cellPadding: 1.8, textColor: [17,17,17] },
      headStyles: { fillColor: [17,17,17], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  setFont(11, 'bold');
  doc.text(`Итого тренировок: ${total}`, M, y);
  doc.save(`${f.name}_${month+1}_${year}.pdf`);
};

/* ================== PDF — КРАТКИЙ ОБЩИЙ ОТЧЁТ ================== */
window.exportReportPDF = async (year, month) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 12;
  let y = M;

  const useCyr = await setupPdfFont(doc);
  const FONT = useCyr ? PDF_FONT_NAME : 'helvetica';
  const setFont = (size, style='normal') => {
    doc.setFont(FONT, style === 'bold' && !useCyr ? 'bold' : 'normal');
    doc.setFontSize(size);
  };

  const { rows, sum } = Reports.collect(year, month);
  setFont(16, 'bold');
  doc.text(`Отчёт за ${month+1}.${year}`, M, y); y += 8;
  setFont(11);
  doc.text(`Всего: ${sum.total} | Индивид.: ${sum.personal} | Группа: ${sum.group} | Самост.: ${sum.self}`, M, y); y += 8;

  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      head: [['Боец', 'Группа', 'Всего', 'Индивид.', 'Группа', 'Самост.']],
      body: rows.map(r => [r.name, groupShort(r.group), r.total, r.personal, r.group, r.self]),
      styles: { font: FONT, fontSize: 9, cellPadding: 2, textColor: [17,17,17] },
      headStyles: { fillColor: [17,17,17], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
  }
  doc.save(`report_${month+1}_${year}.pdf`);
};

/* ================== PDF — ПОЛНЫЙ ОТЧЁТ ТРЕНЕРА ЗА МЕСЯЦ ================== */
window.exportMonthReportFullPDF = async (year, month) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  let y = M;

  const useCyr = await setupPdfFont(doc);
  const FONT = useCyr ? PDF_FONT_NAME : 'helvetica';
  const setFont = (size, style='normal') => {
    doc.setFont(FONT, style === 'bold' && !useCyr ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const txt = (str, x, yPos) => doc.text(str, x, yPos);
  const checkPage = (need=10) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
  };

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const monthLabel = `${monthNames[month]} ${year}`;
  const { rows, sum } = Reports.collect(year, month);

  setFont(18, 'bold');
  txt('Отчёт тренера за месяц', M, y); y += 8;
  setFont(14, 'bold');
  txt(monthLabel, M, y); y += 7;
  setFont(10);
  txt(`Тренер: ${DB.settings.coachName || '—'}  •  Сезон: ${DB.settings.season || '—'}`, M, y); y += 5;
  txt(`Сформирован: ${formatDateRu(todayStr())}`, M, y); y += 8;

  setFont(13, 'bold');
  txt('Сводка', M, y); y += 6;
  if (doc.autoTable) {
    doc.autoTable({
      startY: y,
      head: [['Показатель', 'Значение']],
      body: [
        ['Всего тренировок', String(sum.total)],
        ['Индивидуальных', String(sum.personal)],
        ['Групповых', String(sum.group)],
        ['Самостоятельных', String(sum.self)],
        ['Количество бойцов', String(DB.fighters.length)]
      ],
      styles: { font: FONT, fontSize: 10, cellPadding: 2, textColor: [17,17,17] },
      headStyles: { fillColor: [230, 57, 70], textColor: 255, fontSize: 10, font: FONT, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 90 } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  checkPage(30);
  setFont(13, 'bold');
  txt('По бойцам', M, y); y += 6;
  if (doc.autoTable) {
    const body = rows.map(r => [
      r.name,
      groupShort(r.group),
      String(r.total),
      String(r.personal),
      String(r.group),
      String(r.self)
    ]);
    doc.autoTable({
      startY: y,
      head: [['Боец', 'Группа', 'Всего', 'Индивид.', 'Группа', 'Самост.']],
      body: body.length ? body : [['Нет данных','','','','','']],
      styles: { font: FONT, fontSize: 9, cellPadding: 2, textColor: [17,17,17] },
      headStyles: { fillColor: [74, 144, 226], textColor: 255, fontSize: 9, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  checkPage(30);
  setFont(13, 'bold');
  txt('Детально по тренировкам', M, y); y += 6;

  const allSlots = Reports.allSlots(year, month);

  if (allSlots.length && doc.autoTable) {
    const body = allSlots.map(s => [
      formatDateRu(s.date),
      String(s.hour).padStart(2,'0') + ':00',
      s.fighter,
      s.group,
      exerciseName(s.blockId),
      modeLabel(s.mode),
      s.comment
    ]);
    doc.autoTable({
      startY: y,
      head: [['Дата', 'Время', 'Боец', 'Группа', 'Упражнение', 'Формат', 'Комментарий']],
      body,
      styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: [17,17,17] },
      headStyles: { fillColor: [17,17,17], textColor: 255, fontSize: 8, font: FONT, fontStyle: 'normal' },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    setFont(10);
    txt('В этом месяце тренировок не было.', M, y); y += 6;
  }

  doc.save(`Отчёт_тренера_${month+1}_${year}.pdf`);
};