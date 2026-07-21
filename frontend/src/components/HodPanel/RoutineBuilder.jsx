import { useState, useEffect, useMemo } from 'react';
import { fetchRoutine, fetchMasterRoutine, createSlot, updateSlot, deleteSlot } from '../../services/api';
import { toast } from '../Toast';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../../data/constants';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%'
};

function buildGrid(slots) {
  const grid = {};
  DAYS.forEach(d => { grid[d] = {}; NUM_PERIODS.forEach(p => { grid[d][p] = null; }); });
  const consumed = {};
  slots.forEach(slot => {
    const key = `${slot.day}-${slot.startPeriod}`;
    if (!consumed[key]) {
      const spanArr = Array.from({ length: slot.periodSpan || 1 }, (_, i) => slot.startPeriod + i);
      if (grid[slot.day]) grid[slot.day][slot.startPeriod] = { ...slot, periodSpan: spanArr };
      spanArr.slice(1).forEach(p => { consumed[`${slot.day}-${p}`] = slot._id; if (grid[slot.day]) grid[slot.day][p] = 'CONSUMED'; });
    }
  });
  return grid;
}

export default function RoutineBuilder({ configs }) {
  const [series, setSeries] = useState('');
  const [slots, setSlots] = useState([]);
  const [allMasterSlots, setAllMasterSlots] = useState([]);
  const [editorModal, setEditorModal] = useState(null); 

  const activeConfigs = configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series);
  const selectedCfg = activeConfigs.find(c => c.series === Number(series));

  async function load() {
    if (!series) { setSlots([]); return; }
    try {
      const [res, masterRes] = await Promise.all([fetchRoutine(series), fetchMasterRoutine('all')]);
      if (res.success) setSlots(res.data);
      if (masterRes.success) setAllMasterSlots(Object.values(masterRes.data).flatMap(d => d.slots || []));
    } catch(err) { toast('Failed to load', '#ff7a6a'); }
  }

  useEffect(() => { load(); }, [series]);

  const grid = useMemo(() => buildGrid(slots), [slots]);

  function checkCollisions(formData) {
    const requestedPeriods = Array.from({ length: Number(formData.periodSpan) }, (_, i) => Number(formData.startPeriod) + i);
    const requestedTeachers = formData.teachers;
    const editId = editorModal?.data?._id;

    for (const slot of allMasterSlots) {
      if (editId && slot._id === editId) continue;
      if (slot.day !== formData.day) continue;

      const slotSpan = slot.periodSpan?.length || slot.periodSpan || 1;
      const existingPeriods = Array.from({ length: slotSpan }, (_, i) => slot.startPeriod + i);
      
      if (requestedPeriods.some(p => existingPeriods.includes(p))) {
        const existingRoom = typeof slot.room === 'object' ? slot.room.roomLabel : slot.room;
        if (formData.room && existingRoom && formData.room.toLowerCase() === existingRoom.toLowerCase()) {
           return `Room Conflict: ${formData.room} is in use for ${slot.courseCode} (Series ${slot.series})`;
        }
        const slotTeachers = slot.teachers || slot.teacherInitials || [];
        const teacherOverlap = requestedTeachers.find(t => slotTeachers.includes(t));
        if (teacherOverlap) {
           return `Teacher Conflict: ${teacherOverlap} is busy with ${slot.courseCode} (Series ${slot.series})`;
        }
      }
    }
    return null;
  }

  async function saveSlot(formData) {
    const conflictError = checkCollisions(formData);
    if (conflictError) { toast(conflictError, '#ff7a6a'); return; }

    try {
      if (editorModal.isNew) {
        await createSlot({ ...formData, series: Number(series), semester: selectedCfg.currentSemester });
        toast('Slot created', '#30d890');
      } else {
        await updateSlot(editorModal.data._id, formData);
        toast('Slot updated', '#a8c2ff');
      }
      setEditorModal(null); load();
    } catch(err) { toast('Save failed', '#ff7a6a'); }
  }

  async function trashSlot(id) {
    if(!window.confirm('Delete this class?')) return;
    try {
      await deleteSlot(id); toast('Slot deleted', '#ff7a6a'); setEditorModal(null); load();
    } catch(err) { toast('Delete failed', '#ff7a6a'); }
  }

  return (
    <div className="glass" style={{ borderRadius: 14, padding: 20 }}>
      <select value={series} onChange={e=>setSeries(e.target.value)} style={{...inputSt, width: 200, marginBottom: 20}}>
        <option value="">-- Select Series to Edit --</option>
        {activeConfigs.map(c => <option key={c.series} value={c.series}>{c.label}</option>)}
      </select>
      {series && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign:'left' }}>DAY</th>
                {TIME_PERIODS.map(tp => (
                   <th key={tp.period} style={{ padding: '8px', fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign:'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                     {tp.isBreak ? tp.label : `P${tp.period}`}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const consumed = {};
                return (
                  <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px', fontSize: 10, fontWeight: 700, color: '#a8c2ff' }}>{day.substring(0,3)}</td>
                    {TIME_PERIODS.map(tp => {
                      if (tp.isBreak) return <td key={tp.period} style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.05)' }} />;
                      if (consumed[tp.period] || grid[day]?.[tp.period] === 'CONSUMED') return null;
                      const slot = grid[day]?.[tp.period];
                      const colSpan = slot ? slot.periodSpan.length : 1;
                      if (slot) slot.periodSpan.slice(1).forEach(p => consumed[p] = true);
                      return (
                        <td key={tp.period} colSpan={colSpan} style={{ padding: 4, borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                          {slot ? (
                            <button onClick={()=>setEditorModal({ isNew: false, data: slot })} style={{ width: '100%', height: 44, borderRadius: 6, border: `1px solid ${COLORS[slot.type]?.border || '#555'}`, background: COLORS[slot.type]?.bg || 'rgba(255,255,255,0.1)', color: COLORS[slot.type]?.text || '#fff', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 6px', cursor: 'pointer', textAlign: 'left' }}>
                              <div className="mono" style={{ fontSize: 9, fontWeight: 700 }}>{slot.courseCode}</div>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{slot.type}</div>
                            </button>
                          ) : (
                            <button onClick={()=>setEditorModal({ isNew: true, data: { day, startPeriod: tp.period }})} style={{ width: '100%', height: 44, borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18 }}>+</button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editorModal && <SlotEditorModal modal={editorModal} onClose={()=>setEditorModal(null)} onSave={saveSlot} onDelete={trashSlot} />}
    </div>
  );
}

function SlotEditorModal({ modal, onClose, onSave, onDelete }) {
  const isNew = modal.isNew;
  const init = modal.data;
  
  const rawTeachers = Array.isArray(init.teachers) ? init.teachers.join(', ') : (init.teacherInitials?.join(', ') || '');
  const rawRoom = typeof init.room === 'object' ? init.room.roomLabel : (init.room || '');
  const rawSpan = Array.isArray(init.periodSpan) ? init.periodSpan.length : (init.periodSpan || 1);

  const [form, setForm] = useState({
    courseCode: init.courseCode || '', courseName: init.courseName || init.courseTitle || '',
    type: init.type || 'theory', day: init.day, startPeriod: init.startPeriod,
    periodSpan: rawSpan, room: rawRoom, teachers: rawTeachers, batchScope: init.batchScope || 'all'
  });

  useEffect(() => {
    if (['lab', 'project', 'seminar'].includes(form.type)) {
      setForm(prev => ({ ...prev, periodSpan: 3 }));
    }
  }, [form.type]);

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, startPeriod: Number(form.startPeriod), periodSpan: Number(form.periodSpan), teachers: form.teachers.split(',').map(s=>s.trim()).filter(Boolean) };
    onSave(payload);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width: 400, background: '#0a0d14', border: '1px solid rgba(99,140,255,0.3)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: '#fff' }}>{isNew ? 'Add New Class' : 'Edit Class'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input required placeholder="Code (e.g. ETE 2115)" value={form.courseCode} onChange={e=>setForm({...form, courseCode: e.target.value})} style={inputSt}/>
            <select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} style={inputSt}>
              {Object.keys(COLORS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          
          <input placeholder="Course Title (Optional)" value={form.courseName} onChange={e=>setForm({...form, courseName: e.target.value})} style={inputSt}/>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <select value={form.day} onChange={e=>setForm({...form, day: e.target.value})} style={inputSt}>
              {DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}
            </select>
            <select value={form.startPeriod} onChange={e=>setForm({...form, startPeriod: e.target.value})} style={inputSt}>
              {NUM_PERIODS.map(p => <option key={p} value={p}>P{p}</option>)}
            </select>
            <input 
              type="number" min="1" max="5" placeholder="Span" 
              value={form.periodSpan} 
              onChange={e=>setForm({...form, periodSpan: e.target.value})} 
              disabled={['lab', 'project', 'seminar'].includes(form.type)}
              style={{...inputSt, opacity: ['lab', 'project', 'seminar'].includes(form.type) ? 0.6 : 1}}
            />
          </div>

          <input placeholder="Room (e.g. R 301 or DSP Lab)" value={form.room} onChange={e=>setForm({...form, room: e.target.value})} style={inputSt}/>
          <input placeholder="Teachers (comma separated, e.g. MKH, ST)" value={form.teachers} onChange={e=>setForm({...form, teachers: e.target.value})} style={inputSt}/>
          
          <select value={form.batchScope} onChange={e=>setForm({...form, batchScope: e.target.value})} style={inputSt}>
            <option value="all">All Sections</option>
            <option value="1st30">1st 30</option>
            <option value="2nd30">2nd 30</option>
          </select>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" style={{ flex: 1, padding: 10, background: 'rgba(99,140,255,0.2)', border: '1px solid rgba(99,140,255,0.5)', color: '#a8c2ff', borderRadius: 8, fontWeight: 700 }}>Save</button>
            {!isNew && <button type="button" onClick={()=>onDelete(init._id)} style={{ padding: '10px 16px', background: 'rgba(255,90,69,0.1)', border: '1px solid rgba(255,90,69,0.4)', color: '#ff7a6a', borderRadius: 8 }}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  )
}