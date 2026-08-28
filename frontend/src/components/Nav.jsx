import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function Nav({ user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isStaff = user && ["teacher", "hod"].includes(user.role);
  const isHod = user && user.role === "hod";

  const tabs = [
    { to: "/", l: "Master Routine" },
  ];

  if (user) {
    tabs.push({ to: "/my-routine", l: "My Routine" });
    
    if (user.role === 'student') {
      tabs.push({ to: "/teachers", l: "Teacher Routines" });
    } else if (isStaff) {
      tabs.push({ to: "/class-routines", l: "Class Routines" });
      tabs.push({ to: "/request", l: "Requests" });
    }
    
    if (isHod) {
      tabs.push({ to: "/hod", l: "HOD Panel" });
    }
  }

  return (
    <nav className="nav-container">
      <div className="nav-wrapper">
        <span className="mono nav-logo">ETE · RUET</span>

        <button
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>

        <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
            >
              {t.l}
            </NavLink>
          ))}
          
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--surface-border)', 
              borderRadius: '8px',
              padding: '6px 12px',
              color: 'var(--text)',
              marginLeft: '8px',
              transition: 'all 0.2s ease'
            }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div className="nav-user-area">
            {user ? (
              <>
                <span className="user-badge" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {user.roll || user.initials} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
                </span>
                <button onClick={onLogout} className="sign-out-btn">
                  Sign Out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="sign-out-btn" style={{ textDecoration: 'none' }}>
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}