import { useState } from 'react';
import Swal from 'sweetalert2';
import { addSeries, updateSeriesSemester, deleteSeries, editSeriesLabel } from '../../services/api';
import { toast } from '../Toast';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%'
};

export default function SeriesManager({ configs, reload }) {
  const [newSeries, setNewSeries] = useState('');
  const [newSem,    setNewSem]    = useState('odd');
  const [newLabel,  setNewLabel]  = useState('');
  const [busy,      setBusy]      = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabelText, setEditLabelText] = useState('');

  async function handleAdd() {
    const s = parseInt(newSeries);
    if (!s || s < 10 || s > 30) { toast('Enter a valid 2-digit series', '#ff7a6a'); return; }
    setBusy(true);
    try {
      const res = await addSeries(s, newSem, newLabel || `${s} Series`);
      if (res.success) { toast(`Series ${s} added`, '#30d890'); setNewSeries(''); setNewLabel(''); reload(); }
    } catch (err) { toast('Failed to add series', '#ff7a6a'); } finally { setBusy(false); }
  }

  async function handleDelete(s) {
    const result = await Swal.fire({
      title: `Graduate Series ${s}?`,
      text: "This will hide the series from the active routine.",
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ff7a6a', cancelButtonColor: '#555',
      background: '#0a0d14', color: '#e2eaff'
    });
    if (result.isConfirmed) {
      try { await deleteSeries(s); toast(`Series ${s} graduated`, '#f0c060'); reload(); } 
      catch (err) { toast('Failed', '#ff7a6a'); }
    }
  }

  async function handleSemUpdate(s, sem) {
    const result = await Swal.fire({
      title: `Change to ${sem} semester?`,
      text: `Are you sure you want to shift Series ${s} to the ${sem} semester?`,
      icon: 'question', showCancelButton: true, confirmButtonColor: '#30d890', cancelButtonColor: '#555',
      background: '#0a0d14', color: '#e2eaff'
    });
    if (result.isConfirmed) {
      try { await updateSeriesSemester(s, sem); toast(`Series ${s} updated`, '#a8c2ff'); reload(); } 
      catch (err) { toast('Failed', '#ff7a6a'); }
    }
  }

  async function saveEditLabel(s) {
    const result = await Swal.fire({
      title: `Save Label Change?`,
      text: `Update label to "${editLabelText}"?`,
      icon: 'question', showCancelButton: true, confirmButtonColor: '#30d890', cancelButtonColor: '#555',
      background: '#0a0d14', color: '#e2eaff'
    });
    if (result.isConfirmed) {
      try { await editSeriesLabel(s, editLabelText); toast('Label updated', '#30d890'); setEditingId(null); reload(); } 
      catch(err) { toast('Failed', '#ff7a6a'); }
    } else { setEditingId(null); }
  }

  return (
    <div>
      {configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series).map(cfg => (
        <div key={cfg.series} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#a8c2ff', width: 36 }}>{cfg.series}</div>
          <div style={{ flex: 1 }}>
            {editingId === cfg.series ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={editLabelText} onChange={e=>setEditLabelText(e.target.value)} style={{...inputSt, padding: '4px 8px'}} autoFocus />
                <button onClick={()=>saveEditLabel(cfg.series)} style={{ padding: '4px 10px', background: 'rgba(48,216,144,0.15)', color: '#30d890', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
                <button onClick={()=>setEditingId(null)} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#c0d0e8', fontWeight: 600 }}>{cfg.label}</div>
                <button onClick={() => { setEditingId(cfg.series); setEditLabelText(cfg.label); }} style={{ background: 'none', border: 'none', color: 'rgba(140,165,215,0.5)', cursor: 'pointer', fontSize: 11 }}>✎ Edit</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 2 }}>
            {['odd','even'].map(s => (
              <button key={s} onClick={() => handleSemUpdate(cfg.series, s)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: cfg.currentSemester === s ? 'rgba(60,100,220,0.28)' : 'transparent', color: cfg.currentSemester === s ? '#a8c2ff' : 'rgba(140,165,215,0.35)', fontWeight: cfg.currentSemester === s ? 700 : 400, textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>
          <button onClick={() => handleDelete(cfg.series)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,90,69,0.25)', background: 'rgba(220,60,40,0.08)', color: '#ff8070', fontSize: 11, cursor: 'pointer' }}>Graduate</button>
        </div>
      ))}
      <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Year e.g. 24" value={newSeries} onChange={e => setNewSeries(e.target.value)} style={{ ...inputSt, width: 100 }} />
          <input placeholder="Label e.g. 24 Series (1st Year)" value={newLabel} onChange={e => setNewLabel(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <select value={newSem} onChange={e => setNewSem(e.target.value)} style={{ ...inputSt, width: 110, background: 'rgba(20,25,40,0.9)' }}>
            <option value="odd">Odd Sem</option>
            <option value="even">Even Sem</option>
          </select>
          <button onClick={handleAdd} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(48,216,144,0.4)', background: 'rgba(20,180,120,0.14)', color: '#30d890' }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}