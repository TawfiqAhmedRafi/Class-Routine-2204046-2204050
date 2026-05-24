import { useState, useEffect, useCallback } from 'react';

let _setToast = null;

export function toast(msg, color = '#a8c2ff', border = 'rgba(99,140,255,0.4)') {
  if (_setToast) _setToast({ msg, color, border, id: Date.now() });
}

export default function Toast() {
  const [state, setState] = useState(null);

  useEffect(() => {
    _setToast = setState;
    return () => { _setToast = null; };
  }, []);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(null), 3000);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(12,15,25,0.96)', border: `1px solid ${state.border}`,
      color: state.color, padding: '12px 24px', borderRadius: 10,
      fontSize: 13, fontWeight: 700, backdropFilter: 'blur(16px)',
      zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap',
      animation: 'fadeUp 0.25s ease forwards',
    }}>
      {state.msg}
    </div>
  );
}
