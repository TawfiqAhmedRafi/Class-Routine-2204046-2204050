import { useState, useEffect, useMemo } from 'react';
import { fetchRoutine, fetchMasterRoutine, createSlot, updateSlot, deleteSlot } from '../../services/api';
import { toast } from '../Toast';
import GlassSelect from '../GlassSelect';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../../data/constants';
import Swal from 'sweetalert2';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 13, outline: 'none', width: '100%',
  fontFamily: 'Space Grotesk, sans-serif'
};

// ── Standardized Rooms ────────────────────────────────────────────────────────
const ROOMS = [
  "301", "302", "303", "304", 
  "Seminar Room", "DSP Lab", "Electronics Lab", 
  "Communication Lab", "Antenna Lab"
];

function normalizeRoom(r) {
  if (!r) return "";
  const str = typeof r === 'object' ? r.roomLabel : r;
  const lower = str.toLowerCase();
  
  if (lower.includes("301")) return "301";
  if (lower.includes("302")) return "302";
  if (lower.includes("303")) return "303";
  if (lower.includes("304")) return "304";
  if (lower.includes("seminar")) return "Seminar Room";
  if (lower.includes("dsp")) return "DSP Lab";
  if (lower.includes("electronic")) return "Electronics Lab";
  if (lower.includes("communication")) return "Communication Lab";
  if (lower.includes("antenna")) return "Antenna Lab";
  
  return str;
}

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

  function checkTeacherCollisions(formData) {
    const requestedPeriods = Array.from({ length: Number(formData.periodSpan) }, (_, i) => Number(formData.startPeriod) + i);
    const requestedTeachers = formData.teachers.split(',').map(s=>s.trim()).filter(Boolean);
    const editId = editorModal?.data?._id;

    for (const slot of allMasterSlots) {
      if (editId && slot._id === editId) continue;
      if (slot.day !== formData.day) continue;

      const slotSpan = slot.periodSpan?.length || slot.periodSpan || 1;
      const existingPeriods = Array.from({ length: slotSpan }, (_, i) => slot.startPeriod + i);
      
      if (requestedPeriods.some(p => existingPeriods.includes(p))) {
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
    const conflictError = checkTeacherCollisions(formData);
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
  const result = await Swal.fire({
    title: 'Delete this class?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel',
    background: '#0a0d14',
    color: '#d0dcf0',
    confirmButtonColor: '#ff5a45',
    cancelButtonColor: '#30384d',
    customClass: {
      popup: 'glass-swal'
    }
  });

  if (!result.isConfirmed) return;

  try {
    await deleteSlot(id);

    await Swal.fire({
      title: 'Deleted!',
      text: 'The class has been deleted.',
      icon: 'success',
      background: '#0a0d14',
      color: '#d0dcf0',
      confirmButtonColor: '#638cff'
    });

    setEditorModal(null);
    load();

  } catch (err) {
    Swal.fire({
      title: 'Delete failed',
      text: 'Something went wrong while deleting the class.',
      icon: 'error',
      background: '#0a0d14',
      color: '#d0dcf0',
      confirmButtonColor: '#ff5a45'
    });
  }
}

  return (
    <div className="glass" style={{ borderRadius: 14, padding: 20 }}>
      
      <div style={{ marginBottom: 20, width: 220 }}>
        <GlassSelect 
          placeholder="-- Select Series to Edit --"
          value={series} 
          onChange={val => setSeries(val)} 
          options={activeConfigs.map(c => ({ value: c.series, label: c.label }))}
        />
      </div>
      
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
      {editorModal && (
        <SlotEditorModal 
          modal={editorModal} 
          allMasterSlots={allMasterSlots} 
          onClose={()=>setEditorModal(null)} 
          onSave={saveSlot} 
          onDelete={trashSlot} 
        />
      )}
    </div>
  );
}

function SlotEditorModal({ modal, allMasterSlots, onClose, onSave, onDelete }) {
  const isNew = modal.isNew;
  const init = modal.data;
  
  const rawTeachers = Array.isArray(init.teachers) ? init.teachers.join(', ') : (init.teacherInitials?.join(', ') || '');
  const rawRoom = normalizeRoom(init.room);
  
  // Calculate initial span based on the type provided
  const initType = init.type || 'theory';
  const calculatedSpan = ['lab', 'project', 'seminar'].includes(initType) ? 3 : 1;

  const [form, setForm] = useState({
    courseCode: init.courseCode || '', courseName: init.courseName || init.courseTitle || '',
    type: initType, day: init.day, startPeriod: init.startPeriod,
    periodSpan: calculatedSpan, room: rawRoom, teachers: rawTeachers, batchScope: init.batchScope || 'all'
  });

  // Automatically enforce the duration constraint when the type changes
  useEffect(() => {
    if (['lab', 'project', 'seminar'].includes(form.type)) {
      setForm(prev => ({ ...prev, periodSpan: 3 }));
    } else {
      setForm(prev => ({ ...prev, periodSpan: 1 }));
    }
  }, [form.type]);

  const busyRooms = useMemo(() => {
    const occupied = new Set();
    const requestedPeriods = Array.from({ length: Number(form.periodSpan) }, (_, i) => Number(form.startPeriod) + i);

    allMasterSlots.forEach(slot => {
      if (!isNew && slot._id === init._id) return;
      if (slot.day !== form.day) return;

      const slotSpan = slot.periodSpan?.length || slot.periodSpan || 1;
      const existingPeriods = Array.from({ length: slotSpan }, (_, i) => slot.startPeriod + i);
      
      const hasTimeOverlap = requestedPeriods.some(p => existingPeriods.includes(p));
      if (hasTimeOverlap) {
        const standardRoom = normalizeRoom(slot.room);
        if (standardRoom) occupied.add(standardRoom);
      }
    });
    return occupied;
  }, [form.day, form.startPeriod, form.periodSpan, allMasterSlots, init._id, isNew]);

  useEffect(() => {
    if (form.room && busyRooms.has(form.room)) {
      setForm(prev => ({ ...prev, room: '' }));
      toast(`Room cleared: ${form.room} is occupied during this time`, '#f0c060');
    }
  }, [busyRooms, form.room]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.room) {
      toast('Please select an available room', '#ff7a6a');
      return;
    }
    const payload = { 
      ...form, 
      startPeriod: Number(form.startPeriod), 
      periodSpan: Number(form.periodSpan), 
      teachers: form.teachers 
    };
    onSave(payload);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position: 'relative', width: 420, background: '#0a0d14', border: '1px solid rgba(99,140,255,0.3)', borderRadius: 12, padding: 24 }}>
        
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}
        >
          &times;
        </button>

        <h3 style={{ margin: '0 0 16px', color: '#fff' }}>{isNew ? 'Add New Class' : 'Edit Class'}</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input required placeholder="Code (e.g. ETE 2115)" value={form.courseCode} onChange={e=>setForm({...form, courseCode: e.target.value})} style={inputSt}/>
            
            <GlassSelect 
              value={form.type} 
              onChange={val => setForm({...form, type: val})}
              options={Object.keys(COLORS)}
            />
          </div>
          
          <input placeholder="Course Title (Optional)" value={form.courseName} onChange={e=>setForm({...form, courseName: e.target.value})} style={inputSt}/>
          
          {/* Time Selection - Span is now hidden and auto-calculated */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <GlassSelect 
              value={form.day} 
              onChange={val => setForm({...form, day: val})}
              options={DAYS.map(d => ({ value: d, label: d.substring(0,3) }))}
            />
            
            <GlassSelect 
              value={form.startPeriod} 
              onChange={val => setForm({...form, startPeriod: Number(val)})}
              options={NUM_PERIODS.map(p => ({ value: p, label: `P${p}` }))}
            />
          </div>

          <GlassSelect
            placeholder="-- Select Available Room --"
            value={form.room}
            onChange={val => setForm({...form, room: val})}
            error={!form.room}
            options={ROOMS.map(r => ({
              value: r,
              label: busyRooms.has(r) ? `${r} (Occupied)` : r,
              disabled: busyRooms.has(r)
            }))}
          />

          <input placeholder="Teachers (comma separated, e.g. MKH, ST)" value={form.teachers} onChange={e=>setForm({...form, teachers: e.target.value})} style={inputSt}/>
          
          <GlassSelect 
            value={form.batchScope} 
            onChange={val => setForm({...form, batchScope: val})}
            options={[
              { value: 'all', label: 'All Sections' },
              { value: '1st30', label: '1st 30' },
              { value: '2nd30', label: '2nd 30' }
            ]}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" style={{ flex: 1, padding: 10, background: 'rgba(99,140,255,0.2)', border: '1px solid rgba(99,140,255,0.5)', color: '#a8c2ff', borderRadius: 8, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s ease' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(99,140,255,0.3)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(99,140,255,0.2)'}>Save</button>
            {!isNew && <button type="button" onClick={()=>onDelete(init._id)} style={{ padding: '10px 16px', background: 'rgba(255,90,69,0.1)', border: '1px solid rgba(255,90,69,0.4)', color: '#ff7a6a', borderRadius: 8, cursor: 'pointer', transition: 'background 0.2s ease' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,90,69,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,90,69,0.1)'}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  )
}