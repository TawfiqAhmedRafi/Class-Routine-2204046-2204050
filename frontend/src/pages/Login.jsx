import { useState } from 'react';
import { authStudent, authStaff } from '../services/api';
import { toast } from '../components/Toast';

export default function Login({ onLogin }) {
  const [tab,     setTab]     = useState('student');
  const [roll,    setRoll]    = useState('');
  const [reg,     setReg]     = useState('');
  const [init,    setInit]    = useState('');
  const [pw,      setPw]      = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    setError('');
    setLoading(true);
    try {
      let res;
      if (tab === 'student') {
        res = await authStudent(roll.trim(), reg.trim());
      } else {
        res = await authStaff(init.trim().toUpperCase(), pw);
      }
      if (res.success) {
        toast(`Welcome, ${res.user.displayName || res.user.name || res.user.initials}`, '#30d890', 'rgba(48,216,144,0.4)');
        onLogin(res.user);
      } else {
        setError(res.message || 'Login failed.');
      }
    } catch (err) {
     const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
  setError(
    isTimeout
      ? 'Server is waking up, please wait 30 seconds and try again.'
      : err?.response?.data?.message || 'Server error. Is the backend running?'
  );
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) { if (e.key === 'Enter') doLogin(); }

  const inputStyle = {
    width: '100%', padding: '11px 14px', marginBottom: 14,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#d0dcf0', fontSize: 13, outline: 'none',
  };
  const monoInput = { ...inputStyle, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, position: 'relative', zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="fade-up">
        <div className="glass" style={{ borderRadius: 20, padding: '36px 32px', position: 'relative' }}>

          <div style={{
            position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(99,140,255,0.4),transparent)',
          }} />

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: '0.25em',
              color: 'rgba(99,140,255,0.5)', textTransform: 'uppercase', marginBottom: 8,
            }}>
              RUET · ETE Department
            </div>
            <h1 className="grad-text" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              Class Routine
            </h1>
            <p style={{ color: 'rgba(140,165,215,0.4)', fontSize: 12, margin: '6px 0 0' }}>
              Online Schedule System
            </p>
          </div>

          <div className="toggle-group" style={{ marginBottom: 24 }}>
            {[['student','Student'],['teacher','Teacher / HOD']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => { setTab(k); setError(''); }}
                className={`toggle-btn${tab === k ? ' active' : ''}`}
                style={{ flex: 1 }}
              >{l}</button>
            ))}
          </div>

          {tab === 'student' ? (
            <>
              <label className="field-label">Roll Number</label>
              <input style={monoInput} placeholder="e.g. 22040XX" value={roll}
                onChange={e => setRoll(e.target.value)} onKeyDown={handleKey} />
              <label className="field-label">Registration</label>
              <input style={inputStyle} type="number" placeholder="e.g. 724+XX" value={reg}
                onChange={e => setReg(e.target.value)} onKeyDown={handleKey} />
            </>
          ) : (
            <>
              <label className="field-label">Teacher Initials</label>
              <input style={monoInput} placeholder="e.g. MFS" value={init}
                onChange={e => setInit(e.target.value)} onKeyDown={handleKey} />
              <label className="field-label">Password</label>
              <input style={inputStyle} type="password" placeholder="••••••••" value={pw}
                onChange={e => setPw(e.target.value)} onKeyDown={handleKey} />
            </>
          )}

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(220,60,40,0.1)', border: '1px solid rgba(255,90,69,0.3)',
              borderRadius: 8, color: '#ff8070', fontSize: 12, marginBottom: 14,
            }}>{error}</div>
          )}

          <button
            onClick={doLogin}
            disabled={loading}
            style={{
              width: '100%', padding: 13, borderRadius: 10,
              border: '1px solid rgba(99,140,255,0.4)',
              background: loading ? 'rgba(50,90,200,0.1)' : 'rgba(50,90,200,0.22)',
              color: loading ? 'rgba(168,194,255,0.5)' : '#a8c2ff',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >{loading ? 'Signing in…' : 'Sign In →'}</button>

          <div style={{
            marginTop: 16, padding: 12,
            background: 'rgba(240,190,60,0.06)', border: '1px solid rgba(240,190,60,0.15)',
            borderRadius: 8, fontSize: 11, color: 'rgba(200,170,80,0.75)', lineHeight: 1.7,
          }}>
            
            Roll <span className="mono">"2204001"</span> → Reg <span className="mono">"724"</span> <br />
            Initials <span className="mono">"MFS"</span> → Pass <span className="mono">"1234"</span> <br />
            
          </div>
        </div>
      </div>
    </div>
  );
}