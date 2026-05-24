import { useState, useMemo, useEffect } from 'react';
import SlotCard  from '../components/SlotCard';
import SlotModal from '../components/SlotModal';
import { fetchRoutine, fetchSeries } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import { toast } from '../components/Toast';

function buildGrid(slots) {
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    NUM_PERIODS.forEach(p => { grid[d][p] = null; });
  });
  const consumed = {};
  slots.forEach(slot => {
    const key = `${slot.day}-${slot.startPeriod}`;
    if (!consumed[key]) {
      // Build periodSpan array from startPeriod + periodSpan count (backend stores count, not array)
      const span = slot.periodSpan;
      const spanArr = typeof span === 'number'
        ? Array.from({ length: span }, (_, i) => slot.startPeriod + i)
        : (Array.isArray(span) ? span : [slot.startPeriod]);

      const normalized = { ...slot, periodSpan: spanArr };
      if (grid[slot.day]) grid[slot.day][slot.startPeriod] = normalized;
      spanArr.slice(1).forEach(p => {
        consumed[`${slot.day}-${p}`] = slot._id;
        if (grid[slot.day]) grid[slot.day][p] = 'CONSUMED';
      });
    }
  });
  return grid;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          height: 72, borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          animation: 'shimmer 1.5s ease infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );
}

export default function RoutineView({ user }) {
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [slots,   setSlots]   = useState([]);
  const [series,  setSeries]  = useState(user.series || 22);
  const [sem,     setSem]     = useState('even');
  const [batch,   setBatch]   = useState(user.batch || 'all');
  const [modal,   setModal]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const isStaff  = ['teacher', 'hod'].includes(user.role);

  // Load series configs on mount
  useEffect(() => {
    fetchSeries()
      .then(res => {
        if (res.success) {
          setSeriesConfigs(res.data);
          const cfg = res.data.find(c => c.series === series);
          if (cfg) setSem(cfg.currentSemester);
        }
      })
      .catch(() => {});
  }, [series]);

  // Load slots whenever series or batch changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRoutine(series, batch)
      .then(res => {
        if (res.success) {
          setSlots(res.data);
          setSem(res.semester);
        }
      })
      .catch(err => {
        setError(err?.response?.data?.message || 'Failed to load routine');
        toast('Failed to load routine', '#ff7a6a', 'rgba(255,90,69,0.35)');
      })
      .finally(() => setLoading(false));
  }, [series, batch]);

  const grid = useMemo(() => buildGrid(slots), [slots]);

  const activeSeries = seriesConfigs.filter(c => c.isActive).map(c => c.series).sort((a,b)=>b-a);

  function renderRow(day) {
    const consumed = {};
    return TIME_PERIODS.map(tp => {
      if (tp.isBreak) {
        return (
          <td key={tp.period} style={{
            background: 'rgba(255,200,80,0.025)',
            borderLeft: '1px solid rgba(255,255,255,0.04)',
            textAlign: 'center', padding: '4px 2px',
          }}>
            <span style={{
              fontSize: 8, color: 'rgba(255,200,80,0.3)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
              writingMode: 'vertical-rl',
            }}>{tp.label}</span>
          </td>
        );
      }
      if (consumed[tp.period]) return null;
      const slotVal = grid[day]?.[tp.period];
      if (slotVal === 'CONSUMED') return null;
      const slot    = slotVal || null;
      const colSpan = slot ? (slot.periodSpan?.length || 1) : 1;
      if (slot) {
        (slot.periodSpan || []).slice(1).forEach(p => { consumed[p] = true; });
      }
      return (
        <td key={tp.period} colSpan={colSpan} style={{
          padding: 5, verticalAlign: 'top',
          borderLeft: '1px solid rgba(255,255,255,0.04)',
        }}>
          {slot
            ? <SlotCard slot={slot} onClick={setModal} />
            : <div style={{
                height: 58, borderRadius: 8,
                background: 'rgba(255,255,255,0.012)',
                border: '1px dashed rgba(255,255,255,0.05)',
              }} />
          }
        </td>
      );
    });
  }

  const thCells = TIME_PERIODS.map(tp => (
    <th key={tp.period} style={{
      padding: tp.isBreak ? '8px 4px' : '14px 6px',
      textAlign: 'center',
      fontSize: tp.isBreak ? 8 : 10,
      color: tp.isBreak ? 'rgba(255,200,80,0.5)' : 'rgba(140,165,215,0.6)',
      fontWeight: 600,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: tp.isBreak ? 'rgba(255,200,80,0.03)' : 'rgba(255,255,255,0.02)',
      minWidth: tp.isBreak ? 44 : 98,
      borderLeft: '1px solid rgba(255,255,255,0.04)',
    }}>
      {tp.isBreak
        ? <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tp.label}</span>
        : <>
            <div className="mono" style={{ fontSize: 13, color: 'rgba(160,185,230,0.8)', marginBottom: 1 }}>P{tp.period}</div>
            <div style={{ fontSize: 9, color: 'rgba(110,135,190,0.5)' }}>{tp.start}</div>
            <div style={{ fontSize: 9, color: 'rgba(110,135,190,0.35)' }}>{tp.end}</div>
          </>
      }
    </th>
  ));

  const batchActive = (k) => batch === k;
  function batchStyle(k) {
    return {
      padding: '5px 12px', borderRadius: 6, border: 'none',
      background: batchActive(k) ? 'rgba(240,190,60,0.2)' : 'transparent',
      color: batchActive(k) ? '#f0c060' : 'rgba(150,170,210,0.5)',
      fontSize: 12, fontWeight: batchActive(k) ? 700 : 400,
      cursor: 'pointer',
    };
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.2em',
          color: 'rgba(99,140,255,0.65)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          Rajshahi University of Engineering &amp; Technology
        </div>
        <h1 className="grad-text" style={{
          fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          ETE Department · Class Routine
        </h1>
        <p style={{ color: 'rgba(140,165,215,0.5)', fontSize: 13, margin: '4px 0 0' }}>
          Series {series} · {sem.charAt(0).toUpperCase() + sem.slice(1)} Semester
          {loading && <span style={{ marginLeft: 12, color: 'rgba(99,140,255,0.5)', fontSize: 11 }}>⟳ Loading…</span>}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Series</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {activeSeries.map(s => (
              <button key={s} onClick={() => setSeries(s)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                border: series === s ? '1px solid rgba(99,140,255,0.6)' : '1px solid rgba(255,255,255,0.08)',
                background: series === s ? 'rgba(60,100,220,0.2)' : 'rgba(255,255,255,0.03)',
                color: series === s ? '#a8c2ff' : 'rgba(150,170,210,0.5)',
                fontWeight: series === s ? 700 : 400,
                fontFamily: 'JetBrains Mono, monospace',
              }}>'{String(s).slice(-2)}</button>
            ))}
          </div>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sem</span>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
              {['even','odd'].map(s => (
                <button key={s} onClick={() => setSem(s)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: sem === s ? 'rgba(60,100,220,0.3)' : 'transparent',
                  color: sem === s ? '#a8c2ff' : 'rgba(150,170,210,0.5)',
                  fontSize: 12, fontWeight: sem === s ? 700 : 400, textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: isStaff ? 'auto' : undefined }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batch</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[{k:'all',l:'All'},{k:'1st30',l:'1st 30'},{k:'2nd30',l:'2nd 30'}].map(b => (
              <button key={b.k} onClick={() => setBatch(b.k)} style={batchStyle(b.k)}>{b.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([type, c]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c.badge, opacity: 0.85 }} />
            <span style={{ fontSize: 11, color: 'rgba(150,170,210,0.65)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', marginBottom: 16,
          background: 'rgba(220,60,40,0.08)', border: '1px solid rgba(255,90,69,0.25)',
          borderRadius: 10, color: '#ff8070', fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* Table */}
      {loading ? <Skeleton /> : (
        <div style={{
          overflowX: 'auto', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.012)',
          backdropFilter: 'blur(20px)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: 10, letterSpacing: '0.12em',
                  color: 'rgba(140,165,215,0.45)', textTransform: 'uppercase',
                  fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)', width: 72,
                }}>Day</th>
                {thCells}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{
                    padding: '10px 16px', fontSize: 12, fontWeight: 700,
                    color: 'rgba(160,185,230,0.8)',
                    background: 'rgba(255,255,255,0.015)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.04em',
                  }}>
                    {day.slice(0,3).toUpperCase()}
                  </td>
                  {renderRow(day)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 18, padding: '12px 16px',
        background: 'rgba(255,200,80,0.05)', border: '1px solid rgba(255,200,80,0.14)',
        borderRadius: 10, fontSize: 11, color: 'rgba(220,185,80,0.65)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'rgba(240,200,100,0.85)' }}>Note:</strong>{' '}
        P&amp;LB = Prayer &amp; Lunch Break (1:20–2:30). Break (10:30–10:50).
        Multi-period labs span merged columns. Use the <strong style={{ color: '#f0c060' }}>Batch</strong> toggle to separate 1st 30 / 2nd 30 lab groups.
        Click any slot to view details.
      </div>

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}