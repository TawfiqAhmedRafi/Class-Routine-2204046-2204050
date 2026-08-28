import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchMasterRoutine, fetchTeachers } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import SlotModal from '../components/SlotModal';
import { toast } from '../components/Toast';

// Series label colors to distinguish series rows visually (interactive dark UI only —
// the printed PDF is intentionally black & white, see generatePrintHtml below)
const SERIES_COLORS = [
  { accent: '#a8c2ff', bg: 'rgba(60,100,220,0.12)',  border: 'rgba(99,140,255,0.22)'  },
  { accent: '#7fffd4', bg: 'rgba(20,180,120,0.10)',  border: 'rgba(40,210,140,0.22)'  },
  { accent: '#f0c060', bg: 'rgba(240,190,60,0.10)',  border: 'rgba(240,190,60,0.22)'  },
  { accent: '#ddb8ff', bg: 'rgba(160,80,220,0.10)',  border: 'rgba(200,120,255,0.22)' },
  { accent: '#ffb0a8', bg: 'rgba(220,80,60,0.10)',   border: 'rgba(255,110,90,0.22)'  },
];

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

// Format room label for the INTERACTIVE dark-mode grid only (compact abbreviation
// makes sense in the small on-screen cards). The printed PDF uses the raw text —
// see printRoomLine() below — because the office routine never abbreviates rooms.
function formatRoom(rawRoom) {
  if (!rawRoom) return '';
  const lower = rawRoom.toLowerCase();
  if (lower.includes('seminar')) return 'Seminar';
  if (lower.includes('computer')) return 'CmL';
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

// ── PDF Print View — pixel-faithful reproduction of the official office routine ──
// The real routine (see reference PDF) is a single, plain black-and-white grid:
//   • One merged table per day-block (Sat/Sun/Mon on top, Tue/Wed on bottom),
//     with a narrow "Day → / →Period" label column, then 9 period columns PER DAY,
//     all inside ONE <table> so borders and colspans line up across the whole block.
//   • Every occupied cell is exactly 3 stacked lines, centered, no color, no accent
//     border: Room (or lab/lecture title when there's no plain room) → Course code
//     → Teacher initials.
//   • Left row-label column: "EVEN SEM" / "(21 Series)" stacked, bold, left-aligned.
//   • Bottom-right: "Teachers of ETE" and "Period & Time Schedule" as their own
//     small plain tables, with a "P&LB = Prayer & Lunch Break" note above them.
// No fills, no accent colors anywhere — only black text on white with thin black rules.

function generatePrintHtml(seriesConfigs, allData, teachersList) {
  const sortedSeries = [...seriesConfigs]
    .filter(c => c.isActive)
    .sort((a, b) => a.series - b.series);

  const grids = {};
  sortedSeries.forEach(cfg => {
    grids[cfg.series] = buildGrid(allData[cfg.series]?.slots || []);
  });

  const periods = NUM_PERIODS; // [1..9]

  const TOP_DAYS    = ['Saturday', 'Sunday', 'Monday'];
  const BOTTOM_DAYS = ['Tuesday', 'Wednesday'];

  // Teachers pulled live from the database, ordered by designation rank:
  // Professor & HOD → Professor → Associate Professor → Assistant Professor → Lecturer,
  // then by seniority within that rank.
  function designationRank(t) {
    const role  = (t.role || '').toLowerCase();
    const desig = (t.designation || '').toLowerCase();
    if (role === 'hod') return 0;
    if (desig.includes('professor') && !desig.includes('associate') && !desig.includes('assistant')) return 1;
    if (desig.includes('associate professor')) return 2;
    if (desig.includes('assistant professor')) return 3;
    if (desig.includes('lecturer')) return 4;
    return 5;
  }

  const SENIORITY_ORDER = [
    'kamal', 'fateha', 'aslam', 'yeakub', 'rakib', 'farzana', 'hasan',
    'saif', 'sharaf', 'nahin', 'rubaeat', 'rifa', 'mahmudul', 'rakibul',
  ];
  function seniorityIndex(name) {
    const words = (name || '').toLowerCase().replace(/[.,]/g, '').split(/\s+/);
    const idx = SENIORITY_ORDER.findIndex(key => words.includes(key));
    return idx === -1 ? SENIORITY_ORDER.length : idx;
  }

  const TEACHERS = (teachersList || [])
    .map(t => ({
      init: t.credentials?.initials || '',
      name: t.name || '',
      designation: t.designation || '',
      role: t.role || '',
    }))
    .filter(t => t.init)
    .sort((a, b) => {
      const rankDiff = designationRank(a) - designationRank(b);
      if (rankDiff !== 0) return rankDiff;
      const seniorityDiff = seniorityIndex(a.name) - seniorityIndex(b.name);
      if (seniorityDiff !== 0) return seniorityDiff;
      return a.name.localeCompare(b.name);
    });

  const TIME_SCHED = [
    { period: '1st',   time: '8.00-8.50' },
    { period: '2nd',   time: '8.50-9.40' },
    { period: '3rd',   time: '9.40-10.30' },
    { period: 'Break', time: '10.30-10.50' },
    { period: '4th',   time: '10.50-11.40' },
    { period: '5th',   time: '11.40-12.30' },
    { period: '6th',   time: '12.30-1.20' },
    { period: 'P&LB',  time: '1.20-2.30' },
    { period: '7th',   time: '2.30-3.20' },
    { period: '8th',   time: '3.20-4.10' },
    { period: '9th',   time: '4.10-5.00' },
  ];

  // ── Layout constants (px, at the 1344px-wide capture container used below) ──
  const LABEL_COL   = 72;   // "Day →" / series-label column
  const PERIOD_COL  = 45;   // each of the 9 period columns
  const PANEL_W     = 9 * PERIOD_COL; // right panel = width of one day-block (405px)
  const ROW_H       = 42;   // data row height (fits 3 stacked lines)
  const HEAD1_H     = 18;   // "Day →" / day-name row
  const HEAD2_H     = 16;   // "→Period" / period-number row
  const BORDER      = '0.75px solid #000';

  const fmt = v => (v === null || v === undefined) ? '' : String(v).trim();

  // Raw room text as entered in the routine — NOT abbreviated. Falls back to the
  // course title (then course code) when a slot has no room, matching entries
  // like "Project Design and Development II" which print with no room number.
  function printRoomLine(slot) {
    const room = fmt(slot.room?.roomLabel || slot.room || '');
    if (room) return room;
    return fmt(slot.courseTitle) || fmt(slot.courseCode);
  }

  // One data cell: 3 centered lines, no fill, no accent border — plain B&W.
  function printCell(slot, colspan) {
    if (!slot) {
      return `<td colspan="${colspan}" style="border:${BORDER};height:${ROW_H}px;"></td>`;
    }
    const line1   = printRoomLine(slot);
    const code    = fmt(slot.courseCode);
    const teacher = (slot.teachers || slot.teacherInitials || []).filter(Boolean).join('/');
    return `<td colspan="${colspan}" style="border:${BORDER};padding:1px 2px;text-align:center;vertical-align:middle;height:${ROW_H}px;overflow:hidden;">
      <div style="font-size:7.5px;line-height:1.25;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${line1}</div>
      <div style="font-size:7.5px;line-height:1.25;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${code}</div>
      <div style="font-size:7.5px;line-height:1.25;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teacher}</div>
    </td>`;
  }

  // ── One merged table for a block of days (top = 3 days, bottom = 2 days) ──
  function buildDayBlockTable(daysList) {
    const totalW = LABEL_COL + daysList.length * periods.length * PERIOD_COL;

    const colgroup = `<colgroup>
      <col style="width:${LABEL_COL}px"/>
      ${daysList.map(() => periods.map(() => `<col style="width:${PERIOD_COL}px"/>`).join('')).join('')}
    </colgroup>`;

    const dayHeaderRow = `<tr>
      <th style="border:${BORDER};font-size:7px;font-weight:700;height:${HEAD1_H}px;">Day →</th>
      ${daysList.map(d => `<th colspan="${periods.length}" style="border:${BORDER};font-size:9px;font-weight:700;height:${HEAD1_H}px;">${d}</th>`).join('')}
    </tr>`;

    const periodHeaderRow = `<tr>
      <th style="border:${BORDER};font-size:6.5px;font-weight:700;height:${HEAD2_H}px;">→Period</th>
      ${daysList.map(() => periods.map(p => `<th style="border:${BORDER};font-size:7.5px;font-weight:700;height:${HEAD2_H}px;">${p}</th>`).join('')).join('')}
    </tr>`;

    const bodyRows = sortedSeries.map(cfg => {
      const semLabel = cfg.currentSemester === 'odd' ? 'ODD SEM' : 'EVEN SEM';
      const dayCells = daysList.map(day => {
        const dayGrid  = grids[cfg.series][day] || {};
        const consumed = {};
        return periods.map(p => {
          if (consumed[p]) return '';
          const val = dayGrid[p];
          if (val === 'CONSUMED') return '';
          const slot = val || null;
          const span = slot ? (slot.periodSpan?.length || 1) : 1;
          if (slot) (slot.periodSpan || []).slice(1).forEach(pp => { consumed[pp] = true; });
          return printCell(slot, span);
        }).join('');
      }).join('');

      return `<tr>
        <td style="border:${BORDER};padding:2px 4px;text-align:left;vertical-align:middle;height:${ROW_H}px;">
          <div style="font-size:7.5px;font-weight:700;color:#000;white-space:nowrap;">${semLabel}</div>
          <div style="font-size:7.5px;font-weight:700;color:#000;white-space:nowrap;">(${cfg.series} Series)</div>
        </td>
        ${dayCells}
      </tr>`;
    }).join('');

    return `<table style="width:${totalW}px;border-collapse:collapse;table-layout:fixed;">
      ${colgroup}
      <thead>${dayHeaderRow}${periodHeaderRow}</thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  }

  // ── Right-side panel: P&LB note + Teachers of ETE + Period & Time Schedule ──
  function buildRightPanel() {
    const teacherRows = TEACHERS.map(t => `<tr>
      <td style="border:${BORDER};font-size:6.5px;padding:1px 3px;white-space:nowrap;color:#000;">${t.init}</td>
      <td style="border:${BORDER};font-size:6.5px;padding:1px 3px;white-space:nowrap;color:#000;">${t.name}</td>
    </tr>`).join('');

    const timeRows = TIME_SCHED.map(r => `<tr>
      <td style="border:${BORDER};font-size:6.5px;padding:1px 3px;white-space:nowrap;color:#000;">${r.period}</td>
      <td style="border:${BORDER};font-size:6.5px;padding:1px 3px;white-space:nowrap;color:#000;">${r.time}</td>
    </tr>`).join('');

    return `<div style="width:${PANEL_W}px;flex-shrink:0;display:flex;flex-direction:column;">
      <div style="text-align:right;font-size:7px;color:#000;padding:0 2px 3px;">P&amp;LB = Prayer &amp; Lunch Break</div>
      <div style="display:flex;gap:6px;">
        <table style="border-collapse:collapse;flex:1;">
          <tr><th colspan="2" style="border:${BORDER};font-size:7.5px;font-weight:700;padding:2px;color:#000;">Teachers of ETE</th></tr>
          ${teacherRows}
        </table>
        <table style="border-collapse:collapse;flex:1;">
          <tr>
            <th style="border:${BORDER};font-size:7px;font-weight:700;padding:2px;color:#000;">Period</th>
            <th style="border:${BORDER};font-size:7px;font-weight:700;padding:2px;color:#000;">Time Schedule</th>
          </tr>
          ${timeRows}
        </table>
      </div>
    </div>`;
  }

  function formatSeriesList(nums) {
    if (nums.length === 0) return '';
    if (nums.length === 1) return `${nums[0]}`;
    return `${nums.slice(0, -1).join(', ')} & ${nums[nums.length - 1]}`;
  }

  function formatDate(d) {
    const day   = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year  = d.getFullYear();
    return `${day} ${month}, ${year}`;
  }

  const today      = formatDate(new Date());
  const seriesLine = formatSeriesList(sortedSeries.map(c => c.series));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ETE Department — Master Class Routine</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: legal landscape; margin: 7mm 6mm; }
  html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #000; }
  table { color: #000; }
</style>
</head>
<body>

<!-- ── Page Header ── -->
<div style="text-align:center;margin-bottom:6px;line-height:1.5;">
  <div style="font-size:8px;font-style:italic;color:#000;">Heaven's Light is Our Guide</div>
  <div style="font-size:9px;font-weight:700;color:#000;">Rajshahi University of Engineering &amp; Technology</div>
  <div style="font-size:10px;font-weight:800;color:#000;">Department of Electronics &amp; Telecommunication Engineering</div>
  <div style="font-size:10px;font-weight:700;color:#000;">Class Routine for ${seriesLine} Series</div>
  <div style="font-size:8px;color:#000;">Effective from ${today}</div>
</div>

<!-- ── TOP: Saturday | Sunday | Monday ── -->
<div style="margin-bottom:6px;">
  ${buildDayBlockTable(TOP_DAYS)}
</div>

<!-- ── BOTTOM: Tuesday | Wednesday  +  right panel ── -->
<div style="display:flex;align-items:flex-start;gap:0;">
  ${buildDayBlockTable(BOTTOM_DAYS)}
  ${buildRightPanel()}
</div>

<!-- ── Footer ── -->
<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;">
  <div style="font-size:12px;color:#000;line-height:1.6;">
    <strong>Note: Please follow this routine strictly</strong><br/>
    "There will be no further change"
  </div>
  <div style="text-align:right;font-size:12px;color:#000;line-height:1.8;">
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
  const [teachersDb,    setTeachersDb]    = useState([]);
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

  // Load the live teacher directory once, used for the "Teachers of ETE" panel on the PDF
  useEffect(() => {
    fetchTeachers()
      .then(res => { if (res.success) setTeachersDb(res.data); })
      .catch(() => {});
  }, []);

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

      // ── 2. Build the routine HTML (with live teacher data) and inject it into a hidden off-screen div ──
      const html = generatePrintHtml(activeConfigs, data, teachersDb);
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
        official Legal-landscape routine matching the office format, with all 5 days as separate grids.
      </div>

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}