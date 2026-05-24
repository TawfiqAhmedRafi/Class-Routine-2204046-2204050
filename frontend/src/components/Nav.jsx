import { useState } from "react";

export default function Nav({ user, view, setView, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;
  const isStaff = ["teacher", "hod"].includes(user.role);
  const isHod = user.role === "hod";

  const tabs = [
    { k: "routine", l: "My Routine" },
    { k: "master", l: "Master Routine" },
    ...(isStaff ? [{ k: "request", l: "Request" }] : []),
    ...(isHod ? [{ k: "hod", l: "HOD Panel" }] : []),
  ];

  function handleNavClick(k) {
    setView(k);
    setMobileMenuOpen(false);
  }

  return (
    <nav className="nav-container">
      <div className="nav-wrapper">
        <span className="mono nav-logo">ETE · RUET</span>

        {/* Only visible on mobile */}
        <button
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>

        {/* Desktop tabs + Mobile Menu list */}
        <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => handleNavClick(t.k)}
              className={`nav-tab ${view === t.k ? "active" : ""}`}
            >
              {t.l}
            </button>
          ))}

          {/* User info moved into the same flow for better mobile organization */}
          <div className="nav-user-area">
            <span className="user-badge">
              {user.roll || user.initials} · {user.role}
            </span>
            <button
              onClick={onLogout}
              className="sign-out-btn" // Changed to a class for better styling control
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
