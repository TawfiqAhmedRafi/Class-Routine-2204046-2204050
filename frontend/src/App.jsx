import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Nav           from './components/Nav';
import Toast         from './components/Toast';
import Login         from './pages/Login';
import RoutineView   from './pages/RoutineView';
import RequestPanel  from './pages/RequestPanel';
import HodDashboard  from './pages/HodDashboard';
import MasterRoutine from './pages/MasterRoutine';
import TeacherRoutine from './pages/TeacherRoutine';
import './styles/global.css';

// Protected Route Wrapper
function ProtectedRoute({ user, children, allowedRoles }) {
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  // Initialize user from localStorage to persist sessions
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('ete_user')) || null);
  const navigate = useNavigate();

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem('ete_user', JSON.stringify(u));
    navigate('/my-routine'); // Route users directly to their personal routine on login
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem('ete_user');
    navigate('/'); // Route back to public Master Routine on logout
  }

  return (
    <>
      <div className="ambient-glow" />

      {/* Nav is rendered unconditionally so public users can see the Login button */}
      <Nav user={user} onLogout={handleLogout} />

      <Routes>
        {/* Public Homepage: Master Routine */}
        <Route path="/" element={<MasterRoutine user={user} />} />
        
        <Route path="/login" element={
          !user ? <Login onLogin={handleLogin} /> : <Navigate to="/my-routine" replace />
        } />
        
        {/* Smart "My Routine" Route */}
        <Route path="/my-routine" element={
          <ProtectedRoute user={user}>
            {user?.role === 'student' ? <RoutineView user={user} /> : <TeacherRoutine user={user} />}
          </ProtectedRoute>
        } />
        
        {/* Cross-Role Lookup Routes */}
        <Route path="/class-routines" element={
          <ProtectedRoute user={user} allowedRoles={['teacher', 'hod']}>
            <RoutineView user={user} />
          </ProtectedRoute>
        } />

        <Route path="/teachers" element={
          <ProtectedRoute user={user} allowedRoles={['student']}>
            <TeacherRoutine user={user} />
          </ProtectedRoute>
        } />

        {/* Action Panels */}
        <Route path="/request" element={
          <ProtectedRoute user={user} allowedRoles={['teacher', 'hod']}>
            <RequestPanel user={user} />
          </ProtectedRoute>
        } />

        <Route path="/hod" element={
          <ProtectedRoute user={user} allowedRoles={['hod']}>
            <HodDashboard user={user} />
          </ProtectedRoute>
        } />
      </Routes>

      <Toast />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}