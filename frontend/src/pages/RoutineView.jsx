import { useState, useMemo, useEffect } from 'react';
import SlotCard  from '../components/SlotCard';
import SlotModal from '../components/SlotModal';
import { fetchRoutine, fetchSeries } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import { toast } from '../components/Toast';

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
      const span = slot.periodSpan;
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

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          height: 72, borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          animation: 'shimmer 1.5s ease infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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

// ── Series-wise PDF HTML generator ──────────────────────────────────────────
function generateSeriesPrintHtml(seriesLabel, semesterLabel, slots) {
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    NUM_PERIODS.forEach(p => { grid[d][p] = null; });
  });
  const consumed = {};
  slots.forEach(slot => {
    const key = `${slot.day}-${slot.startPeriod}`;
    if (!consumed[key]) {
      const span = slot.periodSpan;
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

  const timeMap = {};
  TIME_PERIODS.filter(t => !t.isBreak).forEach(t => { timeMap[t.period] = t; });

  const PC = {
    theory:     { bg: '#dce8ff', border: '#5a8aff' },
    lab:        { bg: '#d4f7ea', border: '#18c980' },
    assessment: { bg: '#ffe0dc', border: '#ff5a45' },
    seminar:    { bg: '#eedcff', border: '#b060f0' },
    project:    { bg: '#fff0cc', border: '#f0a020' },
  };

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

  const ROW_H = 40;

  function slotTd(slot, colspan) {
    if (!slot) return `<td colspan="${colspan}" style="border:0.5px solid #ccc;background:#fafafa;padding:1px;height:${ROW_H}px;"></td>`;
    const pc      = PC[slot.type] || PC.theory;
    const room    = formatRoom(slot.room?.roomLabel || slot.room || '');
    const teacher = (slot.teachers || slot.teacherInitials || []).join('/');
    const code    = slot.courseCode || '';
    const isSpecial = slot.type === 'lab' || slot.type === 'project';
    const title   = isSpecial ? (slot.courseTitle || code) : code;
    return `<td colspan="${colspan}" style="border:0.5px solid #ccc;border-left:2.5px solid ${pc.border};background:${pc.bg};padding:3px 4px;vertical-align:top;overflow:hidden;height:${ROW_H}px;">
      <div style="font-size:7.5px;font-weight:700;color:#111;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
      ${isSpecial ? `<div style="font-size:6px;color:#444;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${code}</div>` : ''}
      <div style="font-size:6.5px;color:#555;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teacher}${room ? ' · ' + room : ''}</div>
    </td>`;
  }

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const semDisplay = semesterLabel ? semesterLabel.charAt(0).toUpperCase() + semesterLabel.slice(1) : '';

  // Build rows for each day
  const dayRows = DAYS.map(day => {
    const dayGrid  = grid[day] || {};
    const consumedCells = {};
    const cells = NUM_PERIODS.map(p => {
      if (consumedCells[p]) return null;
      const val  = dayGrid[p];
      if (val === 'CONSUMED') return null;
      const slot = val || null;
      const span = slot ? (slot.periodSpan?.length || 1) : 1;
      if (slot) (slot.periodSpan || []).slice(1).forEach(pp => { consumedCells[pp] = true; });
      return slotTd(slot, span);
    }).filter(Boolean).join('');

    return `<tr>
      <td style="background:#1a2a6c;color:#fff;font-size:8px;font-weight:800;letter-spacing:.06em;padding:4px 8px;border:0.5px solid #0d1a52;white-space:nowrap;text-align:center;">${day.toUpperCase()}</td>
      ${cells}
    </tr>`;
  }).join('');

  // Period header
  const periodHdr = NUM_PERIODS.map(p => {
    const t = timeMap[p];
    return `<th style="background:#e2e9f8;text-align:center;border:0.5px solid #bbb;padding:3px 2px;white-space:nowrap;min-width:80px;">
      <span style="display:block;font-size:8px;font-weight:700;color:#1a2a6c;">P${p}</span>
      <span style="display:block;font-size:6.5px;color:#555;">${t.start}–${t.end}</span>
    </th>`;
  }).join('');

  const timeRows = TIME_SCHED.map(r => {
    const isBreak = r.isBreak;
    return `<tr style="${isBreak ? 'background:#fffbe6;' : ''}">
      <td style="font-size:7px;font-weight:${isBreak ? '700' : '600'};padding:2px 4px;border:0.5px solid #ccc;white-space:nowrap;color:${isBreak ? '#b87000' : '#111'};">${r.period}</td>
      <td style="font-size:7px;padding:2px 4px;border:0.5px solid #ccc;white-space:nowrap;color:${isBreak ? '#b87000' : '#333'};">${r.time}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ETE ${seriesLabel} Series — ${semDisplay} Semester Routine</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: legal landscape; margin: 7mm 6mm; }
  html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; }
</style>
</head>
<body>

<!-- Header -->
<div style="text-align:center;margin-bottom:8px;line-height:1.6;">
  <div style="font-size:8px;font-style:italic;color:#555;">Heaven's Light is Our Guide</div>
  <div style="font-size:9px;font-weight:700;color:#18191f;">Rajshahi University of Engineering &amp; Technology</div>
  <div style="font-size:11px;font-weight:800;color:#18191f;">Department of Electronics &amp; Telecommunication Engineering</div>
  <div style="font-size:11px;font-weight:700;color:#1a2a6c;">${semDisplay} Semester Class Routine — ${seriesLabel} Series</div>
  <div style="font-size:8px;color:#555;">Effective from: ${today}</div>
</div>

<!-- Main layout: table + right panel -->
<div style="display:flex;gap:10px;align-items:flex-start;">
  <!-- Routine table -->
  <div style="flex:1;min-width:0;">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>
        <col style="width:70px;"/>
        ${NUM_PERIODS.map(() => `<col/>`).join('')}
      </colgroup>
      <thead>
        <tr>
          <th style="background:#1a2a6c;color:#fff;font-size:8px;padding:4px 6px;border:0.5px solid #0d1a52;text-align:center;">DAY</th>
          ${periodHdr}
        </tr>
      </thead>
      <tbody>${dayRows}</tbody>
    </table>
  </div>

  <!-- Right panel: time schedule -->
  <div style="width:130px;flex-shrink:0;">
    <div style="background:#1a2a6c;color:#fff;font-size:8px;font-weight:700;padding:3px 5px;letter-spacing:.06em;">Period &amp; Time Schedule</div>
    <table style="border-collapse:collapse;width:100%;">${timeRows}</table>
    <div style="margin-top:8px;padding:5px;border:0.5px solid #ccc;background:#fffbe6;">
      <div style="font-size:6.5px;color:#888;line-height:1.6;">
        <strong style="color:#333;">Legend:</strong><br/>
        <span style="color:#5a8aff;">■</span> Theory &nbsp;
        <span style="color:#18c980;">■</span> Lab<br/>
        <span style="color:#ff5a45;">■</span> Assessment &nbsp;
        <span style="color:#b060f0;">■</span> Seminar<br/>
        <span style="color:#f0a020;">■</span> Project
      </div>
    </div>
  </div>
</div>

<!-- Footer -->
<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:flex-end;">
  <div style="font-size:7px;color:#555;line-height:1.7;">
    <strong>Note:</strong> P&amp;LB = Prayer &amp; Lunch Break (1:20–2:30) &nbsp;|&nbsp; Break (10:30–10:50)<br/>
    Multi-period labs span merged columns. Red cells = no class scheduled.<br/>
    <span style="color:#aaa;">Printed: ${today}</span>
  </div>
  <div style="text-align:right;font-size:7px;color:#333;line-height:1.7;">
    Head of the Dept: _______________<br/>
    <strong>Prof. Dr. Md. Kamal Hosain</strong>
  </div>
</div>

</body>
</html>`;
}

export default function RoutineView({ user }) {
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [slots, setSlots] = useState([]);
  const [modal, setModal] = useState(null);

  // 1. THE ENGINE: This single object controls all API fetches
  const [params, setParams] = useState({
    series: user.series || 22,
    batch: user.batch || 'all',
    sem: '' // Blank means "Backend, automatically give me the active semester!"
  });

  // 2. THE PAINT: This only controls which button is highlighted (never triggers a fetch)
  const [displaySem, setDisplaySem] = useState('');

  const [initialLoad, setInitialLoad] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const isStaff = ['teacher', 'hod'].includes(user.role);
  const [printing, setPrinting] = useState(false);

  async function handlePrintPDF() {
    setPrinting(true);
    try {
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

      const html = generateSeriesPrintHtml(params.series, displaySem, slots);
      const container = document.createElement('div');
      container.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:1344px',
        'background:#fff',
        'font-family:Arial,Helvetica,sans-serif',
        'padding:26px 23px',
        'z-index:-1',
      ].join(';');

      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');
      const style  = document.createElement('style');
      style.textContent = doc.querySelector('style')?.textContent || '';
      container.appendChild(style);
      Array.from(doc.body.children).forEach(el => {
        container.appendChild(document.importNode(el, true));
      });
      document.body.appendChild(container);

      await new Promise(r => setTimeout(r, 400));

      const LEGAL_PX_W = 1344;
      const LEGAL_PX_H = 816;
      const canvas = await window.html2canvas(container, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width:  LEGAL_PX_W,
        height: LEGAL_PX_H,
        windowWidth:  LEGAL_PX_W,
        windowHeight: LEGAL_PX_H,
      });
      document.body.removeChild(container);

      const { jsPDF } = window.jspdf;
      const PAGE_W = 355.6, PAGE_H = 215.9;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, PAGE_H, '', 'FAST');

      const semPart = displaySem ? `_${displaySem.charAt(0).toUpperCase() + displaySem.slice(1)}` : '';
      const fname = `ETE_${params.series}_Series${semPart}_Routine_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fname);
      toast('PDF downloaded!', '#7fffd4', 'rgba(20,180,120,0.3)');
    } catch (e) {
      console.error(e);
      toast('Failed to generate PDF — ' + e.message, '#ff7a6a', 'rgba(255,90,69,0.35)');
    } finally {
      setPrinting(false);
    }
  }

  // Fetch configs ONLY ONCE on mount
  useEffect(() => {
    fetchSeries().then(res => {
      if (res.success) setSeriesConfigs(res.data);
    }).catch(() => {});
  }, []);

  // Fetch routine whenever params change (and ONLY when params change)
  useEffect(() => {
    const loadingTimer = setTimeout(() => setIsFetching(true), 150);
    setError(null);

    fetchRoutine(params.series, params.batch, params.sem)
      .then(res => {
        if (res.success) {
          setSlots(res.data);
          setDisplaySem(res.semester); // Updates the UI buttons without causing a double-render!
        }
      })
      .catch(err => {
        setError(err?.response?.data?.message || 'Failed to load routine');
        toast('Failed to load routine', '#ff7a6a', 'rgba(255,90,69,0.35)');
      })
      .finally(() => {
        clearTimeout(loadingTimer);
        setIsFetching(false);
        setInitialLoad(false);
      });

    return () => clearTimeout(loadingTimer);
  }, [params.series, params.batch, params.sem]);

  // When switching series, we reset the semester to blank so the backend auto-detects the correct one
  function handleSeriesChange(s) {
    setParams(prev => ({ ...prev, series: s, sem: '' }));
  }

  const grid = useMemo(() => buildGrid(slots), [slots]);
  const activeSeries = seriesConfigs.filter(c => c.isActive).map(c => c.series).sort((a,b)=>b-a);

  function renderRow(day) {
    const consumed = {};
    return TIME_PERIODS.map(tp => {
      if (tp.isBreak) {
        return (
          <td key={tp.period} style={{
            background: 'rgba(255,200,80,0.025)',
            borderLeft: '1px solid rgba(255,255,255,0.04)',
            textAlign: 'center', padding: '4px 2px',
          }}>
            <span style={{
              fontSize: 8, color: 'rgba(255,200,80,0.3)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
              writingMode: 'vertical-rl',
            }}>{tp.label}</span>
          </td>
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
          padding: 5, verticalAlign: 'top',
          borderLeft: '1px solid rgba(255,255,255,0.04)',
        }}>
          {slot
            ? <SlotCard slot={slot} onClick={setModal} />
            : <div style={{
                height: 58, borderRadius: 8,
                background: 'rgba(255,255,255,0.012)',
                border: '1px dashed rgba(255,255,255,0.05)',
              }} />
          }
        </td>
      );
    });
  }

  const thCells = TIME_PERIODS.map(tp => (
    <th key={tp.period} style={{
      padding: tp.isBreak ? '8px 4px' : '14px 6px',
      textAlign: 'center',
      fontSize: tp.isBreak ? 8 : 10,
      color: tp.isBreak ? 'rgba(255,200,80,0.5)' : 'rgba(140,165,215,0.6)',
      fontWeight: 600,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: tp.isBreak ? 'rgba(255,200,80,0.03)' : 'rgba(255,255,255,0.02)',
      minWidth: tp.isBreak ? 44 : 98,
      borderLeft: '1px solid rgba(255,255,255,0.04)',
    }}>
      {tp.isBreak
        ? <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tp.label}</span>
        : <>
            <div className="mono" style={{ fontSize: 13, color: 'rgba(160,185,230,0.8)', marginBottom: 1 }}>P{tp.period}</div>
            <div style={{ fontSize: 9, color: 'rgba(110,135,190,0.5)' }}>{tp.start}</div>
            <div style={{ fontSize: 9, color: 'rgba(110,135,190,0.35)' }}>{tp.end}</div>
          </>
      }
    </th>
  ));

  const batchActive = (k) => params.batch === k;
  function batchStyle(k) {
    return {
      padding: '5px 12px', borderRadius: 6, border: 'none',
      background: batchActive(k) ? 'rgba(240,190,60,0.2)' : 'transparent',
      color: batchActive(k) ? '#f0c060' : 'rgba(150,170,210,0.5)',
      fontSize: 12, fontWeight: batchActive(k) ? 700 : 400,
      cursor: 'pointer', transition: 'all 0.15s'
    };
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.2em',
          color: 'rgba(99,140,255,0.65)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          Rajshahi University of Engineering &amp; Technology
        </div>
        <h1 className="grad-text" style={{
          fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          ETE Department · Class Routine
        </h1>
        <p style={{ color: 'rgba(140,165,215,0.5)', fontSize: 13, margin: '4px 0 0', display: 'flex', alignItems: 'center' }}>
          Series {params.series} · {displaySem ? displaySem.charAt(0).toUpperCase() + displaySem.slice(1) : ''} Semester
          <span style={{ 
            marginLeft: 12, color: 'rgba(99,140,255,0.8)', fontSize: 11,
            opacity: isFetching ? 1 : 0, transition: 'opacity 0.2s',
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
             <span style={{ animation: 'shimmer 1s infinite' }}>⟳ Syncing...</span>
          </span>
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Series</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {activeSeries.map(s => (
              <button key={s} onClick={() => handleSeriesChange(s)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                border: params.series === s ? '1px solid rgba(99,140,255,0.6)' : '1px solid rgba(255,255,255,0.08)',
                background: params.series === s ? 'rgba(60,100,220,0.2)' : 'rgba(255,255,255,0.03)',
                color: params.series === s ? '#a8c2ff' : 'rgba(150,170,210,0.5)',
                fontWeight: params.series === s ? 700 : 400,
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'all 0.15s'
              }}>'{String(s).slice(-2)}</button>
            ))}
          </div>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sem</span>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
              {['even','odd'].map(s => (
                <button key={s} onClick={() => setParams(prev => ({ ...prev, sem: s }))} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: displaySem === s ? 'rgba(60,100,220,0.3)' : 'transparent',
                  color: displaySem === s ? '#a8c2ff' : 'rgba(150,170,210,0.5)',
                  fontSize: 12, fontWeight: displaySem === s ? 700 : 400, textTransform: 'capitalize',
                  transition: 'all 0.15s'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* PDF Download Button */}
        <button
          onClick={handlePrintPDF}
          disabled={printing || isFetching || initialLoad}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px', borderRadius: 9, cursor: printing || isFetching || initialLoad ? 'not-allowed' : 'pointer',
            border: '1px solid rgba(99,140,255,0.35)',
            background: printing || isFetching || initialLoad
              ? 'rgba(99,140,255,0.06)'
              : 'linear-gradient(135deg, rgba(99,140,255,0.25) 0%, rgba(99,140,255,0.15) 100%)',
            color: printing || isFetching || initialLoad ? 'rgba(150,170,210,0.4)' : '#a8c2ff',
            fontSize: 12, fontWeight: 600,
            boxShadow: printing || isFetching || initialLoad ? 'none' : '0 0 14px rgba(99,140,255,0.15)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!printing && !isFetching && !initialLoad) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,140,255,0.38) 0%, rgba(99,140,255,0.25) 100%)'; }}
          onMouseLeave={e => { if (!printing && !isFetching && !initialLoad) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,140,255,0.25) 0%, rgba(99,140,255,0.15) 100%)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <text x="3.5" y="10.5" fontFamily="Arial" fontSize="5.5" fontWeight="bold" fill="currentColor">PDF</text>
          </svg>
          {printing ? 'Generating…' : `Download '${String(params.series).slice(-2)} PDF`}
        </button>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batch</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[{k:'all',l:'All'},{k:'1st30',l:'1st 30'},{k:'2nd30',l:'2nd 30'}].map(b => (
              <button key={b.k} onClick={() => setParams(prev => ({ ...prev, batch: b.k }))} style={batchStyle(b.k)}>{b.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([type, c]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c.badge, opacity: 0.85 }} />
            <span style={{ fontSize: 11, color: 'rgba(150,170,210,0.65)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', marginBottom: 16,
          background: 'rgba(220,60,40,0.08)', border: '1px solid rgba(255,90,69,0.25)',
          borderRadius: 10, color: '#ff8070', fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* Table Area */}
      {initialLoad ? <Skeleton /> : (
        <div style={{
          overflowX: 'auto', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.012)',
          backdropFilter: 'blur(20px)',
          opacity: isFetching ? 0.7 : 1,
          pointerEvents: isFetching ? 'none' : 'auto',
          transition: 'opacity 0.25s ease',
          minHeight: 400
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: 10, letterSpacing: '0.12em',
                  color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase',
                  fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)', width: 72,
                }}>Day</th>
                {thCells}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{
                    padding: '10px 16px', fontSize: 12, fontWeight: 700,
                    color: 'rgba(160,185,230,0.8)',
                    background: 'rgba(255,255,255,0.015)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.04em',
                  }}>
                    {day.slice(0,3).toUpperCase()}
                  </td>
                  {renderRow(day)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 18, padding: '12px 16px',
        background: 'rgba(255,200,80,0.05)', border: '1px solid rgba(255,200,80,0.14)',
        borderRadius: 10, fontSize: 11, color: 'rgba(220,185,80,0.65)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'rgba(240,200,100,0.85)' }}>Note:</strong>{' '}
        P&amp;LB = Prayer &amp; Lunch Break (1:20–2:30). Break (10:30–10:50).
        Multi-period labs span merged columns. Use the <strong style={{ color: '#f0c060' }}>Batch</strong> toggle to separate 1st 30 / 2nd 30 lab groups.
        Click any slot to view details.
      </div>

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}