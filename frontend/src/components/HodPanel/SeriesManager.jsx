import { useState } from 'react';
import Swal from 'sweetalert2';
import { addSeries, updateSeriesSemester, deleteSeries, editSeriesLabel } from '../../services/api';
import { toast } from '../Toast';
import GlassSelect from '../GlassSelect';

const inputSt = {
  padding: '9px 12px', background: 'var(--surface)',
  border: '1px solid var(--surface-border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%',
  boxSizing: 'border-box'
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
    if (!s || s < 10 || s > 30) { toast('Enter a valid 2-digit series', 'var(--red)'); return; }
    setBusy(true);
    try {
      const res = await addSeries(s, newSem, newLabel || `${s} Series`);
      if (res.success) { toast(`Series ${s} added`, 'var(--green)'); setNewSeries(''); setNewLabel(''); reload(); }
    } catch (err) { toast('Failed to add series', 'var(--red)'); } finally { setBusy(false); }
  }

  async function handleDelete(s) {
    const result = await Swal.fire({
      title: `Graduate Series ${s}?`,
      text: "This will hide the series from the active routine.",
      icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--red)', cancelButtonColor: 'var(--text-muted)',
      background: 'var(--nav-bg)', color: 'var(--text)'
    });
    if (result.isConfirmed) {
      try { await deleteSeries(s); toast(`Series ${s} graduated`, 'var(--gold)'); reload(); }
      catch (err) { toast('Failed', 'var(--red)'); }
    }
  }

  async function handleSemUpdate(s, sem) {
    const result = await Swal.fire({
      title: `Change to ${sem} semester?`,
      text: `Are you sure you want to shift Series ${s} to the ${sem} semester?`,
      icon: 'question', showCancelButton: true, confirmButtonColor: 'var(--green)', cancelButtonColor: 'var(--text-muted)',
      background: 'var(--nav-bg)', color: 'var(--text)'
    });
    if (result.isConfirmed) {
      try { await updateSeriesSemester(s, sem); toast(`Series ${s} updated`, 'var(--blue)'); reload(); }
      catch (err) { toast('Failed', 'var(--red)'); }
    }
  }

  async function saveEditLabel(s) {
    const result = await Swal.fire({
      title: `Save Label Change?`,
      text: `Update label to "${editLabelText}"?`,
      icon: 'question', showCancelButton: true, confirmButtonColor: 'var(--green)', cancelButtonColor: 'var(--text-muted)',
      background: 'var(--nav-bg)', color: 'var(--text)'
    });
    if (result.isConfirmed) {
      try { await editSeriesLabel(s, editLabelText); toast('Label updated', 'var(--green)'); setEditingId(null); reload(); }
      catch(err) { toast('Failed', 'var(--red)'); }
    } else { setEditingId(null); }
  }

  return (
    <div className="series-manager">
      <style>{`
        .series-manager * { box-sizing: border-box; }

        .series-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          flex-wrap: wrap;
        }
        .series-num {
          font-size: clamp(16px, 4vw, 22px);
          font-weight: 700;
          color: var(--blue);
          width: 32px;
          flex-shrink: 0;
        }
        .series-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .series-label-text {
          font-size: 13px;
          color: var(--text);
          font-weight: 600;
          word-break: break-word;
        }
        .edit-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 11px;
          white-space: nowrap;
        }
        .edit-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          width: 100%;
        }
        .edit-row input {
          flex: 1 1 140px;
          min-width: 0;
        }
        .save-btn, .cancel-btn {
          padding: 4px 10px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
        }
        .save-btn { background: var(--green-bg); color: var(--green); }
        .cancel-btn { background: var(--surface); color: var(--text-muted); }

        .sem-toggle {
          display: flex;
          gap: 2px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          padding: 2px;
          flex-shrink: 0;
        }
        .sem-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: none;
          font-size: 11px;
          cursor: pointer;
          text-transform: capitalize;
          white-space: nowrap;
        }
        .graduate-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: 1px solid var(--red-bdr);
          background: var(--red-bg);
          color: var(--red);
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .add-panel {
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          margin-top: 16px;
        }
        .add-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .add-form .f-year { width: 100px; }
        .add-form .f-label { flex: 1 1 200px; min-width: 0; }
        .add-form .f-sem { width: 110px; flex-shrink: 0; }
        .add-form .f-btn {
          padding: 9px 18px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--green-bdr);
          background: var(--green-bg);
          color: var(--green);
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .series-card { align-items: flex-start; }
          .series-label-wrap { flex: 1 1 100%; order: 1; }
          .sem-toggle { order: 2; }
          .graduate-btn { order: 3; }
        }

        @media (max-width: 420px) {
          .series-card { flex-direction: column; align-items: stretch; }
          .series-num { width: auto; }
          .sem-toggle, .graduate-btn { width: 100%; justify-content: center; }
          .sem-toggle { display: flex; }
          .sem-btn { flex: 1; text-align: center; }
          .add-form .f-year, .add-form .f-label, .add-form .f-sem, .add-form .f-btn { width: 100%; flex: 1 1 100%; }
        }
      `}</style>

      {configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series).map(cfg => (
        <div key={cfg.series} className="series-card">
          <div className="series-num">{cfg.series}</div>

          <div className="series-label-wrap" style={{ flex: 1, minWidth: 0 }}>
            {editingId === cfg.series ? (
              <div className="edit-row">
                <input
                  value={editLabelText}
                  onChange={e=>setEditLabelText(e.target.value)}
                  style={{...inputSt, padding: '4px 8px'}}
                  autoFocus
                />
                <button className="save-btn" onClick={()=>saveEditLabel(cfg.series)}>Save</button>
                <button className="cancel-btn" onClick={()=>setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <div className="series-label-row">
                <div className="series-label-text">{cfg.label}</div>
                <button
                  className="edit-btn"
                  onClick={() => { setEditingId(cfg.series); setEditLabelText(cfg.label); }}
                >✎ Edit</button>
              </div>
            )}
          </div>

          <div className="sem-toggle">
            {['odd','even'].map(s => (
              <button
                key={s}
                className="sem-btn"
                onClick={() => handleSemUpdate(cfg.series, s)}
                style={{
                  background: cfg.currentSemester === s ? 'var(--blue-bg)' : 'transparent',
                  color: cfg.currentSemester === s ? 'var(--blue)' : 'var(--text-muted)',
                  fontWeight: cfg.currentSemester === s ? 700 : 400,
                }}
              >{s}</button>
            ))}
          </div>

          <button className="graduate-btn" onClick={() => handleDelete(cfg.series)}>Graduate</button>
        </div>
      ))}

      <div className="add-panel">
        <div className="add-form">
          <input
            className="f-year"
            placeholder="Year e.g. 24"
            value={newSeries}
            onChange={e => setNewSeries(e.target.value)}
            style={inputSt}
          />
          <input
            className="f-label"
            placeholder="Label e.g. 24 Series (1st Year)"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            style={inputSt}
          />
          <div className="f-sem">
            <GlassSelect
              value={newSem}
              onChange={val => setNewSem(val)}
              options={[
                { value: 'odd', label: 'Odd Sem' },
                { value: 'even', label: 'Even Sem' }
              ]}
            />
          </div>
          <button className="f-btn" onClick={handleAdd} disabled={busy}>+ Add</button>
        </div>
      </div>
    </div>
  );
}