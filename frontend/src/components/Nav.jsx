import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function Nav({ user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;
  const isStaff = ["teacher", "hod"].includes(user.role);
  const isHod = user.role === "hod";

  const tabs = [
    { to: "/routine", l: "My Routine" },
    { to: "/master", l: "Master Routine" },
    { to: "/teacher-routine", l: "Teacher Routine" },
    ...(isStaff ? [{ to: "/request", l: "Request" }] : []),
    ...(isHod ? [{ to: "/hod", l: "HOD Panel" }] : []),
  ];

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
            <span className="user-badge" style={{ fontSize: '12px', color: 'rgba(160,185,230,0.8)' }}>
              {user.roll || user.initials} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
            </span>
            <button onClick={onLogout} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}