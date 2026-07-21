import { useState, useEffect, useMemo } from 'react';
import { fetchMasterRoutine } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS, TEACHERS } from '../data/constants';
import SlotCard from '../components/SlotCard';
import { toast } from '../components/Toast';

// PDF Generator specific to Teachers
function generateTeacherPrintHtml(teacher, slots) {
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    NUM_PERIODS.forEach(p => { grid[d][p] = null; });
  });
  const consumed = {};
  
  slots.forEach(slot => {
    const key = `${slot.day}-${slot.startPeriod}`;
    if (!consumed[key]) {
      const spanArr = Array.isArray(slot.periodSpan) ? slot.periodSpan : Array.from({ length: slot.periodSpan || 1 }, (_, i) => slot.startPeriod + i);
      if (grid[slot.day]) grid[slot.day][slot.startPeriod] = { ...slot, periodSpan: spanArr };
      spanArr.slice(1).forEach(p => {
        consumed[`${slot.day}-${p}`] = slot._id;
        if (grid[slot.day]) grid[slot.day][p] = 'CONSUMED';
      });
    }
  });

  const PC = {
    theory: { bg: '#dce8ff', border: '#5a8aff' },
    lab: { bg: '#d4f7ea', border: '#18c980' },
    project: { bg: '#fff0cc', border: '#f0a020' },
  };

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

      if (!slot) return `<td colspan="${span}" style="border:0.5px solid #ccc;background:#fafafa;padding:1px;height:45px;"></td>`;
      
      const pc = PC[slot.type] || PC.theory;
      const room = typeof slot.room === 'object' ? slot.room.roomLabel : slot.room;
      const title = slot.type === 'lab' || slot.type === 'project' ? (slot.courseTitle || slot.courseCode) : slot.courseCode;
      
      return `<td colspan="${span}" style="border:0.5px solid #ccc;border-left:2.5px solid ${pc.border};background:${pc.bg};padding:3px 4px;vertical-align:top;height:45px;">
        <div style="font-size:7.5px;font-weight:700;color:#111;">${title}</div>
        <div style="font-size:6px;color:#555;margin-top:2px;">Series ${slot.series} ${room ? `· ${room}` : ''}</div>
      </td>`;
    }).filter(Boolean).join('');

    return `<tr>
      <td style="background:#1a2a6c;color:#fff;font-size:8px;font-weight:800;padding:4px 8px;border:0.5px solid #0d1a52;text-align:center;">${day.toUpperCase()}</td>
      ${cells}
    </tr>`;
  }).join('');

  const periodHdr = NUM_PERIODS.map(p => `
    <th style="background:#e2e9f8;text-align:center;border:0.5px solid #bbb;padding:4px 2px;min-width:75px;">
      <span style="display:block;font-size:8px;font-weight:700;color:#1a2a6c;">P${p}</span>
    </th>
  `).join('');

  return `<!DOCTYPE html>
    <html lang="en">
    <head><style>* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }</style></head>
    <body style="background:#fff; padding: 20px;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:800;color:#18191f;">Department of ETE, RUET</div>
        <div style="font-size:10px;font-weight:700;color:#1a2a6c;margin-top:4px;">Individual Routine: ${teacher.name} (${teacher.initials})</div>
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr>
          <th style="background:#1a2a6c;color:#fff;font-size:8px;padding:4px 6px;border:0.5px solid #0d1a52;text-align:center;width:80px;">DAY</th>
          ${periodHdr}
        </tr></thead>
        <tbody>${dayRows}</tbody>
      </table>
    </body>
    </html>`;
}

export default function TeacherRoutine({ user }) {
  const [selectedInitials, setSelectedInitials] = useState(user.role === 'teacher' ? user.initials : TEACHERS[0].initials);
  const [allSlots, setAllSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMasterRoutine('all').then(res => {
      if (res.success) {
        // Flatten the series-keyed data into a single array of slots
        const flattened = Object.values(res.data).flatMap(d => d.slots || []);
        setAllSlots(flattened);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Filter slots for the selected teacher
  const teacherSlots = useMemo(() => {
    return allSlots.filter(s => {
      const t = s.teachers || s.teacherInitials || [];
      return t.includes(selectedInitials);
    });
  }, [allSlots, selectedInitials]);

  const activeTeacher = TEACHERS.find(t => t.initials === selectedInitials) || { name: selectedInitials, initials: selectedInitials };

  // Build Grid for UI
  const grid = useMemo(() => {
    const g = {};
    DAYS.forEach(d => { g[d] = {}; NUM_PERIODS.forEach(p => { g[d][p] = null; }); });
    const consumed = {};
    teacherSlots.forEach(slot => {
      const key = `${slot.day}-${slot.startPeriod}`;
      if (!consumed[key]) {
        const spanArr = Array.isArray(slot.periodSpan) ? slot.periodSpan : Array.from({ length: slot.periodSpan || 1 }, (_, i) => slot.startPeriod + i);
        if (g[slot.day]) g[slot.day][slot.startPeriod] = { ...slot, periodSpan: spanArr };
        spanArr.slice(1).forEach(p => { consumed[`${slot.day}-${p}`] = slot._id; if (g[slot.day]) g[slot.day][p] = 'CONSUMED'; });
      }
    });
    return g;
  }, [teacherSlots]);

  async function handlePrint() {
    setPrinting(true);
    try {
      function loadScript(src) {
        return new Promise((res) => {
          if (document.querySelector(`script[src="${src}"]`)) return res();
          const s = document.createElement('script'); s.src = src; s.onload = res;
          document.head.appendChild(s);
        });
      }
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      const html = generateTeacherPrintHtml(activeTeacher, teacherSlots);
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1100px;background:#fff;z-index:-1;';
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      Array.from(doc.body.children).forEach(el => container.appendChild(document.importNode(el, true)));
      document.body.appendChild(container);
      await new Promise(r => setTimeout(r, 400));

      const canvas = await window.html2canvas(container, { scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210, '', 'FAST');
      pdf.save(`Routine_${selectedInitials}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('PDF downloaded!', '#30d890');
    } catch (e) {
      toast('Failed to generate PDF', '#ff7a6a');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="grad-text" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Individual Routine</h1>
          <p style={{ color: 'rgba(140,165,215,0.5)', fontSize: 13, margin: '4px 0 0' }}>
            {activeTeacher.name} ({teacherSlots.length} Total Classes)
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select 
            value={selectedInitials} 
            onChange={e => setSelectedInitials(e.target.value)}
            style={{ padding: '10px 14px', background: 'rgba(20,25,40,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d0dcf0', outline: 'none' }}
          >
            {TEACHERS.map(t => <option key={t.initials} value={t.initials}>{t.name} ({t.initials})</option>)}
          </select>
          
          <button onClick={handlePrint} disabled={printing || loading} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(99,140,255,0.4)',
            background: 'rgba(60,100,220,0.2)', color: '#a8c2ff', fontWeight: 700, cursor: 'pointer'
          }}>
            {printing ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="glass" style={{ overflowX: 'auto', borderRadius: 14, padding: 16 }}>
        {loading ? <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading schedule...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 10, color: '#8ca5d7', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Day</th>
                {NUM_PERIODS.map(p => (
                  <th key={p} style={{ padding: '12px', textAlign: 'center', fontSize: 10, color: '#8ca5d7', borderBottom: '1px solid rgba(255,255,255,0.1)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>P{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontSize: 12, fontWeight: 700, color: '#a8c2ff' }}>{day.substring(0,3)}</td>
                  {NUM_PERIODS.map(p => {
                    if (grid[day][p] === 'CONSUMED') return null;
                    const slot = grid[day][p];
                    const colSpan = slot ? slot.periodSpan.length : 1;
                    return (
                      <td key={p} colSpan={colSpan} style={{ padding: 4, borderLeft: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' }}>
                        {slot ? (
                          <div style={{ background: COLORS[slot.type]?.bg || 'rgba(255,255,255,0.1)', border: `1px solid ${COLORS[slot.type]?.border || '#55'}`, borderRadius: 8, padding: '8px', minHeight: 60 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS[slot.type]?.text || '#fff' }}>{slot.courseCode}</div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Series {slot.series}</div>
                          </div>
                        ) : <div style={{ height: 60, border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 8 }} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}