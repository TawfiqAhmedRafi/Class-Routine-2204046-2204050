import { useState } from 'react';

export default function Nav({ user, view, setView, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (!user) return null;
  const isStaff = ['teacher', 'hod'].includes(user.role);
  const isHod   = user.role === 'hod';

  const tabs = [
    { k: 'routine', l: 'My Routine' },
    { k: 'master',  l: 'Master Routine' },
    ...(isStaff ? [{ k: 'request', l: 'Request' }] : []),
    ...(isHod   ? [{ k: 'hod',     l: 'HOD Panel' }] : []),
  ];

  function handleNavClick(k) {
    setView(k);
    setMobileMenuOpen(false); // Close menu on click
  }

  return (
    <nav className="nav-container">
      {/* Logo Area */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(99,140,255,0.7)', textTransform: 'uppercase' }}>
          ETE · RUET
        </span>
        
        {/* Mobile Toggle Button */}
        <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Tabs - Conditionally shown based on mobileMenuOpen */}
      <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
        {tabs.map(t => (
          <button
            key={t.k}
            onClick={() => handleNavClick(t.k)}
            className={`nav-tab${view === t.k ? ' active' : ''}`}
          >
            {t.l}
          </button>
        ))}
        
        {/* User Info & Logout (Moved inside nav-links for mobile) */}
        <div className="mobile-user-info">
          <span style={{ fontSize: 12, color: 'rgba(140,165,215,0.5)' }}>
            {user.roll || user.initials || ''} · {user.role}
          </span>
          <button onClick={onLogout} className="sign-out-btn">Sign Out</button>
        </div>
      </div>
    </nav>
  );
}