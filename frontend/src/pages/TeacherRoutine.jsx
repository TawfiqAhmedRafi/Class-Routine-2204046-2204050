import { useState, useEffect, useMemo } from 'react';
import { fetchMasterRoutine, fetchTeachers } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import SlotCard from '../components/SlotCard';
import SlotModal from '../components/SlotModal';
import GlassSelect from '../components/GlassSelect';
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
          background: 'var(--surface)',
          animation: 'shimmer 1.5s ease infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );
}

// ... generateTeacherPrintHtml function remains completely unchanged here for print styling ...
function generateTeacherPrintHtml(teacher, slots) {
  const grid = buildGrid(slots);

  const timeMap = {};
  TIME_PERIODS.filter(t => !t.isBreak).forEach(t => { timeMap[t.period] = t; });

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

  const ROW_H     = 44;
  const PANEL_GAP = 16;
  const BORDER    = '0.75px solid #000';

  const fmt = v => (v === null || v === undefined) ? '' : String(v).trim();

  function printRoomLine(slot) {
    const room = fmt(slot.room?.roomLabel || slot.room || '');
    if (room) return room;
    return fmt(slot.courseTitle) || fmt(slot.courseCode);
  }

  function slotTd(slot, colspan) {
    if (!slot) return `<td colspan="${colspan}" style="border:${BORDER};height:${ROW_H}px;"></td>`;
    const line1  = printRoomLine(slot);
    const code   = fmt(slot.courseCode);
    const series = slot.series ? `${slot.series} Series` : '';
    return `<td colspan="${colspan}" style="border:${BORDER};padding:2px 3px;text-align:center;vertical-align:middle;height:${ROW_H}px;overflow:hidden;">
      <div style="font-size:8px;line-height:1.3;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${line1}</div>
      <div style="font-size:8px;line-height:1.3;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${code}</div>
      <div style="font-size:8px;line-height:1.3;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${series}</div>
    </td>`;
  }

  function formatDate(d) {
    const day   = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year  = d.getFullYear();
    return `${day} ${month}, ${year}`;
  }
  const today = formatDate(new Date());

  const dayRows = DAYS.map(day => {
    const dayGrid = grid[day] || {};
    const consumedCells = {};
    const cells = NUM_PERIODS.map(p => {
      if (consumedCells[p]) return null;
      const val = dayGrid[p];
      if (val === 'CONSUMED') return null;
      const slot = val || null;
      const span = slot ? (slot.periodSpan?.length || 1) : 1;
      if (slot) (slot.periodSpan || []).slice(1).forEach(pp => { consumedCells[pp] = true; });
      return slotTd(slot, span);
    }).filter(Boolean).join('');

    return `<tr>
      <td style="border:${BORDER};color:#000;font-size:8.5px;font-weight:700;padding:4px 8px;white-space:nowrap;text-align:center;">${day.toUpperCase()}</td>
      ${cells}
    </tr>`;
  }).join('');

  const periodHdr = NUM_PERIODS.map(p => {
    const t = timeMap[p];
    return `<th style="border:${BORDER};text-align:center;padding:3px 2px;white-space:nowrap;min-width:80px;">
      <span style="display:block;font-size:8.5px;font-weight:700;color:#000;">P${p}</span>
      <span style="display:block;font-size:6.5px;color:#000;">${t.start}–${t.end}</span>
    </th>`;
  }).join('');

  const timeRows = TIME_SCHED.map(r => `<tr>
    <td style="border:${BORDER};font-size:8px;padding:4px 6px;white-space:nowrap;color:#000;">${r.period}</td>
    <td style="border:${BORDER};font-size:8px;padding:4px 6px;white-space:nowrap;color:#000;">${r.time}</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ETE — Individual Routine — ${teacher.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: legal landscape; margin: 7mm 6mm; }
  html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #000; }
  table { color: #000; }
</style>
</head>
<body>

<div style="text-align:center;margin-bottom:6px;line-height:1.5;">
  <div style="font-size:8px;font-style:italic;color:#000;">Heaven's Light is Our Guide</div>
  <div style="font-size:9px;font-weight:700;color:#000;">Rajshahi University of Engineering &amp; Technology</div>
  <div style="font-size:10px;font-weight:800;color:#000;">Department of Electronics &amp; Telecommunication Engineering</div>
  <div style="font-size:10px;font-weight:700;color:#000;">Individual Class Routine — ${teacher.name} (${teacher.initials})</div>
  <div style="font-size:8px;color:#000;">Effective from ${today}</div>
</div>

<div style="display:flex;gap:${PANEL_GAP}px;align-items:flex-start;">
  <div style="flex:1;min-width:0;">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>
        <col style="width:74px;"/>
        ${NUM_PERIODS.map(() => `<col/>`).join('')}
      </colgroup>
      <thead>
        <tr>
          <th style="border:${BORDER};font-size:8.5px;font-weight:700;padding:4px 6px;text-align:center;color:#000;">DAY</th>
          ${periodHdr}
        </tr>
      </thead>
      <tbody>${dayRows}</tbody>
    </table>
  </div>

  <div style="width:150px;flex-shrink:0;display:flex;flex-direction:column;">
    <div style="text-align:right;font-size:7.5px;color:#000;padding:0 2px 5px;">P&amp;LB = Prayer &amp; Lunch Break</div>
    <table style="border-collapse:collapse;width:100%;">
      <tr>
        <th style="border:${BORDER};font-size:8px;font-weight:700;padding:4px;color:#000;">Period</th>
        <th style="border:${BORDER};font-size:8px;font-weight:700;padding:4px;color:#000;">Time Schedule</th>
      </tr>
      ${timeRows}
    </table>
  </div>
</div>

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

export default function TeacherRoutine({ user }) {
  const [selectedInitials, setSelectedInitials] = useState(["teacher", "hod"].includes(user?.role) ? user.initials : "");
  const [allSlots, setAllSlots] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMasterRoutine('all'), fetchTeachers()])
      .then(([masterRes, teachersRes]) => {
        if (masterRes.success) {
          const flattened = Object.values(masterRes.data).flatMap(d => d.slots || []);
          setAllSlots(flattened);
        }
        if (teachersRes.success) {
          setTeachersList(teachersRes.data);
          if (!selectedInitials && teachersRes.data.length > 0) {
            setSelectedInitials(teachersRes.data[0].credentials.initials);
          }
        }
      })
      .catch(() => toast('Failed to load data', 'var(--red)'))
      .finally(() => setLoading(false));
  }, []); 

  const teacherSlots = useMemo(() => {
    if (!selectedInitials) return [];
    return allSlots.filter(s => {
      const t = s.teachers || s.teacherInitials || [];
      return t.includes(selectedInitials);
    });
  }, [allSlots, selectedInitials]);

  const activeTeacherData = teachersList.find(t => t.credentials?.initials === selectedInitials);
  const activeTeacher = {
    name: activeTeacherData?.name || selectedInitials,
    initials: selectedInitials,
  };

  const grid = useMemo(() => buildGrid(teacherSlots), [teacherSlots]);

  async function handlePrint() {
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

      const html = generateTeacherPrintHtml(activeTeacher, teacherSlots);
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

      pdf.save(`ETE_${selectedInitials}_Routine_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('PDF downloaded!', 'var(--green)', 'var(--green-bdr)');
    } catch (e) {
      console.error(e);
      toast('Failed to generate PDF — ' + e.message, 'var(--red)', 'var(--red-bdr)');
    } finally {
      setPrinting(false);
    }
  }

 function renderRow(day) {
    const consumed = {};
    return TIME_PERIODS.map(tp => {
      if (tp.isBreak) {
        return (
          <td key={tp.period} style={{
            background: 'var(--gold-bg)',
            borderLeft: '1px solid var(--surface-border)',
            textAlign: 'center', padding: '4px 2px',
          }}>
            <span style={{
              fontSize: 8, color: 'var(--gold)',
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
          padding: 5, 
          borderLeft: '1px solid var(--surface-border)',
          height: '1px' 
        }}>
          {slot
            ? <SlotCard slot={slot} onClick={setModal} />
            : <div style={{
                height: '100%',
                minHeight: 70, 
                borderRadius: 8,
                background: 'var(--surface)',
                border: '1px dashed var(--surface-border)',
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
      color: tp.isBreak ? 'var(--gold)' : 'var(--text-muted)',
      fontWeight: 600,
      borderBottom: '1px solid var(--surface-border)',
      background: tp.isBreak ? 'var(--gold-bg)' : 'var(--surface)',
      minWidth: tp.isBreak ? 44 : 98,
      borderLeft: '1px solid var(--surface-border)',
    }}>
      {tp.isBreak
        ? <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tp.label}</span>
        : <>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginBottom: 1 }}>P{tp.period}</div>
            <div style={{ fontSize: 9, opacity: 0.6 }}>{tp.start}</div>
            <div style={{ fontSize: 9, opacity: 0.4 }}>{tp.end}</div>
          </>
      }
    </th>
  ));

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.2em',
          color: 'var(--blue-muted)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          Rajshahi University of Engineering &amp; Technology
        </div>
        <h1 className="grad-text" style={{
          fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          Individual Routine
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          {activeTeacher.name} ({teacherSlots.length} Total Classes)
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Teacher</span>
          <div style={{ width: 260 }}>
            <GlassSelect
              value={selectedInitials}
              onChange={val => setSelectedInitials(val)}
              options={teachersList.map(t => ({
                value: t.credentials.initials,
                label: `${t.name} (${t.credentials.initials})`
              }))}
              placeholder="Select a teacher..."
            />
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={printing || loading}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px', borderRadius: 9, cursor: printing || loading ? 'not-allowed' : 'pointer',
            border: '1px solid var(--blue-bdr)',
            background: printing || loading ? 'var(--surface)' : 'var(--blue-bg)',
            color: printing || loading ? 'var(--text-muted)' : 'var(--blue)',
            fontSize: 12, fontWeight: 600,
            boxShadow: printing || loading ? 'none' : '0 0 14px var(--surface-border)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <text x="3.5" y="10.5" fontFamily="Arial" fontSize="5.5" fontWeight="bold" fill="currentColor">PDF</text>
          </svg>
          {printing ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([type, c]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c.badge, opacity: 0.85 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {loading ? <Skeleton /> : (
        <div style={{
          overflowX: 'auto', borderRadius: 14,
          border: '1px solid var(--surface-border)',
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          minHeight: 400
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: 10, letterSpacing: '0.12em',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  fontWeight: 600, borderBottom: '1px solid var(--surface-border)',
                  background: 'var(--surface)', width: 72,
                }}>Day</th>
                {thCells}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{
                    padding: '10px 16px', fontSize: 12, fontWeight: 700,
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    borderRight: '1px solid var(--surface-border)',
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

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}