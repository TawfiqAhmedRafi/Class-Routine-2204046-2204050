export default function Nav({ user, view, setView, onLogout }) {
  if (!user) return null;
  const isStaff = ['teacher', 'hod'].includes(user.role);
  const isHod   = user.role === 'hod';

  const tabs = [
    { k: 'routine', l: 'My Routine' },
    { k: 'master',  l: 'Master Routine' },
    ...(isStaff ? [{ k: 'request', l: 'Request' }] : []),
    ...(isHod   ? [{ k: 'hod',     l: 'HOD Panel' }] : []),
  ];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(6,10,20,0.92)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <span className="mono" style={{
        fontSize: 10, letterSpacing: '0.2em',
        color: 'rgba(99,140,255,0.7)', textTransform: 'uppercase', flexShrink: 0,
      }}>
        ETE · RUET
      </span>

      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {tabs.map(t => (
          <button
            key={t.k}
            onClick={() => setView(t.k)}
            className={`nav-tab${view === t.k ? ' active' : ''}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'rgba(140,165,215,0.5)' }}>
          {user.roll || user.initials || ''} ·{' '}
          <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
        </span>
        <button
          onClick={onLogout}
          style={{
            padding: '5px 12px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: 'rgba(180,200,230,0.4)',
            fontSize: 12,
          }}
        >Sign Out</button>
      </div>
    </nav>
  );
}