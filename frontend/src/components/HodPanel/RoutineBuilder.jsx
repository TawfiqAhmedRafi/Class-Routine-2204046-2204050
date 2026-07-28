import { useState, useEffect, useMemo } from 'react';
import { fetchRoutine, fetchMasterRoutine, fetchTeachers, createSlot, updateSlot, deleteSlot } from '../../services/api';
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
  "Communication Lab", "Antenna Lab", "Computer Lab"
];

// Types that occupy 3 consecutive periods instead of 1
const SPAN3_TYPES = ['lab', 'project', 'seminar', 'thesis'];

// Types where a room/teacher isn't a real, bookable resource —
// so we don't force the user to pick one; we hardcode a placeholder instead.
const NO_RESOURCE_TYPES = ['project', 'seminar', 'thesis'];
const PLACEHOLDER_ROOM = 'N/A';
const PLACEHOLDER_TEACHER = 'N/A';

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
  if (lower.includes("computer") || lower.includes("cml")) return "Computer Lab";
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
  const [allTeachers, setAllTeachers] = useState([]);
  const [editorModal, setEditorModal] = useState(null); 

  const activeConfigs = configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series);
  const selectedCfg = activeConfigs.find(c => c.series === Number(series));

  async function load() {
    if (!series) { setSlots([]); return; }
    try {
      const [res, masterRes, teachersRes] = await Promise.all([
        fetchRoutine(series), 
        fetchMasterRoutine('all'),
        fetchTeachers()
      ]);
      if (res.success) setSlots(res.data);
      if (masterRes.success) setAllMasterSlots(Object.values(masterRes.data).flatMap(d => d.slots || []));
      if (teachersRes.success) setAllTeachers(teachersRes.data);
    } catch(err) { toast('Failed to load', '#ff7a6a'); }
  }

  useEffect(() => { load(); }, [series]);

  const grid = useMemo(() => buildGrid(slots), [slots]);

  function checkFallbackCollisions(formData) {
    const requestedPeriods = Array.from({ length: Number(formData.periodSpan) }, (_, i) => Number(formData.startPeriod) + i);
    const requestedTeachers = formData.teachers;
    const editId = editorModal?.data?._id;

    for (const slot of allMasterSlots) {
      if (editId && slot._id === editId) continue;
      if (slot.day !== formData.day) continue;

      const slotSpan = slot.periodSpan?.length || slot.periodSpan || 1;
      const existingPeriods = Array.from({ length: slotSpan }, (_, i) => slot.startPeriod + i);
      
      if (requestedPeriods.some(p => existingPeriods.includes(p))) {
        const slotTeachers = slot.teachers || slot.teacherInitials || [];
        const teacherOverlap = requestedTeachers.find(t => t !== PLACEHOLDER_TEACHER && slotTeachers.includes(t));
        if (teacherOverlap) {
           return `Teacher Conflict: ${teacherOverlap} is busy with ${slot.courseCode} (Series ${slot.series})`;
        }
      }
    }
    return null;
  }

  async function saveSlot(formData) {
    const conflictError = checkFallbackCollisions(formData);
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
    confirmButtonColor: '#ff5a45',
    cancelButtonColor: '#555',
    background: '#0a0d14',
    color: '#fff'
  });

  if (!result.isConfirmed) return;

  try {
    await deleteSlot(id);

    await Swal.fire({
      title: 'Deleted!',
      text: 'The class has been deleted.',
      icon: 'success',
      confirmButtonColor: '#638cff',
      background: '#0a0d14',
      color: '#fff'
    });

    setEditorModal(null);
    load();
  } catch (err) {
    Swal.fire({
      title: 'Delete failed',
      text: 'Something went wrong while deleting the class.',
      icon: 'error',
      confirmButtonColor: '#ff5a45',
      background: '#0a0d14',
      color: '#fff'
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 60 }} />
              {TIME_PERIODS.map(tp => (
                <col key={tp.period} style={{ width: `calc((100% - 60px) / ${TIME_PERIODS.length})` }} />
              ))}
            </colgroup>
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
                        <td key={tp.period} colSpan={colSpan} style={{ padding: 4, borderLeft: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box' }}>
                          {slot ? (
                            <button onClick={()=>setEditorModal({ isNew: false, data: slot })} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 6, border: `1px solid ${COLORS[slot.type]?.border || '#555'}`, background: COLORS[slot.type]?.bg || 'rgba(255,255,255,0.1)', color: COLORS[slot.type]?.text || '#fff', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 6px', cursor: 'pointer', textAlign: 'left' }}>
                              <div className="mono" style={{ fontSize: 9, fontWeight: 700 }}>{slot.courseCode}</div>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{slot.type}</div>
                            </button>
                          ) : (
                            <button onClick={()=>setEditorModal({ isNew: true, data: { day, startPeriod: tp.period }})} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18 }}>+</button>
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
          allTeachers={allTeachers}
          onClose={()=>setEditorModal(null)} 
          onSave={saveSlot} 
          onDelete={trashSlot} 
        />
      )}
    </div>
  );
}

function SlotEditorModal({ modal, allMasterSlots, allTeachers, onClose, onSave, onDelete }) {
  const isNew = modal.isNew;
  const init = modal.data;
  
  const initialTeachers = Array.isArray(init.teachers) ? init.teachers : (init.teacherInitials || []);
  const rawRoom = normalizeRoom(init.room);
  
  const initType = init.type || 'theory';
  const calculatedSpan = SPAN3_TYPES.includes(initType) ? 3 : 1;
  const initNoResource = NO_RESOURCE_TYPES.includes(initType);

  const [form, setForm] = useState({
    courseCode: init.courseCode || '', courseName: init.courseName || init.courseTitle || '',
    type: initType, day: init.day, startPeriod: init.startPeriod,
    periodSpan: calculatedSpan,
    room: rawRoom || (initNoResource ? PLACEHOLDER_ROOM : ''),
    teachers: initialTeachers.length ? initialTeachers : (initNoResource ? [PLACEHOLDER_TEACHER] : []),
    batchScope: init.batchScope || 'all'
  });

  const [showCustomTeacher, setShowCustomTeacher] = useState(false);
  const [customTeacherText, setCustomTeacherText] = useState('');

  // Whether room/teacher selection is actually required for this class type
  const requiresResources = !NO_RESOURCE_TYPES.includes(form.type);

  // Auto-enforce duration constraint + hardcode room/teacher when type changes
  useEffect(() => {
    setForm(prev => {
      const nextSpan = SPAN3_TYPES.includes(prev.type) ? 3 : 1;
      const noResource = NO_RESOURCE_TYPES.includes(prev.type);

      if (noResource) {
        return {
          ...prev,
          periodSpan: nextSpan,
          room: prev.room && prev.room !== '' ? prev.room : PLACEHOLDER_ROOM,
          teachers: prev.teachers.length ? prev.teachers : [PLACEHOLDER_TEACHER],
        };
      }
      // Leaving a "no resource" type — clear placeholders so a real pick is required again
      return {
        ...prev,
        periodSpan: nextSpan,
        room: prev.room === PLACEHOLDER_ROOM ? '' : prev.room,
        teachers: prev.teachers.filter(t => t !== PLACEHOLDER_TEACHER),
      };
    });
  }, [form.type]);

  // ── Calculate Busy Rooms & Teachers in Real-Time ──
  const { busyRooms, busyTeachers } = useMemo(() => {
    const occupiedRooms = new Set();
    const occupiedTeachers = new Set();
    const requestedPeriods = Array.from({ length: Number(form.periodSpan) }, (_, i) => Number(form.startPeriod) + i);

    allMasterSlots.forEach(slot => {
      if (!isNew && slot._id === init._id) return; // Skip self
      if (slot.day !== form.day) return;

      const slotSpan = slot.periodSpan?.length || slot.periodSpan || 1;
      const existingPeriods = Array.from({ length: slotSpan }, (_, i) => slot.startPeriod + i);
      
      const hasTimeOverlap = requestedPeriods.some(p => existingPeriods.includes(p));
      if (hasTimeOverlap) {
        const standardRoom = normalizeRoom(slot.room);
        if (standardRoom && standardRoom !== PLACEHOLDER_ROOM) occupiedRooms.add(standardRoom);

        const slotTeachers = slot.teachers || slot.teacherInitials || [];
        slotTeachers.forEach(t => { if (t !== PLACEHOLDER_TEACHER) occupiedTeachers.add(t); });
      }
    });
    return { busyRooms: occupiedRooms, busyTeachers: occupiedTeachers };
  }, [form.day, form.startPeriod, form.periodSpan, allMasterSlots, init._id, isNew]);

  // Auto-clear room if it becomes occupied during time change (skip for hardcoded placeholder)
  useEffect(() => {
    if (form.room && form.room !== PLACEHOLDER_ROOM && busyRooms.has(form.room)) {
      setForm(prev => ({ ...prev, room: '' }));
      toast(`Room cleared: ${form.room} is occupied during this time`, '#f0c060');
    }
  }, [busyRooms, form.room]);

  // Auto-clear teachers if they become occupied during time change (skip placeholder)
  useEffect(() => {
    const newlyOccupied = form.teachers.filter(t => t !== PLACEHOLDER_TEACHER && busyTeachers.has(t));
    if (newlyOccupied.length > 0) {
      setForm(prev => ({ ...prev, teachers: prev.teachers.filter(t => !busyTeachers.has(t)) }));
      toast(`Removed occupied teachers: ${newlyOccupied.join(', ')}`, '#f0c060');
    }
  }, [busyTeachers, form.teachers]);

  function handleSubmit(e) {
    e.preventDefault();
    if (requiresResources && !form.room) {
      toast('Please select an available room', '#ff7a6a');
      return;
    }
    if (requiresResources && form.teachers.length === 0) {
      toast('Please assign at least one teacher', '#ff7a6a');
      return;
    }
    const payload = { 
      ...form, 
      room: form.room || PLACEHOLDER_ROOM,
      teachers: (form.teachers.length ? form.teachers : [PLACEHOLDER_TEACHER]).filter(Boolean),
      startPeriod: Number(form.startPeriod), 
      periodSpan: Number(form.periodSpan), 
    };
    onSave(payload);
  }

  function handleTeacherSelect(val) {
    if (val === 'OTHERS') {
      setShowCustomTeacher(true);
    } else if (val) {
      if (!form.teachers.includes(val)) {
        setForm(prev => ({ ...prev, teachers: [...prev.teachers.filter(t => t !== PLACEHOLDER_TEACHER), val] }));
      }
    }
  }

  function handleAddCustomTeacher() {
    const trimmed = customTeacherText.trim().toUpperCase();
    if (trimmed && !form.teachers.includes(trimmed)) {
      setForm(prev => ({ ...prev, teachers: [...prev.teachers.filter(t => t !== PLACEHOLDER_TEACHER), trimmed] }));
    }
    setCustomTeacherText('');
    setShowCustomTeacher(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position: 'relative', width: 440, background: '#0a0d14', border: '1px solid rgba(99,140,255,0.3)', borderRadius: 12, padding: 24 }}>
        
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

          {requiresResources ? (
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
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: '2px 2px' }}>
              Room not required for {form.type} (set to "{PLACEHOLDER_ROOM}")
            </div>
          )}

          <GlassSelect 
            value={form.batchScope} 
            onChange={val => setForm({...form, batchScope: val})}
            options={[
              { value: 'all', label: 'All Sections' },
              { value: '1st30', label: '1st 30' },
              { value: '2nd30', label: '2nd 30' }
            ]}
          />

          {/* ── Dynamic Teacher Selection ── */}
          {requiresResources ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Assigned Teachers</div>
              
              {/* Selected Badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, minHeight: 28, alignItems: 'center' }}>
                {form.teachers.length === 0 && <span style={{ fontSize: 11, color: 'rgba(255,90,69,0.7)' }}>* No teachers selected</span>}
                {form.teachers.map(t => (
                  <span key={t} style={{ background: 'rgba(99,140,255,0.15)', border: '1px solid rgba(99,140,255,0.3)', padding: '2px 8px', borderRadius: 6, color: '#a8c2ff', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t}
                    <button type="button" onClick={() => setForm(prev => ({...prev, teachers: prev.teachers.filter(x => x !== t)}))} style={{ background: 'none', border: 'none', color: '#ff7a6a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>&times;</button>
                  </span>
                ))}
              </div>

              {/* Dropdown / Manual Input Toggle */}
              {!showCustomTeacher ? (
                <GlassSelect 
                  placeholder="-- Select Teacher to Add --"
                  value={''} // Always reset so it acts as an action button
                  onChange={handleTeacherSelect}
                  options={[
                    ...allTeachers.map(t => {
                      const init = t.credentials?.initials || t.initials;
                      const isBusy = busyTeachers.has(init);
                      const isAdded = form.teachers.includes(init);
                      return {
                        value: init,
                        label: isBusy ? `${init} (Occupied)` : isAdded ? `${init} (Added)` : init,
                        disabled: isBusy || isAdded
                      }
                    }),
                    { value: 'OTHERS', label: '+ Add Others (Manual)' }
                  ]}
                />
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input 
                    placeholder="Initials (e.g. MSR)" 
                    value={customTeacherText} 
                    onChange={e => setCustomTeacherText(e.target.value.toUpperCase())} 
                    style={{ ...inputSt, textTransform: 'uppercase' }} 
                    autoFocus
                  />
                  <button type="button" onClick={handleAddCustomTeacher} style={{ padding: '0 16px', borderRadius: 8, background: 'rgba(48,216,144,0.15)', color: '#30d890', border: '1px solid rgba(48,216,144,0.3)', cursor: 'pointer', fontWeight: 600 }}>Add</button>
                  <button type="button" onClick={() => setShowCustomTeacher(false)} style={{ padding: '0 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#aaa', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: '2px 2px' }}>
              Teacher not required for {form.type} (set to "{PLACEHOLDER_TEACHER}")
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" style={{ flex: 1, padding: 10, background: 'rgba(99,140,255,0.2)', border: '1px solid rgba(99,140,255,0.5)', color: '#a8c2ff', borderRadius: 8, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s ease' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(99,140,255,0.3)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(99,140,255,0.2)'}>Save</button>
            {!isNew && <button type="button" onClick={()=>onDelete(init._id)} style={{ padding: '10px 16px', background: 'rgba(255,90,69,0.1)', border: '1px solid rgba(255,90,69,0.4)', color: '#ff7a6a', borderRadius: 8, cursor: 'pointer', transition: 'background 0.2s ease' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,90,69,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,90,69,0.1)'}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  )
}