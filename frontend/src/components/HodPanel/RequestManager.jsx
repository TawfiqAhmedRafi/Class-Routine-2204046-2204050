import { useState } from 'react';

function timeSince(iso) {
  const time = new Date(iso).getTime();
  if (!iso || Number.isNaN(time)) return '';
  const d = Date.now() - time;
  const h = Math.floor(d / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

const statusColor = (status) =>
  status === 'approved' ? '#30d890' : status === 'rejected' ? '#ff7a6a' : '#a8c2ff';

export default function RequestManager({ requests = [], allRequests = [], onDecide = () => {} }) {
  const [view, setView] = useState('pending');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView('pending')} style={{ padding: '6px 12px', borderRadius: 8, background: view === 'pending' ? 'rgba(60,100,220,0.25)' : 'transparent', border: 'none', color: view === 'pending' ? '#a8c2ff' : '#aaa', cursor: 'pointer' }}>Pending ({requests.length})</button>
        <button onClick={() => setView('history')} style={{ padding: '6px 12px', borderRadius: 8, background: view === 'history' ? 'rgba(60,100,220,0.25)' : 'transparent', border: 'none', color: view === 'history' ? '#a8c2ff' : '#aaa', cursor: 'pointer' }}>History ({allRequests.length})</button>
      </div>
      {view === 'pending' && (
        <div>{requests.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>No pending requests</div> : requests.map(r => (
          <div key={r._id} className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{r.submittedBy}</div>
                <div className="mono" style={{ fontSize: 10, color: '#a8c2ff' }}>{r.type.replace('_', ' ')}</div>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.4)' }}>{timeSince(r.createdAt)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onDecide(r._id, 'approved', '')} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(48,216,144,0.4)', background: 'rgba(20,180,120,0.14)', color: '#30d890', cursor: 'pointer' }}>Approve</button>
              <button onClick={() => onDecide(r._id, 'rejected', '')} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(255,90,69,0.35)', background: 'rgba(220,60,40,0.11)', color: '#ff7a6a', cursor: 'pointer' }}>Reject</button>
            </div>
          </div>
        ))}</div>
      )}
      {view === 'history' && (
        <div className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
          {allRequests.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>No history yet</div>
            : allRequests.map(req => (
              <div key={req._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div><span style={{ color: '#a8c2ff', fontWeight: 700 }}>{req.submittedBy}</span> · {req.type.replace('_', ' ')}</div>
                <div style={{ color: statusColor(req.status), fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{req.status}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}