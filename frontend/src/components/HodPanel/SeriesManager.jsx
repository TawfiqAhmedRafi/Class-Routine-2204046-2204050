import { useState } from 'react';
import Swal from 'sweetalert2';
import { addSeries, updateSeriesSemester, deleteSeries, editSeriesLabel } from '../../services/api';
import { toast } from '../Toast';
import GlassSelect from '../GlassSelect';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%',
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
    <div className="series-manager">
      <style>{`
        .series-manager * { box-sizing: border-box; }

        .series-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          flex-wrap: wrap;
        }
        .series-num {
          font-size: clamp(16px, 4vw, 22px);
          font-weight: 700;
          color: #a8c2ff;
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
          color: #c0d0e8;
          font-weight: 600;
          word-break: break-word;
        }
        .edit-btn {
          background: none;
          border: none;
          color: rgba(140,165,215,0.5);
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
        .save-btn { background: rgba(48,216,144,0.15); color: #30d890; }
        .cancel-btn { background: rgba(255,255,255,0.05); color: #aaa; }

        .sem-toggle {
          display: flex;
          gap: 2px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
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
          border: 1px solid rgba(255,90,69,0.25);
          background: rgba(220,60,40,0.08);
          color: #ff8070;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .add-panel {
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
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
          border: 1px solid rgba(48,216,144,0.4);
          background: rgba(20,180,120,0.14);
          color: #30d890;
          flex-shrink: 0;
        }

        /* Tablet and below: let the label row take full width so the
           semester toggle & graduate button wrap onto their own line
           instead of squeezing the label. */
        @media (max-width: 640px) {
          .series-card {
            align-items: flex-start;
          }
          .series-label-wrap {
            flex: 1 1 100%;
            order: 1;
          }
          .sem-toggle {
            order: 2;
          }
          .graduate-btn {
            order: 3;
          }
        }

        /* Small phones: stack every control full-width, add form goes vertical */
        @media (max-width: 420px) {
          .series-card {
            flex-direction: column;
            align-items: stretch;
          }
          .series-num {
            width: auto;
          }
          .sem-toggle, .graduate-btn {
            width: 100%;
            justify-content: center;
          }
          .sem-toggle {
            display: flex;
          }
          .sem-btn {
            flex: 1;
            text-align: center;
          }
          .add-form .f-year,
          .add-form .f-label,
          .add-form .f-sem,
          .add-form .f-btn {
            width: 100%;
            flex: 1 1 100%;
          }
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
                  background: cfg.currentSemester === s ? 'rgba(60,100,220,0.28)' : 'transparent',
                  color: cfg.currentSemester === s ? '#a8c2ff' : 'rgba(140,165,215,0.35)',
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