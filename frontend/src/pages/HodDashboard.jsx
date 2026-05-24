import { useState, useEffect } from 'react';
import {
  fetchSeries, addSeries, updateSeriesSemester, deleteSeries,
  fetchPendingRequests, fetchAllRequests, approveRequest, rejectRequest,
} from '../services/api';
import { toast } from '../components/Toast';

function timeSince(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Series Manager ────────────────────────────────────────────────────────────
function SeriesManager({ configs, reload }) {
  const [newSeries, setNewSeries] = useState('');
  const [newSem,    setNewSem]    = useState('odd');
  const [newLabel,  setNewLabel]  = useState('');
  const [busy,      setBusy]      = useState(false);

  async function handleAdd() {
    const s = parseInt(newSeries);
    if (!s || s < 10 || s > 30) { toast('Enter a valid 2-digit series (e.g. 24)', '#ff7a6a', 'rgba(255,90,69,0.35)'); return; }
    setBusy(true);
    try {
      const res = await addSeries(s, newSem, newLabel || `${s} Series`);
      if (res.success) {
        toast(`Series ${s} added`, '#30d890', 'rgba(48,216,144,0.4)');
        setNewSeries(''); setNewLabel('');
        reload();
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to add series', '#ff7a6a', 'rgba(255,90,69,0.35)');
    } finally { setBusy(false); }
  }

  async function handleDelete(s) {
    if (!confirm(`Graduate and remove Series ${s}?`)) return;
    try {
      const res = await deleteSeries(s);
      if (res.success) { toast(`Series ${s} graduated`, '#f0c060', 'rgba(240,190,60,0.35)'); reload(); }
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed', '#ff7a6a', 'rgba(255,90,69,0.35)');
    }
  }

  async function handleSemUpdate(s, sem) {
    try {
      const res = await updateSeriesSemester(s, sem);
      if (res.success) { toast(`Series ${s} → ${sem} semester`, '#a8c2ff', 'rgba(99,140,255,0.4)'); reload(); }
    } catch (err) {
      toast('Failed to update semester', '#ff7a6a', 'rgba(255,90,69,0.35)');
    }
  }

  async function handleReactivate(cfg) {
    try {
      const res = await addSeries(cfg.series, cfg.currentSemester, cfg.label);
      if (res.success) { toast(`Series ${cfg.series} reactivated`, '#30d890', 'rgba(48,216,144,0.4)'); reload(); }
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed', '#ff7a6a', 'rgba(255,90,69,0.35)');
    }
  }

  const inputSt = {
    padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    color: '#d0dcf0', fontSize: 12, outline: 'none',
  };

  return (
    <div>
      {configs.filter(c => c.isActive).sort((a,b)=>b.series-a.series).map(cfg => (
        <div key={cfg.series} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', marginBottom: 8,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
        }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#a8c2ff', width: 36 }}>
            {cfg.series}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#c0d0e8', fontWeight: 600 }}>{cfg.label}</div>
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
            padding: '6px 12px', borderRadius: 7,
            border: '1px solid rgba(255,90,69,0.25)',
            background: 'rgba(220,60,40,0.08)',
            color: '#ff8070', fontSize: 11, cursor: 'pointer',
          }}>Graduate</button>
        </div>
      ))}

      {configs.some(c => !c.isActive) && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 11, color: 'rgba(140,165,215,0.35)', cursor: 'pointer', marginBottom: 8 }}>
            Graduated series ({configs.filter(c=>!c.isActive).length})
          </summary>
          {configs.filter(c => !c.isActive).map(cfg => (
            <div key={cfg.series} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              marginBottom: 6, background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, opacity: 0.5,
            }}>
              <span className="mono" style={{ fontSize: 16, color: '#64748b', width: 36 }}>{cfg.series}</span>
              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>{cfg.label}</span>
              <button onClick={() => handleReactivate(cfg)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid rgba(48,216,144,0.2)',
                background: 'rgba(20,180,120,0.08)',
                color: '#30d890', fontSize: 11, cursor: 'pointer',
              }}>Reactivate</button>
            </div>
          ))}
        </details>
      )}

      {/* Add new series */}
      <div style={{
        padding: '16px', background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
      }}>
        <div style={{ fontSize: 11, color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Add New Series
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input placeholder="Year e.g. 24" value={newSeries} onChange={e => setNewSeries(e.target.value)}
            style={{ ...inputSt, width: 100, fontFamily: 'JetBrains Mono, monospace' }} />
          <input placeholder="Label e.g. 24 Series (1st Year)" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            style={{ ...inputSt, flex: 1 }} />
          <select value={newSem} onChange={e => setNewSem(e.target.value)}
            style={{ ...inputSt, width: 110, background: 'rgba(20,25,40,0.9)' }}>
            <option value="odd">Odd Sem</option>
            <option value="even">Even Sem</option>
          </select>
          <button onClick={handleAdd} disabled={busy} style={{
            padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: '1px solid rgba(48,216,144,0.4)',
            background: 'rgba(20,180,120,0.14)', color: '#30d890',
            opacity: busy ? 0.5 : 1,
          }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────
function RequestCard({ req, onDecide }) {
  const [hodComment, setHodComment] = useState('');
  const [busy, setBusy] = useState(false);
  const isSlot = req.type === 'slot_change';

  async function decide(action) {
    setBusy(true);
    await onDecide(req._id, action, hodComment);
    setBusy(false);
  }

  return (
    <div className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(99,140,255,0.15)', border: '1px solid rgba(99,140,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#a8c2ff',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{req.submittedBy?.slice(0,3)}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{req.submittedBy}</div>
            <div className="mono" style={{ fontSize: 10, color: 'rgba(140,165,215,0.5)' }}>{req.type}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: isSlot ? '#a8c2ff' : '#7fffd4',
            background: isSlot ? 'rgba(60,100,220,0.15)' : 'rgba(20,180,120,0.12)',
            border: `1px solid ${isSlot ? 'rgba(99,140,255,0.3)' : 'rgba(40,210,140,0.3)'}`,
            borderRadius: 5, padding: '2px 8px', marginBottom: 4,
          }}>
            {isSlot ? 'Slot Change' : 'Lab Booking'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.4)' }}>{timeSince(req.createdAt)}</div>
        </div>
      </div>

      {isSlot && req.slotChange && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ background: 'rgba(255,90,69,0.07)', border: '1px solid rgba(255,90,69,0.14)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,120,100,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Current Slot</div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#ffb0a0' }}>{req.slotChange.existingSlotId}</div>
            </div>
            <div style={{ background: 'rgba(48,216,144,0.07)', border: '1px solid rgba(48,216,144,0.14)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: 'rgba(80,230,160,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Proposed</div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#7fffd4' }}>{req.slotChange.proposedDay}</div>
              <div style={{ fontSize: 11, color: 'rgba(130,200,170,0.65)' }}>P{(req.slotChange.proposedPeriodSpan || []).join('–')}</div>
            </div>
          </div>
          {req.slotChange.reason && (
            <div style={{
              fontSize: 12, color: 'rgba(160,185,225,0.65)',
              background: 'rgba(255,255,255,0.03)', borderRadius: 6,
              padding: '8px 10px', fontStyle: 'italic', marginBottom: 12,
            }}>"{req.slotChange.reason}"</div>
          )}
        </>
      )}

      {!isSlot && req.labBooking && (
        <>
          <div style={{ background: 'rgba(20,180,120,0.07)', border: '1px solid rgba(40,210,140,0.18)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                ['Course', req.labBooking.courseCode],
                ['Day',    req.labBooking.day],
                ['Periods', `P${req.labBooking.startPeriod} × ${req.labBooking.periodSpan}`],
                ['Batch',  req.labBooking.batchScope],
                ['Room',   req.labBooking.room],
              ].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize: 9, color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#7fffd4' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {req.labBooking.reason && (
            <div style={{
              fontSize: 12, color: 'rgba(160,185,225,0.65)',
              background: 'rgba(255,255,255,0.03)', borderRadius: 6,
              padding: '8px 10px', fontStyle: 'italic', marginBottom: 12,
            }}>"{req.labBooking.reason}"</div>
          )}
        </>
      )}

      <textarea
        value={hodComment}
        onChange={e => setHodComment(e.target.value)}
        placeholder="Optional HOD comment…"
        style={{
          width: '100%', height: 50, marginBottom: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: '#c0d0e8', fontSize: 12, padding: '8px 12px',
          resize: 'none', boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => decide('approved')} disabled={busy} style={{
          flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: '1px solid rgba(48,216,144,0.4)', background: 'rgba(20,180,120,0.14)', color: '#30d890',
          opacity: busy ? 0.5 : 1,
        }}>✓ Approve</button>
        <button onClick={() => decide('rejected')} disabled={busy} style={{
          flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: '1px solid rgba(255,90,69,0.35)', background: 'rgba(220,60,40,0.11)', color: '#ff7a6a',
          opacity: busy ? 0.5 : 1,
        }}>✗ Reject</button>
      </div>
    </div>
  );
}

// ── Main HOD Dashboard ────────────────────────────────────────────────────────
export default function HodDashboard({ user }) {
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [allRequests,   setAllRequests]   = useState([]);
  const [hodTab,        setHodTab]        = useState('requests');
  const [loadingReqs,   setLoadingReqs]   = useState(true);

  async function loadSeries() {
    try {
      const res = await fetchSeries();
      if (res.success) setSeriesConfigs(res.data);
    } catch (_) {}
  }

  async function loadRequests() {
    setLoadingReqs(true);
    try {
      const [pending, all] = await Promise.all([fetchPendingRequests(), fetchAllRequests()]);
      if (pending.success) setRequests(pending.data);
      if (all.success)     setAllRequests(all.data);
    } catch (_) {}
    finally { setLoadingReqs(false); }
  }

  useEffect(() => {
    loadSeries();
    loadRequests();
  }, []);

  async function handleDecide(id, action, reason) {
    try {
      let res;
      if (action === 'approved') res = await approveRequest(id);
      else res = await rejectRequest(id, reason);

      if (res.success) {
        if (action === 'approved') toast('✓ Approved — routine updated', '#30d890', 'rgba(48,216,144,0.4)');
        else toast('Request rejected', '#ff7a6a', 'rgba(255,90,69,0.35)');
        loadRequests();
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Action failed', '#ff7a6a', 'rgba(255,90,69,0.35)');
    }
  }

  const pendingN  = requests.length;
  const approvedN = allRequests.filter(r => r.status === 'approved').length;

  const tabBtnStyle = (k) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer',
    background: hodTab === k ? 'rgba(60,100,220,0.25)' : 'transparent',
    color: hodTab === k ? '#a8c2ff' : 'rgba(140,165,215,0.45)',
    fontWeight: hodTab === k ? 700 : 400, transition: 'all 0.15s',
  });

  const statCards = [
    ['Pending',   pendingN,                        '#f0c060', 'rgba(240,190,60,0.25)'],
    ['Approved',  approvedN,                       '#30d890', 'rgba(48,216,144,0.2)'],
    ['All Reqs',  allRequests.length,              '#a8c2ff', 'rgba(99,140,255,0.2)'],
    ['Active Ser',seriesConfigs.filter(c=>c.isActive).length, '#7fffd4', 'rgba(40,210,140,0.18)'],
  ];

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(99,140,255,0.6)', textTransform: 'uppercase', marginBottom: 6 }}>
          Head of Department · Control Panel
        </div>
        <h1 className="grad-text" style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
          ETE Routine Dashboard
        </h1>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 28 }}>
        {statCards.map(([label, val, c, bc]) => (
          <div key={label} className="stat-card" style={{ border: `1px solid ${bc}` }}>
            <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: c }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Series manager */}
      <div className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7fffd4', flexShrink: 0 }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#c0d0e8', margin: 0 }}>Series Lifecycle Management</h3>
          <button onClick={loadSeries} style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: 6,
            border: '1px solid rgba(99,140,255,0.25)',
            background: 'rgba(60,100,220,0.1)', color: '#a8c2ff',
            fontSize: 11, cursor: 'pointer',
          }}>↻ Refresh</button>
        </div>
        <SeriesManager configs={seriesConfigs} reload={loadSeries} />
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content',
      }}>
        <button style={tabBtnStyle('requests')} onClick={() => setHodTab('requests')}>
          Pending ({pendingN})
        </button>
        <button style={tabBtnStyle('history')} onClick={() => setHodTab('history')}>
          History ({allRequests.length})
        </button>
      </div>

      {/* Pending requests */}
      {hodTab === 'requests' && (
        <div>
          {loadingReqs ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(140,165,215,0.3)' }}>Loading…</div>
          ) : pendingN === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(140,165,215,0.3)', fontSize: 14 }}>
              No pending requests ✓
            </div>
          ) : (
            requests.map(req => (
              <RequestCard key={req._id} req={req} onDecide={handleDecide} />
            ))
          )}
        </div>
      )}

      {/* Request history */}
      {hodTab === 'history' && (
        <div>
          {allRequests.map(req => (
            <div key={req._id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', marginBottom: 8,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${req.status === 'approved' ? 'rgba(48,216,144,0.15)' : req.status === 'rejected' ? 'rgba(255,90,69,0.15)' : 'rgba(240,190,60,0.15)'}`,
              borderRadius: 10,
            }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#a8c2ff', width: 48 }}>
                {req.submittedBy?.slice(0,4)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#c0d0e8', fontWeight: 600 }}>{req.type.replace('_', ' ')}</div>
                <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.45)' }}>{timeSince(req.createdAt)}</div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: req.status === 'approved' ? '#30d890' : req.status === 'rejected' ? '#ff7a6a' : '#f0c060',
                background: req.status === 'approved' ? 'rgba(48,216,144,0.1)' : req.status === 'rejected' ? 'rgba(255,90,69,0.1)' : 'rgba(240,190,60,0.1)',
                border: `1px solid ${req.status === 'approved' ? 'rgba(48,216,144,0.25)' : req.status === 'rejected' ? 'rgba(255,90,69,0.25)' : 'rgba(240,190,60,0.25)'}`,
                borderRadius: 5, padding: '2px 8px',
              }}>{req.status}</div>
            </div>
          ))}
          {allRequests.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(140,165,215,0.3)', fontSize: 14 }}>
              No requests yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}