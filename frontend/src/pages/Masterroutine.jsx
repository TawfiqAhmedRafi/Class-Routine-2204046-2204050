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

// ── PDF Print View — faithful copy of the printed reference ───────────────
// Strategy: instead of one giant merged table (which breaks with colspan slots),
// use a CSS-grid/flex outer shell with SEPARATE tables per day that are forced
// to identical widths. Each table is independent so colspan never bleeds across days.
// The "gap" between days is just margin/padding on the wrapper — no blue <td> in headers.
// Series labels are rendered as an absolutely-positioned left strip so all day tables
// share the same row heights automatically via equal min-height on <tr>.

function generatePrintHtml(seriesConfigs, allData) {
  const sortedSeries = [...seriesConfigs]
    .filter(c => c.isActive)
    .sort((a, b) => a.series - b.series);

  const grids = {};
  sortedSeries.forEach(cfg => {
    grids[cfg.series] = buildGrid(allData[cfg.series]?.slots || []);
  });

  const periods = NUM_PERIODS; // [1..9]
  const timeMap = {};
  TIME_PERIODS.filter(t => !t.isBreak).forEach(t => { timeMap[t.period] = t; });

  const TOP_DAYS    = ['Saturday', 'Sunday', 'Monday'];
  const BOTTOM_DAYS = ['Tuesday', 'Wednesday'];

  const TEACHERS = [
    { init: 'MKH', name: 'Dr. Md. Kamal Hosain' },
    { init: 'MFS', name: 'Dr. Mst. Fateha Samad' },
    { init: 'AM',  name: 'Md. Aslam Mollah' },
    { init: 'RKH', name: 'Md. Rakib Hossain' },
    { init: 'FZA', name: 'Farzana Akter' },
    { init: 'HS',  name: 'Hasan Sarker' },
    { init: 'AIS', name: 'Abu Ismail Siddique' },
    { init: 'ST',  name: 'Sharaf Tasnim' },
    { init: 'NIN', name: 'Nazmul Islam Nahin' },
    { init: 'RA',  name: 'Rubaeat Ahammed' },
    { init: 'RTM', name: 'Rifa Tabassum Mim' },
  ];

  const TIME_SCHED = [
    { period: '1st',   time: '8:00–8:50' },
    { period: '2nd',   time: '8:50–9:40' },
    { period: '3rd',   time: '9:40–10:30' },
    { period: 'Break', time: '10:30–10:50', isBreak: true },
    { period: '4th',   time: '10:50–11:40' },
    { period: '5th',   time: '11:40–12:30' },
    { period: '6th',   time: '12:30–1:20' },
    { period: 'P&LB',  time: '1:20–2:30',  isBreak: true },
    { period: '7th',   time: '2:30–3:20' },
    { period: '8th',   time: '3:20–4:10' },
    { period: '9th',   time: '4:10–5:00' },
  ];

  const ROW_STYLES = [
    { labelBg: '#d6e4ff', labelColor: '#1a3a8c', rowBg: '#f5f8ff' },
    { labelBg: '#d4f4e8', labelColor: '#0a5e3a', rowBg: '#f0fbf5' },
    { labelBg: '#fde8d0', labelColor: '#7c3a00', rowBg: '#fffaf5' },
    { labelBg: '#e8d8ff', labelColor: '#5a1a8c', rowBg: '#faf5ff' },
    { labelBg: '#ffd6d0', labelColor: '#8c1a0a', rowBg: '#fff5f4' },
  ];

  const PC = {
    theory:     { bg: '#dce8ff', border: '#5a8aff' },
    lab:        { bg: '#d4f7ea', border: '#18c980' },
    assessment: { bg: '#ffe0dc', border: '#ff5a45' },
    seminar:    { bg: '#eedcff', border: '#b060f0' },
    project:    { bg: '#fff0cc', border: '#f0a020' },
  };

  const ROW_H = 38; // px — fixed row height so all day tables align

  // ── Slot cell ─────────────────────────────────────────────────────────────
  function slotTd(slot, colspan, rowBg) {
    if (!slot) return `<td colspan="${colspan}" style="border:0.5px solid #ccc;background:${rowBg};padding:1px;height:${ROW_H}px;"></td>`;
    const pc        = PC[slot.type] || PC.theory;
    const room      = formatRoom(slot.room?.roomLabel || slot.room || '');
    const teacher   = (slot.teachers || slot.teacherInitials || []).join('/');
    const code      = slot.courseCode || '';
    const isSpecial = slot.type === 'lab' || slot.type === 'project';
    const title     = isSpecial ? (slot.courseTitle || code) : code;
    return `<td colspan="${colspan}" style="border:0.5px solid #ccc;border-left:2.5px solid ${pc.border};background:${pc.bg};padding:2px 3px;vertical-align:top;overflow:hidden;height:${ROW_H}px;">
      <div style="font-size:6.5px;font-weight:700;color:#111;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
      ${isSpecial ? `<div style="font-size:5.5px;color:#444;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${code}</div>` : ''}
      <div style="font-size:5.5px;color:#555;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teacher}${room ? ' · ' + room : ''}</div>
    </td>`;
  }

  // ── Build ONE day table (no label column — labels are in a separate left strip) ──
  function buildOneDayTable(day) {
    // Period header row
    const periodHdr = periods.map(p => {
      const t = timeMap[p];
      return `<th style="background:#e2e9f8;text-align:center;border:0.5px solid #bbb;padding:1px 0;white-space:nowrap;">
        <span style="display:block;font-size:6.5px;font-weight:700;color:#1a2a6c;">P${p}</span>
        <span style="display:block;font-size:5px;color:#555;">${t.start}</span>
      </th>`;
    }).join('');

    // Data rows
    const bodyRows = sortedSeries.map((cfg, idx) => {
      const rs       = ROW_STYLES[idx % ROW_STYLES.length];
      const dayGrid  = grids[cfg.series][day] || {};
      const consumed = {};
      const cells = periods.map(p => {
        if (consumed[p]) return null;
        const val  = dayGrid[p];
        if (val === 'CONSUMED') return null;
        const slot = val || null;
        const span = slot ? (slot.periodSpan?.length || 1) : 1;
        if (slot) (slot.periodSpan || []).slice(1).forEach(pp => { consumed[pp] = true; });
        return slotTd(slot, span, rs.rowBg);
      }).filter(Boolean).join('');
      return `<tr style="height:${ROW_H}px;">${cells}</tr>`;
    }).join('');

    // colgroup: 9 equal columns, table-layout:fixed
    const colgroup = `<colgroup>${periods.map(() => `<col/>`).join('')}</colgroup>`;

    return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;">
      <!-- Day name banner -->
      <div style="background:#1a2a6c;color:#fff;text-align:center;font-size:8px;font-weight:800;letter-spacing:.08em;padding:3px 0;border:0.5px solid #0d1a52;">${day.toUpperCase()}</div>
      <!-- Period/data table -->
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;flex:1;">
        ${colgroup}
        <thead>
          <tr>${periodHdr}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  }

  // ── Series label strip (left column, same height as day tables) ───────────
  // We render a tiny table with the same row heights so it lines up.
  function buildLabelStrip() {
    // Header area: day banner height (≈18px) + period header height (≈18px) = 36px
    const headerPlaceholder = `<div style="height:36px;background:#1a2a6c;border:0.5px solid #0d1a52;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:6px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:.08em;">Series</span>
    </div>`;
    const rows = sortedSeries.map((cfg, idx) => {
      const rs       = ROW_STYLES[idx % ROW_STYLES.length];
      const semLabel = cfg.currentSemester === 'odd' ? 'ODD SEM' : 'EVEN SEM';
      return `<div style="height:${ROW_H}px;display:flex;align-items:center;justify-content:center;background:${rs.labelBg};border:0.5px solid #bbb;border-right:2.5px solid ${rs.labelColor};padding:2px;">
        <div style="text-align:center;color:${rs.labelColor};font-size:6px;font-weight:800;line-height:1.4;">
          ${semLabel}<br/><span style="font-size:7.5px;">${cfg.series} Series</span>
        </div>
      </div>`;
    }).join('');
    return `<div style="width:50px;flex-shrink:0;display:flex;flex-direction:column;">
      ${headerPlaceholder}
      ${rows}
    </div>`;
  }

  // ── Half-page block (label strip + day tables side by side) ───────────────
  function buildHalf(days) {
    const dayTables = days.map(d => buildOneDayTable(d)).join('');
    return `<div style="display:flex;gap:5px;align-items:stretch;">
      ${buildLabelStrip()}
      ${dayTables}
    </div>`;
  }

  // ── Teachers + Time panel ─────────────────────────────────────────────────
  const teacherRows = TEACHERS.map(t =>
    `<tr>
      <td style="font-size:6px;font-weight:700;color:#1a2a6c;padding:1px 3px;border:0.5px solid #ccc;white-space:nowrap;">${t.init}</td>
      <td style="font-size:6px;padding:1px 3px;border:0.5px solid #ccc;white-space:nowrap;color:#18191f;">${t.name}</td>
    </tr>`
  ).join('');

  const timeRows = TIME_SCHED.map(r => {
    const isBreak = r.isBreak;
    return `<tr style="${isBreak ? 'background:#fffbe6;' : ''}">
      <td style="font-size:6px;font-weight:${isBreak ? '700' : '600'};padding:1px 3px;border:0.5px solid #ccc;white-space:nowrap;color:${isBreak ? '#b87000' : '#111'};">${r.period}</td>
      <td style="font-size:6px;padding:1px 3px;border:0.5px solid #ccc;white-space:nowrap;color:${isBreak ? '#b87000' : '#333'};">${r.time}</td>
    </tr>`;
  }).join('');

  const rightPanel = `
    <div style="width:150px;flex-shrink:0;display:flex;flex-direction:column;gap:3px;margin-left:4px;">
      <div>
        <div style="background:#1a2a6c;color:#fff;font-size:7px;font-weight:700;padding:2px 4px;letter-spacing:.06em;">Teachers of ETE</div>
        <table style="border-collapse:collapse;width:100%;">${teacherRows}</table>
      </div>
      <div>
        <div style="background:#1a2a6c;color:#fff;font-size:7px;font-weight:700;padding:2px 4px;letter-spacing:.06em;">Period &amp; Time Schedule</div>
        <table style="border-collapse:collapse;width:100%;">${timeRows}</table>
      </div>
    </div>`;

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ETE Department — Master Class Routine</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: legal landscape; margin: 7mm 6mm; }
  html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; }
</style>
</head>
<body>

<!-- ── Page Header ── -->
<div style="text-align:center;margin-bottom:5px;line-height:1.55;">
  <div style="font-size:7px;font-style:italic;color:#555;">Heaven's Light is Our Guide</div>
  <div style="font-size:8px;font-weight:700;color:#18191f;">Rajshahi University of Engineering &amp; Technology</div>
  <div style="font-size:9px;font-weight:800;color:#18191f;">Department of Electronics &amp; Telecommunication Engineering</div>
  <div style="font-size:9px;font-weight:700; color:#18191f;">Class Routine for all Series</div>
  <div style="font-size:7px;color:#555;">Effective from \`${today}\` </div>
</div>

<!-- ── TOP: Saturday | Sunday | Monday ── -->
<div style="margin-bottom:6px;">
  ${buildHalf(TOP_DAYS)}
</div>

<!-- ── BOTTOM: Tuesday | Wednesday  +  right panel ── -->
<div style="display:flex;align-items:flex-start;gap:0;">
  <div style="flex:1;min-width:0;">${buildHalf(BOTTOM_DAYS)}</div>
  ${rightPanel}
</div>

<!-- ── Footer ── -->
<div style="margin-top:6px;display:flex;justify-content:space-between;align-items:flex-end;">
  <div style="font-size:6.5px;color:#333;line-height:1.7;">
    <strong>Note: Please follow this routine strictly</strong><br/>
    &quot; There will be no further change &quot;<br/>
    <span style="color:#888;">P&amp;LB = Prayer &amp; Lunch Break &nbsp;|&nbsp; Printed: ${today}</span>
  </div>
  <div style="text-align:right;font-size:6.5px;color:#333;line-height:1.7;">
    Head of the Dept: _______________<br/>
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
      // Legal landscape: 355.6mm × 215.9mm → at 96dpi: 1344 × 816 px
      container.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:1344px',
        'background:#fff',
        'font-family:Arial,Helvetica,sans-serif',
        'padding:26px 23px',   // ~7mm margins at 96dpi
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

      // Wait for layout to settle
      await new Promise(r => setTimeout(r, 400));

      // ── 3. Capture with html2canvas at fixed legal-page height ──
      // Legal landscape px at 96dpi: 1344 wide × 816 tall
      const LEGAL_PX_W = 1344;
      const LEGAL_PX_H = 816;

      const canvas = await window.html2canvas(container, {
        scale: 3,           // 3× for crisp small text
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width:  LEGAL_PX_W,
        height: LEGAL_PX_H,
        windowWidth: LEGAL_PX_W,
        windowHeight: LEGAL_PX_H,
      });

      document.body.removeChild(container);

      // ── 4. Place on one legal landscape page ──
      const { jsPDF } = window.jspdf;
      // Legal: 355.6 × 215.9 mm
      const PAGE_W = 355.6, PAGE_H = 215.9;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });

      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, PAGE_H, '', 'FAST');

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