import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Nav           from './components/Nav';
import Toast         from './components/Toast';
import Home          from './pages/Home';
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
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/routine" replace />;
  return children;
}

function AppContent() {
  // Initialize user from localStorage to persist sessions
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('ete_user')) || null);
  const navigate = useNavigate();

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem('ete_user', JSON.stringify(u));
    navigate('/routine');
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem('ete_user');
    navigate('/login');
  }

  return (
    <>
      <div className="ambient-glow" />

      {user && <Nav user={user} onLogout={handleLogout} />}

      <Routes>
        <Route path="/" element={<Home />} />
        
        <Route path="/login" element={
          !user ? <Login onLogin={handleLogin} /> : <Navigate to="/routine" replace />
        } />
        
        <Route path="/routine" element={
          <ProtectedRoute user={user}><RoutineView user={user} /></ProtectedRoute>
        } />
        
        <Route path="/master" element={
          <ProtectedRoute user={user}><MasterRoutine user={user} /></ProtectedRoute>
        } />

        <Route path="/teacher-routine" element={
          <ProtectedRoute user={user}><TeacherRoutine user={user} /></ProtectedRoute>
        } />

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