import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function Nav({ user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = user && ["teacher", "hod"].includes(user.role);
  const isHod = user && user.role === "hod";

  // The Master Routine is always available to everyone
  const tabs = [
    { to: "/", l: "Master Routine" },
  ];

  // Dynamically push tabs based on authentication and role
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

          <div className="nav-user-area">
            {user ? (
              <>
                <span className="user-badge" style={{ fontSize: '12px', color: 'rgba(160,185,230,0.8)' }}>
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