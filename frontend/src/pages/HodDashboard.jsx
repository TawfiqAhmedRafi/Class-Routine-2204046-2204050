import { useState, useEffect, useMemo } from 'react';
import {
  fetchSeries, addSeries, updateSeriesSemester, deleteSeries, editSeriesLabel,
  fetchPendingRequests, fetchAllRequests, approveRequest, rejectRequest,
  fetchRoutine, createSlot, updateSlot, deleteSlot
} from '../services/api';
import { toast } from '../components/Toast';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import Swal from 'sweetalert2';

function timeSince(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Shared Inputs ────────────────────────────────────────────────────────────
const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%'
};

// ── Series Manager ────────────────────────────────────────────────────────────
function SeriesManager({ configs, reload }) {
  const [newSeries, setNewSeries] = useState('');
  const [newSem,    setNewSem]    = useState('odd');
  const [newLabel,  setNewLabel]  = useState('');
  const [busy,      setBusy]      = useState(false);
  
  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editLabelText, setEditLabelText] = useState('');

  async function handleAdd() {
    const s = parseInt(newSeries);
    if (!s || s < 10 || s > 30) { toast('Enter a valid 2-digit series', '#ff7a6a', 'rgba(255,90,69,0.35)'); return; }
    setBusy(true);
    try {
      const res = await addSeries(s, newSem, newLabel || `${s} Series`);
      if (res.success) {
        toast(`Series ${s} added`, '#30d890', 'rgba(48,216,144,0.4)');
        setNewSeries(''); setNewLabel('');
        reload();
      }
    } catch (err) { toast('Failed to add series', '#ff7a6a', 'rgba(255,90,69,0.35)'); } 
    finally { setBusy(false); }
  }

  async function handleDelete(s) {
    // 2. Use SweetAlert2 instead of window.confirm
    const result = await Swal.fire({
      title: `Graduate Series ${s}?`,
      text: "This will remove the series from active view. You can reactivate it later.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff7a6a',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Yes, Graduate',
      background: '#0a0d14', // Matches your modal style
      color: '#e2eaff',
      customClass: { popup: 'glass' } // Uses your global CSS glass style
    });

    if (result.isConfirmed) {
      try {
        const res = await deleteSeries(s);
        if (res.success) {
          toast(`Series ${s} graduated`, '#f0c060', 'rgba(240,190,60,0.35)');
          reload();
        }
      } catch (err) {
        toast(err?.response?.data?.message || 'Failed', '#ff7a6a', 'rgba(255,90,69,0.35)');
      }
    }
  }

  async function handleSemUpdate(s, sem) {
    try {
      const res = await updateSeriesSemester(s, sem);
      if (res.success) { toast(`Series ${s} → ${sem} semester`, '#a8c2ff', 'rgba(99,140,255,0.4)'); reload(); }
    } catch (err) { toast('Failed to update semester', '#ff7a6a', 'rgba(255,90,69,0.35)'); }
  }

  async function saveEditLabel(s) {
    try {
      const res = await editSeriesLabel(s, editLabelText);
      if (res.success) {
        toast('Label updated', '#30d890', 'rgba(48,216,144,0.4)');
        setEditingId(null);
        reload();
      }
    } catch(err) { toast('Failed to update label', '#ff7a6a', 'rgba(255,90,69,0.35)'); }
  }

  return (
    <div>
      {configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series).map(cfg => (
        <div key={cfg.series} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 8,
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
        }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#a8c2ff', width: 36 }}>{cfg.series}</div>
          
          <div style={{ flex: 1 }}>
            {editingId === cfg.series ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={editLabelText} onChange={e=>setEditLabelText(e.target.value)} style={{...inputSt, padding: '4px 8px'}} autoFocus />
                <button onClick={()=>saveEditLabel(cfg.series)} style={{ padding: '4px 10px', background: 'rgba(48,216,144,0.15)', color: '#30d890', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>Save</button>
                <button onClick={()=>setEditingId(null)} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#c0d0e8', fontWeight: 600 }}>{cfg.label}</div>
                <button onClick={() => { setEditingId(cfg.series); setEditLabelText(cfg.label); }} style={{ background: 'none', border: 'none', color: 'rgba(140,165,215,0.5)', cursor: 'pointer', fontSize: 11 }}>✎ Edit</button>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(140,165,215,0.45)', marginTop: 2 }}>Active</div>
          </div>

          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 2 }}>
            {['odd','even'].map(s => (
              <button key={s} onClick={() => handleSemUpdate(cfg.series, s)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer',
                background: cfg.currentSemester === s ? 'rgba(60,100,220,0.28)' : 'transparent',
                color: cfg.currentSemester === s ? '#a8c2ff' : 'rgba(140,165,215,0.35)',
                fontWeight: cfg.currentSemester === s ? 700 : 400, textTransform: 'capitalize',
              }}>{s}</button>
            ))}
          </div>
          <button onClick={() => handleDelete(cfg.series)} style={{
            padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,90,69,0.25)',
            background: 'rgba(220,60,40,0.08)', color: '#ff8070', fontSize: 11, cursor: 'pointer',
          }}>Graduate</button>
        </div>
      ))}

      {/* Add new series */}
      <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Add New Series</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input placeholder="Year e.g. 24" value={newSeries} onChange={e => setNewSeries(e.target.value)} style={{ ...inputSt, width: 100, fontFamily: 'JetBrains Mono, monospace' }} />
          <input placeholder="Label e.g. 24 Series (1st Year)" value={newLabel} onChange={e => setNewLabel(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <select value={newSem} onChange={e => setNewSem(e.target.value)} style={{ ...inputSt, width: 110, background: 'rgba(20,25,40,0.9)' }}>
            <option value="odd">Odd Sem</option>
            <option value="even">Even Sem</option>
          </select>
          <button onClick={handleAdd} disabled={busy} style={{
            padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: '1px solid rgba(48,216,144,0.4)', background: 'rgba(20,180,120,0.14)', color: '#30d890', opacity: busy ? 0.5 : 1,
          }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Routine Builder ───────────────────────────────────────────────────────────
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

function RoutineBuilder({ configs }) {
  const [series, setSeries] = useState('');
  const [slots, setSlots] = useState([]);
  const [editorModal, setEditorModal] = useState(null); // { isNew, data }

  const activeConfigs = configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series);
  const selectedCfg = activeConfigs.find(c => c.series === Number(series));

  async function load() {
    if (!series) { setSlots([]); return; }
    try {
      const res = await fetchRoutine(series);
      if (res.success) setSlots(res.data);
    } catch(err) { toast('Failed to load slots', '#ff7a6a'); }
  }

  useEffect(() => { load(); }, [series]);

  const grid = useMemo(() => buildGrid(slots), [slots]);

  async function saveSlot(formData) {
    try {
      if (editorModal.isNew) {
        await createSlot({ ...formData, series: Number(series), semester: selectedCfg.currentSemester });
        toast('Slot created', '#30d890');
      } else {
        await updateSlot(editorModal.data._id, formData);
        toast('Slot updated', '#a8c2ff');
      }
      setEditorModal(null);
      load();
    } catch(err) { toast('Save failed', '#ff7a6a'); }
  }

  async function trashSlot(id) {
    if(!window.confirm('Delete this class?')) return;
    try {
      await deleteSlot(id);
      toast('Slot deleted', '#ff7a6a');
      setEditorModal(null);
      load();
    } catch(err) { toast('Delete failed', '#ff7a6a'); }
  }

  return (
    <div className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select value={series} onChange={e=>setSeries(e.target.value)} style={{...inputSt, width: 200}}>
          <option value="">-- Select Series to Edit --</option>
          {activeConfigs.map(c => <option key={c.series} value={c.series}>{c.label}</option>)}
        </select>
        {selectedCfg && <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: 'rgba(140,165,215,0.6)'}}>Editing Semester: <strong style={{color:'#a8c2ff', textTransform:'capitalize'}}>{selectedCfg.currentSemester}</strong></div>}
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
                            <button onClick={()=>setEditorModal({ isNew: false, data: slot })} style={{
                              width: '100%', height: 44, borderRadius: 6, border: `1px solid ${COLORS[slot.type]?.border || '#555'}`,
                              background: COLORS[slot.type]?.bg || 'rgba(255,255,255,0.1)', color: COLORS[slot.type]?.text || '#fff',
                              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 6px',
                              cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.1s'
                            }}>
                              <div className="mono" style={{ fontSize: 9, fontWeight: 700 }}>{slot.courseCode}</div>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{slot.type}</div>
                            </button>
                          ) : (
                            <button onClick={()=>setEditorModal({ isNew: true, data: { day, startPeriod: tp.period }})} style={{
                              width: '100%', height: 44, borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)', background: 'transparent',
                              color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18
                            }}>+</button>
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

// ── Slot Editor Form Modal ────────────────────────────────────────────────────
function SlotEditorModal({ modal, onClose, onSave, onDelete }) {
  const isNew = modal.isNew;
  const init = modal.data;

  // Transform arrays to strings for form inputs
  const rawTeachers = Array.isArray(init.teachers) ? init.teachers.join(', ') : (init.teacherInitials?.join(', ') || '');
  const rawRoom = typeof init.room === 'object' ? init.room.roomLabel : (init.room || '');
  const rawSpan = Array.isArray(init.periodSpan) ? init.periodSpan.length : (init.periodSpan || 1);

  const [form, setForm] = useState({
    courseCode: init.courseCode || '',
    courseName: init.courseName || init.courseTitle || '',
    type: init.type || 'theory',
    day: init.day,
    startPeriod: init.startPeriod,
    periodSpan: rawSpan,
    room: rawRoom,
    teachers: rawTeachers,
    batchScope: init.batchScope || 'all'
  });

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    payload.startPeriod = Number(payload.startPeriod);
    payload.periodSpan = Number(payload.periodSpan);
    payload.teachers = payload.teachers.split(',').map(s=>s.trim()).filter(Boolean);
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
          
          <input required placeholder="Course Title" value={form.courseName} onChange={e=>setForm({...form, courseName: e.target.value})} style={inputSt}/>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <select value={form.day} onChange={e=>setForm({...form, day: e.target.value})} style={inputSt}>
              {DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}
            </select>
            <select value={form.startPeriod} onChange={e=>setForm({...form, startPeriod: e.target.value})} style={inputSt}>
              {NUM_PERIODS.map(p => <option key={p} value={p}>P{p}</option>)}
            </select>
            <input type="number" min="1" max="5" placeholder="Span" value={form.periodSpan} onChange={e=>setForm({...form, periodSpan: e.target.value})} style={inputSt}/>
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

// ── Request Cards (Unchanged logic, compacted for length) ─────────────────────
function RequestCard({ req, onDecide }) {
  const [hodComment, setHodComment] = useState('');
  const [busy, setBusy] = useState(false);
  const isSlot = req.type === 'slot_change';

  async function decide(action) {
    setBusy(true); await onDecide(req._id, action, hodComment); setBusy(false);
  }

  return (
    <div className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{req.submittedBy}</div>
          <div className="mono" style={{ fontSize: 10, color: '#a8c2ff' }}>{isSlot ? 'Slot Change' : 'Lab Booking'}</div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.4)' }}>{timeSince(req.createdAt)}</div>
      </div>
      <textarea value={hodComment} onChange={e => setHodComment(e.target.value)} placeholder="HOD comment (optional)..." style={{...inputSt, height: 40, marginBottom: 10}} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => decide('approved')} disabled={busy} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(48,216,144,0.4)', background: 'rgba(20,180,120,0.14)', color: '#30d890' }}>Approve</button>
        <button onClick={() => decide('rejected')} disabled={busy} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(255,90,69,0.35)', background: 'rgba(220,60,40,0.11)', color: '#ff7a6a' }}>Reject</button>
      </div>
    </div>
  );
}

// ── Main HOD Dashboard ────────────────────────────────────────────────────────
export default function HodDashboard({ user }) {
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [allRequests,   setAllRequests]   = useState([]);
  const [hodTab,        setHodTab]        = useState('series'); // 'series', 'routine', 'requests', 'history'

  async function loadData() {
    try {
      const [ser, pend, all] = await Promise.all([fetchSeries(), fetchPendingRequests(), fetchAllRequests()]);
      if (ser.success) setSeriesConfigs(ser.data);
      if (pend.success) setRequests(pend.data);
      if (all.success) setAllRequests(all.data);
    } catch (_) {}
  }

  useEffect(() => { loadData(); }, []);

  async function handleDecide(id, action, reason) {
    try {
      let res = action === 'approved' ? await approveRequest(id) : await rejectRequest(id, reason);
      if (res.success) { toast(action === 'approved' ? 'Approved' : 'Rejected', action === 'approved' ? '#30d890' : '#ff7a6a'); loadData(); }
    } catch (err) { toast('Action failed', '#ff7a6a'); }
  }

  const tabBtnStyle = (k) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer',
    background: hodTab === k ? 'rgba(60,100,220,0.25)' : 'transparent',
    color: hodTab === k ? '#a8c2ff' : 'rgba(140,165,215,0.45)', fontWeight: hodTab === k ? 700 : 400
  });

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }} className="fade-up">

      <div style={{ marginBottom: 24 }}>
        <h1 className="grad-text" style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>HOD Control Panel</h1>
      </div>

      {/* Primary Navigation Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtnStyle('series')} onClick={() => setHodTab('series')}>Series Settings</button>
        <button style={tabBtnStyle('routine')} onClick={() => setHodTab('routine')}>Manage Routine</button>
        <button style={tabBtnStyle('requests')} onClick={() => setHodTab('requests')}>Requests ({requests.length})</button>
        <button style={tabBtnStyle('history')} onClick={() => setHodTab('history')}>Log ({allRequests.length})</button>
      </div>

      {hodTab === 'series' && <SeriesManager configs={seriesConfigs} reload={loadData} />}
      {hodTab === 'routine' && <RoutineBuilder configs={seriesConfigs} />}
      
      {hodTab === 'requests' && (
        <div>{requests.length === 0 ? <div style={{padding: 40, textAlign: 'center', color: '#555'}}>No pending requests</div> : requests.map(r => <RequestCard key={r._id} req={r} onDecide={handleDecide} />)}</div>
      )}

      {hodTab === 'history' && (
        <div>
          {allRequests.map(req => (
            <div key={req._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div><span style={{color: '#a8c2ff', fontWeight: 700}}>{req.submittedBy}</span> · {req.type.replace('_',' ')}</div>
              <div style={{color: req.status === 'approved' ? '#30d890' : '#ff7a6a', fontWeight: 700}}>{req.status.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}