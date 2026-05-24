import { useState } from 'react';
import Nav           from './components/Nav';
import Toast         from './components/Toast';
import Login         from './pages/Login';
import RoutineView   from './pages/RoutineView';
import RequestPanel  from './pages/RequestPanel';
import HodDashboard  from './pages/HodDashboard';
import MasterRoutine from './pages/MasterRoutine';
import './styles/global.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');

  function handleLogin(u) {
    setUser(u);
    setView('routine');
  }

  function handleLogout() {
    setUser(null);
    setView('login');
  }

  return (
    <>
      <div className="ambient-glow" />

      {user && (
        <Nav
          user={user}
          view={view}
          setView={setView}
          onLogout={handleLogout}
        />
      )}

      {view === 'login' && <Login onLogin={handleLogin} />}

      {view === 'routine' && user && <RoutineView user={user} />}

      {view === 'master' && user && <MasterRoutine user={user} />}

      {view === 'request' && user && ['teacher','hod'].includes(user.role) && (
        <RequestPanel user={user} />
      )}

      {view === 'hod' && user?.role === 'hod' && (
        <HodDashboard user={user} />
      )}

      <Toast />
    </>
  );
}