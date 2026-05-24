import { useState, useEffect, useMemo } from 'react';
import { fetchMasterRoutine } from '../services/api';
import { DAYS, TIME_PERIODS, NUM_PERIODS, COLORS } from '../data/constants';
import SlotModal from '../components/SlotModal';
import { toast } from '../components/Toast';

// Series label colors to distinguish series rows visually
const SERIES_COLORS = [
  { accent: '#a8c2ff', bg: 'rgba(60,100,220,0.12)',  border: 'rgba(99,140,255,0.22)'  },
  { accent: '#7fffd4', bg: 'rgba(20,180,120,0.10)',  border: 'rgba(40,210,140,0.22)'  },
  { accent: '#f0c060', bg: 'rgba(240,190,60,0.10)',  border: 'rgba(240,190,60,0.22)'  },
  { accent: '#ddb8ff', bg: 'rgba(160,80,220,0.10)',  border: 'rgba(200,120,255,0.22)' },
  { accent: '#ffb0a8', bg: 'rgba(220,80,60,0.10)',   border: 'rgba(255,110,90,0.22)'  },
];

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
      const span    = slot.periodSpan;
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

function MiniSlotCell({ slot, onClick }) {
  if (!slot) return (
    <div style={{
      height: 44, borderRadius: 6,
      background: 'rgba(255,255,255,0.01)',
      border: '1px dashed rgba(255,255,255,0.04)',
    }} />
  );

  const c = COLORS[slot.type] || COLORS.theory;

  // --- Room Formatting Logic ---
  const rawRoom = slot.room?.roomLabel || slot.room || '';
  let formattedRoom = '';

  if (rawRoom) {
    const lower = rawRoom.toLowerCase();
    if (lower.includes('seminar')) {
      formattedRoom = 'Seminar';
    } else if (lower.includes('lab')) {
      const words = rawRoom.split(/[\s-]+/).filter(Boolean);
      formattedRoom = words.length >= 2 
        ? (words[0][0] + words[1][0]).toUpperCase()
        : rawRoom.substring(0, 2).toUpperCase();
    } else {
      const match = rawRoom.match(/^(?:R|Room)?\s*(\d+[A-Z]?)/i);
      formattedRoom = match ? match[1] : rawRoom;
    }
  }

  return (
    <button
      onClick={() => onClick(slot)}
      style={{
        width: '100%', height: '100%', minHeight: 44,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 6, padding: '5px 7px',
        cursor: 'pointer', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 2,
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {/* Header Row: Type Badge + Room Number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: c.badge,
        }}>
          {slot.type}
        </div>
        
        {formattedRoom && (
          <div className="mono" style={{
            fontSize: 8, fontWeight: 600, color: 'rgba(150,170,210,0.7)',
            background: 'rgba(255,255,255,0.05)', padding: '1px 3px', 
            borderRadius: 3, letterSpacing: '0.04em'
          }}>
            {formattedRoom}
          </div>
        )}
      </div>

      <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: c.text }}>
        {slot.courseCode}
      </div>
      <div style={{ fontSize: 8, color: 'rgba(180,200,230,0.6)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {(slot.teachers || slot.teacherInitials || []).join(', ')}
      </div>
    </button>
  );
}

function SeriesGrid({ cfg, slots, seriesColor, modal, setModal }) {
  const grid = useMemo(() => buildGrid(slots), [slots]);

  return (
    <div style={{
      marginBottom: 28,
      border: `1px solid ${seriesColor.border}`,
      borderRadius: 14, overflow: 'hidden',
      background: 'rgba(255,255,255,0.008)',
    }}>
      {/* Series header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 18px',
        background: seriesColor.bg,
        borderBottom: `1px solid ${seriesColor.border}`,
      }}>
        <div className="mono" style={{
          fontSize: 22, fontWeight: 800, color: seriesColor.accent,
          lineHeight: 1,
        }}>{cfg.series}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cfg.currentSemester} semester · {slots.length} slot{slots.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {Object.entries(
            slots.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {})
          ).map(([type, count]) => (
            <div key={type} style={{
              fontSize: 10, fontWeight: 700,
              color: COLORS[type]?.badge || '#aaa',
              background: COLORS[type]?.bg || 'rgba(255,255,255,0.04)',
              border: `1px solid ${COLORS[type]?.border || 'rgba(255,255,255,0.1)'}`,
              borderRadius: 5, padding: '2px 8px', textTransform: 'capitalize',
            }}>{count} {type}</div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 14px', textAlign: 'left', fontSize: 9,
                color: 'rgba(140,165,215,0.4)', textTransform: 'uppercase',
                letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.015)', width: 52,
              }}>Day</th>
              {TIME_PERIODS.map(tp => (
                <th key={tp.period} style={{
                  padding: tp.isBreak ? '6px 3px' : '8px 4px',
                  textAlign: 'center', fontSize: tp.isBreak ? 7 : 9,
                  color: tp.isBreak ? 'rgba(255,200,80,0.4)' : 'rgba(140,165,215,0.5)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: tp.isBreak ? 'rgba(255,200,80,0.02)' : 'rgba(255,255,255,0.01)',
                  minWidth: tp.isBreak ? 32 : 78,
                  borderLeft: '1px solid rgba(255,255,255,0.03)',
                }}>
                  {tp.isBreak
                    ? <span style={{ writingMode: 'vertical-rl', fontSize: 7 }}>{tp.label}</span>
                    : <>
                        <div className="mono" style={{ fontSize: 10 }}>P{tp.period}</div>
                        <div style={{ fontSize: 7, color: 'rgba(110,135,190,0.4)' }}>{tp.start}</div>
                      </>
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => {
              const consumed = {};
              return (
                <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{
                    padding: '6px 14px', fontSize: 10, fontWeight: 700,
                    color: seriesColor.accent,
                    background: 'rgba(255,255,255,0.01)',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.04em',
                  }}>
                    {day.slice(0,3).toUpperCase()}
                  </td>
                  {TIME_PERIODS.map(tp => {
                    if (tp.isBreak) {
                      return (
                        <td key={tp.period} style={{
                          background: 'rgba(255,200,80,0.02)',
                          borderLeft: '1px solid rgba(255,255,255,0.03)',
                          minWidth: 32,
                        }} />
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
                        padding: 4, verticalAlign: 'top',
                        borderLeft: '1px solid rgba(255,255,255,0.03)',
                      }}>
                        <MiniSlotCell slot={slot} onClick={setModal} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MasterRoutine({ user }) {
  const [data,         setData]         = useState({});
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [batch,        setBatch]        = useState('all');
  const [modal,        setModal]        = useState(null);

  function load(b = batch) {
    setLoading(true);
    setError(null);
    fetchMasterRoutine(b)
      .then(res => {
        if (res.success) {
          setData(res.data);
          setSeriesConfigs(res.seriesConfigs || []);
        }
      })
      .catch(err => {
        setError(err?.response?.data?.message || 'Failed to load master routine');
        toast('Failed to load master routine', '#ff7a6a', 'rgba(255,90,69,0.35)');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleBatch(b) {
    setBatch(b);
    load(b);
  }

  // Summary stats across all series
  const totalSlots = Object.values(data).reduce((sum, d) => sum + (d.slots?.length || 0), 0);
  const totalLabs  = Object.values(data).reduce((sum, d) => sum + (d.slots?.filter(s => s.type === 'lab').length || 0), 0);

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px' }} className="fade-up">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.2em',
          color: 'rgba(99,140,255,0.65)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          Master Overview · All Active Series
        </div>
        <h1 className="grad-text" style={{
          fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          ETE Department · Full Routine
        </h1>
        <p style={{ color: 'rgba(140,165,215,0.5)', fontSize: 13, margin: '4px 0 0' }}>
          {seriesConfigs.length} active series · {totalSlots} total slots · {totalLabs} labs
          {loading && <span style={{ marginLeft: 12, color: 'rgba(99,140,255,0.5)', fontSize: 11 }}>⟳ Loading…</span>}
        </p>
      </div>

      {/* Batch filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batch Filter</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[{k:'all',l:'All'},{k:'1st30',l:'1st 30'},{k:'2nd30',l:'2nd 30'}].map(b => (
              <button key={b.k} onClick={() => handleBatch(b.k)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: batch === b.k ? 'rgba(240,190,60,0.2)' : 'transparent',
                color: batch === b.k ? '#f0c060' : 'rgba(150,170,210,0.5)',
                fontSize: 12, fontWeight: batch === b.k ? 700 : 400, transition: 'all 0.15s',
              }}>{b.l}</button>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          {[
            ['Series', seriesConfigs.length, '#a8c2ff'],
            ['Slots', totalSlots, '#7fffd4'],
            ['Labs', totalLabs, '#f0c060'],
          ].map(([label, val, color]) => (
            <div key={label} style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, textAlign: 'center',
            }}>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 9, color: 'rgba(140,165,215,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Day column guide */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap',
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            padding: '4px 10px', borderRadius: 5,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, color: 'rgba(160,180,220,0.6)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{d}</div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {Object.entries(COLORS).map(([type, c]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.badge, opacity: 0.85 }} />
              <span style={{ fontSize: 10, color: 'rgba(150,170,210,0.6)', textTransform: 'capitalize' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', marginBottom: 16,
          background: 'rgba(220,60,40,0.08)', border: '1px solid rgba(255,90,69,0.25)',
          borderRadius: 10, color: '#ff8070', fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{
              height: 220, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)',
              animation: 'shimmer 1.5s ease infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      )}

      {/* Series grids */}
      {!loading && seriesConfigs
        .filter(c => c.isActive)
        .sort((a,b) => b.series - a.series)
        .map((cfg, idx) => {
          const seriesData = data[cfg.series];
          if (!seriesData) return null;
          return (
            <SeriesGrid
              key={cfg.series}
              cfg={cfg}
              slots={seriesData.slots || []}
              seriesColor={SERIES_COLORS[idx % SERIES_COLORS.length]}
              modal={modal}
              setModal={setModal}
            />
          );
        })
      }

      {!loading && seriesConfigs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          color: 'rgba(140,165,215,0.3)', fontSize: 14,
        }}>
          No active series found. Add series from the HOD Panel.
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 12, padding: '12px 16px',
        background: 'rgba(255,200,80,0.05)', border: '1px solid rgba(255,200,80,0.14)',
        borderRadius: 10, fontSize: 11, color: 'rgba(220,185,80,0.65)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'rgba(240,200,100,0.85)' }}>Master Routine:</strong>{' '}
        Shows all active series simultaneously. Each series uses its current HOD-configured semester.
        Click any slot to view details. Use the Batch filter to see specific group schedules.
      </div>

      {modal && <SlotModal slot={modal} onClose={() => setModal(null)} />}
    </div>
  );
}