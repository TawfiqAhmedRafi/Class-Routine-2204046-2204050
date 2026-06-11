import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchMasterRoutine } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import SlotModal from '../components/SlotModal';
import { toast } from '../components/Toast';

// Series label colors to distinguish series rows visually
const SERIES_COLORS = [
  { accent: '#a8c2ff', bg: 'rgba(60,100,220,0.12)',  border: 'rgba(99,140,255,0.22)'  },
  { accent: '#7fffd4', bg: 'rgba(20,180,120,0.10)',  border: 'rgba(40,210,140,0.22)'  },
  { accent: '#f0c060', bg: 'rgba(240,190,60,0.10)',  border: 'rgba(240,190,60,0.22)'  },
  { accent: '#ddb8ff', bg: 'rgba(160,80,220,0.10)',  border: 'rgba(200,120,255,0.22)' },
  { accent: '#ffb0a8', bg: 'rgba(220,80,60,0.10)',   border: 'rgba(255,110,90,0.22)'  },
];

// Print-friendly type colors (light bg for white paper)
const PRINT_COLORS = {
  theory:     { bg: '#dce8ff', border: '#5a8aff', text: '#1a3a8c' },
  lab:        { bg: '#d4f7ea', border: '#18c980', text: '#0a5e3a' },
  assessment: { bg: '#ffe0dc', border: '#ff5a45', text: '#8c1a0a' },
  seminar:    { bg: '#eedcff', border: '#b060f0', text: '#5a1a8c' },
  project:    { bg: '#fff0cc', border: '#f0a020', text: '#7c4a00' },
};

function buildGrid(slots) {
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    NUM_PERIODS.forEach(p => { grid[d][p] = null; });
  });
  const consumed = {};
  slots.forEach(slot => {
    const key = `${slot.day}-${slot.startPeriod}`;
    if (!consumed[key]) {
      const span    = slot.periodSpan;
      const spanArr = typeof span === 'number'
        ? Array.from({ length: span }, (_, i) => slot.startPeriod + i)
        : (Array.isArray(span) ? span : [slot.startPeriod]);
      const normalized = { ...slot, periodSpan: spanArr };
      if (grid[slot.day]) grid[slot.day][slot.startPeriod] = normalized;
      spanArr.slice(1).forEach(p => {
        consumed[`${slot.day}-${p}`] = slot._id;
        if (grid[slot.day]) grid[slot.day][p] = 'CONSUMED';
      });
    }
  });
  return grid;
}

// Format room label for display
function formatRoom(rawRoom) {
  if (!rawRoom) return '';
  const lower = rawRoom.toLowerCase();
  if (lower.includes('seminar')) return 'Seminar';
  if (lower.includes('lab')) {
    const words = rawRoom.split(/[\s-]+/).filter(Boolean);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : rawRoom.substring(0, 2).toUpperCase();
  }
  const match = rawRoom.match(/^(?:R|Room)?\s*(\d+[A-Z]?)/i);
  return match ? match[1] : rawRoom;
}

// ── Interactive slot card (dark UI) ────────────────────────────────────────
function MiniSlotCell({ slot, onClick }) {
  if (!slot) return (
    <div style={{
      height: 44, borderRadius: 6,
      background: 'rgba(255,255,255,0.01)',
      border: '1px dashed rgba(255,255,255,0.04)',
    }} />
  );

  const c = COLORS[slot.type] || COLORS.theory;
  const formattedRoom = formatRoom(slot.room?.roomLabel || slot.room || '');

  return (
    <button
      onClick={() => onClick(slot)}
      style={{
        width: '100%', height: '100%', minHeight: 44,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 6, padding: '5px 7px',
        cursor: 'pointer', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 2,
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.badge }}>
          {slot.type}
        </div>
        {formattedRoom && (
          <div className="mono" style={{
            fontSize: 8, fontWeight: 600, color: 'rgba(150,170,210,0.7)',
            background: 'rgba(255,255,255,0.05)', padding: '1px 3px',
            borderRadius: 3, letterSpacing: '0.04em'
          }}>
            {formattedRoom}
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: c.text }}>
        {slot.courseCode}
      </div>
      <div style={{ fontSize: 8, color: 'rgba(180,200,230,0.6)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {(slot.teachers || slot.teacherInitials || []).join(', ')}
      </div>
    </button>
  );
}

// ── Interactive series grid (dark UI) ──────────────────────────────────────
function SeriesGrid({ cfg, slots, seriesColor, setModal }) {
  const grid = useMemo(() => buildGrid(slots), [slots]);

  return (
    <div style={{
      marginBottom: 28,
      border: `1px solid ${seriesColor.border}`,
      borderRadius: 14, overflow: 'hidden',
      background: 'rgba(255,255,255,0.008)',
    }}>
      {/* Series header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 18px',
        background: seriesColor.bg,
        borderBottom: `1px solid ${seriesColor.border}`,
      }}>
        <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: seriesColor.accent, lineHeight: 1 }}>
          {cfg.series}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cfg.currentSemester} semester · {slots.length} slot{slots.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {Object.entries(
            slots.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {})
          ).map(([type, count]) => (
            <div key={type} style={{
              fontSize: 10, fontWeight: 700,
              color: COLORS[type]?.badge || '#aaa',
              background: COLORS[type]?.bg || 'rgba(255,255,255,0.04)',
              border: `1px solid ${COLORS[type]?.border || 'rgba(255,255,255,0.1)'}`,
              borderRadius: 5, padding: '2px 8px', textTransform: 'capitalize',
            }}>{count} {type}</div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 14px', textAlign: 'left', fontSize: 9,
                color: 'rgba(140,165,215,0.4)', textTransform: 'uppercase',
                letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.015)', width: 52,
              }}>Day</th>
              {TIME_PERIODS.map(tp => (
                <th key={tp.period} style={{
                  padding: tp.isBreak ? '6px 3px' : '8px 4px',
                  textAlign: 'center', fontSize: tp.isBreak ? 7 : 9,
                  color: tp.isBreak ? 'rgba(255,200,80,0.4)' : 'rgba(140,165,215,0.5)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: tp.isBreak ? 'rgba(255,200,80,0.02)' : 'rgba(255,255,255,0.01)',
                  minWidth: tp.isBreak ? 32 : 78,
                  borderLeft: '1px solid rgba(255,255,255,0.03)',
                }}>
                  {tp.isBreak
                    ? <span style={{ writingMode: 'vertical-rl', fontSize: 7 }}>{tp.label}</span>
                    : <>
                        <div className="mono" style={{ fontSize: 10 }}>P{tp.period}</div>
                        <div style={{ fontSize: 7, color: 'rgba(110,135,190,0.4)' }}>{tp.start}</div>
                      </>
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => {
              const consumed = {};
              return (
                <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{
                    padding: '6px 14px', fontSize: 10, fontWeight: 700,
                    color: seriesColor.accent,
                    background: 'rgba(255,255,255,0.01)',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.04em',
                  }}>
                    {day.slice(0,3).toUpperCase()}
                  </td>
                  {TIME_PERIODS.map(tp => {
                    if (tp.isBreak) {
                      return (
                        <td key={tp.period} style={{
                          background: 'rgba(255,200,80,0.02)',
                          borderLeft: '1px solid rgba(255,255,255,0.03)',
                          minWidth: 32,
                        }} />
                      );
                    }
                    if (consumed[tp.period]) return null;
                    const slotVal = grid[day]?.[tp.period];
                    if (slotVal === 'CONSUMED') return null;
                    const slot    = slotVal || null;
                    const colSpan = slot ? (slot.periodSpan?.length || 1) : 1;
                    if (slot) {
                      (slot.periodSpan || []).slice(1).forEach(p => { consumed[p] = true; });
                    }
                    return (
                      <td key={tp.period} colSpan={colSpan} style={{
                        padding: 4, verticalAlign: 'top',
                        borderLeft: '1px solid rgba(255,255,255,0.03)',
                      }}>
                        <MiniSlotCell slot={slot} onClick={setModal} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PDF Print View ──────────────────────────────────────────────────────────
// Layout: 5 grids = 5 days, each grid = 9 cols (periods) × 5 rows (series 20-24)
function generatePrintHtml(seriesConfigs, data) {
  const sortedSeries = seriesConfigs
    .filter(c => c.isActive)
    .sort((a, b) => b.series - a.series); // 24 → 20 (top to bottom)

  // Build a lookup: seriesNum -> grid[day][period]
  const grids = {};
  sortedSeries.forEach(cfg => {
    const slots = data[cfg.series]?.slots || [];
    grids[cfg.series] = buildGrid(slots);
  });

  const periods = NUM_PERIODS; // [1,2,3,4,5,6,7,8,9]
  const timeMap = {};
  TIME_PERIODS.filter(t => !t.isBreak).forEach(t => { timeMap[t.period] = t; });

  const typeShort = { theory: 'TH', lab: 'LAB', assessment: 'ASMT', seminar: 'SEM', project: 'PROJ' };

  function cellHtml(slot, colSpan = 1) {
    if (!slot) return `<td colspan="${colSpan}" class="empty-cell"></td>`;
    const pc = PRINT_COLORS[slot.type] || PRINT_COLORS.theory;
    const room = formatRoom(slot.room?.roomLabel || slot.room || '');
    const teachers = (slot.teachers || slot.teacherInitials || []).join(', ');
    return `
      <td colspan="${colSpan}" class="slot-cell" style="background:${pc.bg};border-color:${pc.border}">
        <div class="slot-type" style="color:${pc.border}">${typeShort[slot.type] || slot.type}</div>
        <div class="slot-course">${slot.courseCode}</div>
        ${slot.courseTitle && slot.courseTitle !== slot.courseCode
          ? `<div class="slot-title">${slot.courseTitle}</div>`
          : ''}
        <div class="slot-meta">${teachers}${room ? ` · ${room}` : ''}</div>
      </td>`;
  }

  const dayTables = DAYS.map(day => {
    // Header row: period numbers + time
    const headerCells = periods.map(p => {
      const t = timeMap[p];
      return `<th class="period-header"><div class="p-num">P${p}</div><div class="p-time">${t.start}–${t.end}</div></th>`;
    }).join('');

    // One row per series
    const seriesRows = sortedSeries.map((cfg, idx) => {
      const grid = grids[cfg.series];
      const dayGrid = grid[day] || {};
      const consumed = {};
      const cells = periods.map(p => {
        if (consumed[p]) return null; // will be skipped
        const slotVal = dayGrid[p];
        if (slotVal === 'CONSUMED') return null;
        const slot = slotVal || null;
        const span = slot ? (slot.periodSpan?.length || 1) : 1;
        if (slot) {
          (slot.periodSpan || []).slice(1).forEach(pp => { consumed[pp] = true; });
        }
        return cellHtml(slot, span);
      }).filter(c => c !== null).join('');

      const rowColors = [
        { bg: '#eef3ff', label: '#3f6dff' },
        { bg: '#edfaf4', label: '#0a8c5a' },
        { bg: '#fdf7e8', label: '#b87000' },
        { bg: '#f4eeff', label: '#8a30d0' },
        { bg: '#fff0ee', label: '#c0392b' },
      ];
      const rc = rowColors[idx % rowColors.length];
      return `
        <tr>
          <td class="series-label" style="background:${rc.bg};color:${rc.label}">${cfg.series}<br><span class="series-sem">${cfg.currentSemester}</span></td>
          ${cells}
        </tr>`;
    }).join('');

    return `
      <div class="day-block">
        <div class="day-title">${day.toUpperCase()}</div>
        <table class="routine-table">
          <thead>
            <tr>
              <th class="series-col-header">Series</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${seriesRows}
          </tbody>
        </table>
      </div>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ETE Department — Master Class Routine</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A3 landscape; margin: 10mm 8mm; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    color: #111;
    background: #fff;
  }

  /* ── Header ── */
  .doc-header { text-align: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #222; }
  .doc-header .motto   { font-size: 8px; font-style: italic; color: #555; }
  .doc-header .uni     { font-size: 9px; font-weight: bold; margin: 2px 0; }
  .doc-header .dept    { font-size: 10px; font-weight: bold; }
  .doc-header .routine-title { font-size: 12px; font-weight: bold; margin-top: 4px; }
  .doc-header .subtitle { font-size: 8px; color: #555; margin-top: 2px; }

  /* ── Day blocks ── */
  .day-block { margin-bottom: 8px; }
  .day-title {
    font-size: 9px; font-weight: bold;
    background: #1a2a6c; color: #fff;
    padding: 3px 8px; border-radius: 3px 3px 0 0;
    letter-spacing: 0.08em;
  }

  /* ── Tables ── */
  .routine-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .routine-table th, .routine-table td {
    border: 1px solid #bbb;
    vertical-align: top;
    padding: 2px 3px;
    font-size: 7.5px;
  }

  /* Column widths */
  .series-col-header, .series-label { width: 34px; text-align: center; }

  .period-header {
    background: #e8edf8;
    text-align: center;
    font-weight: bold;
    padding: 3px 2px;
  }
  .p-num  { font-size: 8px; font-weight: bold; color: #1a2a6c; }
  .p-time { font-size: 6px; color: #555; }

  .series-label {
    font-size: 9px; font-weight: bold;
    text-align: center; vertical-align: middle;
    line-height: 1.3;
  }
  .series-sem { font-size: 5.5px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.04em; }

  /* Slot cells */
  .slot-cell {
    vertical-align: top;
    padding: 2px 3px;
    border-left: 2px solid;
  }
  .slot-type  { font-size: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; }
  .slot-course { font-size: 8px; font-weight: bold; color: #111; line-height: 1.2; }
  .slot-title { font-size: 6.5px; color: #333; line-height: 1.2; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .slot-meta  { font-size: 6px; color: #555; margin-top: 1px; }

  .empty-cell { background: #fafafa; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #ccc;
    padding-top: 5px;
    font-size: 7px;
    color: #555;
  }
  .doc-footer .note { font-style: italic; }
  .doc-footer .signature { text-align: right; }
  .doc-footer .signature strong { font-size: 8px; display: block; margin-top: 18px; border-top: 1px solid #555; padding-top: 2px; }

  /* ── Time legend ── */
  .legend {
    display: flex;
    gap: 10px;
    margin-bottom: 6px;
    flex-wrap: wrap;
    font-size: 6.5px;
  }
  .legend-item { display: flex; align-items: center; gap: 3px; }
  .legend-dot  { width: 8px; height: 8px; border-radius: 2px; }
</style>
</head>
<body>

<div class="doc-header">
  <div class="motto">Heaven's Light is Our Guide</div>
  <div class="uni">Rajshahi University of Engineering &amp; Technology</div>
  <div class="dept">Department of Electronics &amp; Telecommunication Engineering</div>
  <div class="routine-title">Master Class Routine — All Series (20–24)</div>
  <div class="subtitle">Printed on ${today} &nbsp;|&nbsp; Each grid = one day &nbsp;|&nbsp; Rows = Series &nbsp;|&nbsp; Columns = Time Periods</div>
</div>

<div class="legend">
  <strong style="font-size:7px">Type:</strong>
  ${Object.entries(PRINT_COLORS).map(([type, pc]) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${pc.bg};border:1px solid ${pc.border}"></div>${type.toUpperCase()}</div>`
  ).join('')}
</div>

${dayTables}

<div class="doc-footer">
  <div class="note">
    Note: Please follow this routine strictly.<br/>
    &quot;There will be no further change.&quot;<br/>
    P&amp;LB = Prayer &amp; Lunch Break &nbsp;|&nbsp; Break = 10:30–10:50
  </div>
  <div class="signature">
    Head of the Department<br/>
    <strong>Prof. Dr. Md. Kamal Hosain</strong>
  </div>
</div>

</body>
</html>`;
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function MasterRoutine({ user }) {
  const [data,          setData]          = useState({});
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [batch,         setBatch]         = useState('all');
  const [modal,         setModal]         = useState(null);
  const [printing,      setPrinting]      = useState(false);

  function load(b = batch) {
    setLoading(true);
    setError(null);
    fetchMasterRoutine(b)
      .then(res => {
        if (res.success) {
          setData(res.data);
          setSeriesConfigs(res.seriesConfigs || []);
        }
      })
      .catch(err => {
        setError(err?.response?.data?.message || 'Failed to load master routine');
        toast('Failed to load master routine', '#ff7a6a', 'rgba(255,90,69,0.35)');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleBatch(b) {
    setBatch(b);
    load(b);
  }

  async function handlePrintPDF() {
    setPrinting(true);
    try {
      const activeConfigs = seriesConfigs.filter(c => c.isActive);
      if (activeConfigs.length === 0) {
        toast('No active series to print', '#f0c060', 'rgba(240,190,60,0.3)');
        setPrinting(false);
        return;
      }

      // ── 1. Dynamically load jsPDF and html2canvas from CDN ──
      function loadScript(src) {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
          const s = document.createElement('script');
          s.src = src; s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      // ── 2. Build the routine HTML and inject it into a hidden off-screen div ──
      const html = generatePrintHtml(activeConfigs, data);
      const container = document.createElement('div');
      container.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:1587px',   // A3 landscape at 96dpi ≈ 420mm
        'background:#fff',
        'font-family:Arial,Helvetica,sans-serif',
        'padding:20px',
        'z-index:-1',
      ].join(';');

      // Extract just the <body> content from the generated HTML
      const parser   = new DOMParser();
      const doc      = parser.parseFromString(html, 'text/html');

      // Inline the <style> so html2canvas picks it up
      const style    = document.createElement('style');
      style.textContent = doc.querySelector('style')?.textContent || '';
      container.appendChild(style);

      // Copy body children
      Array.from(doc.body.children).forEach(el => {
        container.appendChild(document.importNode(el, true));
      });

      document.body.appendChild(container);

      // Small delay so browser can render/layout
      await new Promise(r => setTimeout(r, 300));

      // ── 3. Capture with html2canvas ──
      const canvas = await window.html2canvas(container, {
        scale: 2,           // 2× for crisp text
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
      });

      document.body.removeChild(container);

      // ── 4. Split canvas into A3-landscape pages and build PDF ──
      const { jsPDF } = window.jspdf;
      // A3 landscape in mm: 420 × 297
      const PAGE_W = 420, PAGE_H = 297;
      const pdf    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

      const imgW   = canvas.width;
      const imgH   = canvas.height;

      // How many mm does 1 canvas-pixel represent in the PDF?
      const mmPerPx   = PAGE_W / imgW;
      const pageHpx   = PAGE_H / mmPerPx;      // canvas pixels that fit in one page height
      let   yOffset   = 0;
      let   firstPage = true;

      while (yOffset < imgH) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        // Crop a horizontal strip from the canvas
        const sliceH  = Math.min(pageHpx, imgH - yOffset);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width  = imgW;
        tmpCanvas.height = sliceH;
        const ctx = tmpCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);

        const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92);
        const drawH   = sliceH * mmPerPx;
        pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, drawH, '', 'FAST');

        yOffset += pageHpx;
      }

      // ── 5. Save ──
      const fname = `ETE_Master_Routine_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fname);
      toast('PDF downloaded!', '#7fffd4', 'rgba(20,180,120,0.3)');
    } catch (e) {
      console.error(e);
      toast('Failed to generate PDF — ' + e.message, '#ff7a6a', 'rgba(255,90,69,0.35)');
    } finally {
      setPrinting(false);
    }
  }

  const totalSlots = Object.values(data).reduce((sum, d) => sum + (d.slots?.length || 0), 0);
  const totalLabs  = Object.values(data).reduce((sum, d) => sum + (d.slots?.filter(s => s.type === 'lab').length || 0), 0);

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.2em',
          color: 'rgba(99,140,255,0.65)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          Master Overview · All Active Series
        </div>
        <h1 className="grad-text" style={{
          fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          ETE Department · Full Routine
        </h1>
        <p style={{ color: 'rgba(140,165,215,0.5)', fontSize: 13, margin: '4px 0 0' }}>
          {seriesConfigs.length} active series · {totalSlots} total slots · {totalLabs} labs
          {loading && <span style={{ marginLeft: 12, color: 'rgba(99,140,255,0.5)', fontSize: 11 }}>⟳ Loading…</span>}
        </p>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Batch filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batch</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[{k:'all',l:'All'},{k:'1st30',l:'1st 30'},{k:'2nd30',l:'2nd 30'}].map(b => (
              <button key={b.k} onClick={() => handleBatch(b.k)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: batch === b.k ? 'rgba(240,190,60,0.2)' : 'transparent',
                color: batch === b.k ? '#f0c060' : 'rgba(150,170,210,0.5)',
                fontSize: 12, fontWeight: batch === b.k ? 700 : 400, transition: 'all 0.15s',
              }}>{b.l}</button>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            ['Series', seriesConfigs.length, '#a8c2ff'],
            ['Slots',  totalSlots,            '#7fffd4'],
            ['Labs',   totalLabs,             '#f0c060'],
          ].map(([label, val, color]) => (
            <div key={label} style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, textAlign: 'center',
            }}>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 9, color: 'rgba(140,165,215,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── PDF Download Button ── */}
        <button
          onClick={handlePrintPDF}
          disabled={printing || loading || seriesConfigs.length === 0}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: printing || loading
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(135deg, rgba(99,140,255,0.25) 0%, rgba(99,140,255,0.15) 100%)',
            border: '1px solid rgba(99,140,255,0.45)',
            borderRadius: 10, cursor: printing || loading ? 'not-allowed' : 'pointer',
            color: printing || loading ? 'rgba(150,170,210,0.4)' : '#a8c2ff',
            fontSize: 13, fontWeight: 700,
            transition: 'all 0.18s',
            boxShadow: printing || loading ? 'none' : '0 0 18px rgba(99,140,255,0.15)',
          }}
          onMouseEnter={e => { if (!printing && !loading) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,140,255,0.38) 0%, rgba(99,140,255,0.25) 100%)'; }}
          onMouseLeave={e => { if (!printing && !loading) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,140,255,0.25) 0%, rgba(99,140,255,0.15) 100%)'; }}
        >
          {/* PDF Icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 1.5A1.5 1.5 0 014.5 0h5.086a1.5 1.5 0 011.06.44l2.915 2.914A1.5 1.5 0 0114 4.414V14.5A1.5 1.5 0 0112.5 16h-8A1.5 1.5 0 013 14.5v-13z"
              fill="currentColor" opacity="0.18"/>
            <path d="M9.5 0v3.5A1.5 1.5 0 0011 5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            <text x="3.5" y="13.5" fontFamily="Arial" fontSize="5.5" fontWeight="bold" fill="currentColor">PDF</text>
          </svg>
          {printing ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </div>

      {/* Day legend */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {DAYS.map(d => (
          <div key={d} style={{
            padding: '4px 10px', borderRadius: 5,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, color: 'rgba(160,180,220,0.6)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{d}</div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {Object.entries(COLORS).map(([type, c]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.badge, opacity: 0.85 }} />
              <span style={{ fontSize: 10, color: 'rgba(150,170,210,0.6)', textTransform: 'capitalize' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', marginBottom: 16,
          background: 'rgba(220,60,40,0.08)', border: '1px solid rgba(255,90,69,0.25)',
          borderRadius: 10, color: '#ff8070', fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{
              height: 220, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)',
              animation: 'shimmer 1.5s ease infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      )}

      {/* Series grids */}
      {!loading && seriesConfigs
        .filter(c => c.isActive)
        .sort((a, b) => b.series - a.series)
        .map((cfg, idx) => {
          const seriesData = data[cfg.series];
          if (!seriesData) return null;
          return (
            <SeriesGrid
              key={cfg.series}
              cfg={cfg}
              slots={seriesData.slots || []}
              seriesColor={SERIES_COLORS[idx % SERIES_COLORS.length]}
              setModal={setModal}
            />
          );
        })
      }

      {!loading && seriesConfigs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          color: 'rgba(140,165,215,0.3)', fontSize: 14,
        }}>
          No active series found. Add series from the HOD Panel.
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 12, padding: '12px 16px',
        background: 'rgba(255,200,80,0.05)', border: '1px solid rgba(255,200,80,0.14)',
        borderRadius: 10, fontSize: 11, color: 'rgba(220,185,80,0.65)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'rgba(240,200,100,0.85)' }}>Master Routine:</strong>{' '}
        Shows all active series simultaneously. Each series uses its current HOD-configured semester.
        Click any slot to view details. Use the Batch filter to see specific group schedules.
        Use <strong style={{ color: 'rgba(240,200,100,0.85)' }}>Download PDF</strong> to print the
        official A3-landscape routine with all 5 days as separate grids.
      </div>

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}