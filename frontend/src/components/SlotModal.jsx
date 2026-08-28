import { useState } from 'react';
import { COLORS, TIME_PERIODS } from '../data/constants';
import { toast } from './Toast';

export default function SlotModal({ slot, onClose }) {
  const [fbOk,      setFbOk]     = useState(null);
  const [comment,   setComment]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!slot) return null;

  const c = COLORS[slot.type] || COLORS.theory;

  const spanArr = (() => {
    if (Array.isArray(slot.periodSpan)) return slot.periodSpan;
    if (typeof slot.periodSpan === 'number') {
      return Array.from({ length: slot.periodSpan }, (_, i) => slot.startPeriod + i);
    }
    return [slot.startPeriod];
  })();

  const periodLabels = spanArr.map(p => {
    const tp = TIME_PERIODS.find(t => t.period === p);
    return tp ? `P${p} (${tp.start}–${tp.end})` : `P${p}`;
  });

  const teachers = slot.teachers || slot.teacherInitials || [];

  const metaItems = [
    ['Teachers', teachers.join(', ') || '—'],
    ['Room',     slot.room?.roomLabel || slot.room || '—'],
    ['Batch',    slot.batchScope === 'all' ? 'All Sections' : slot.batchScope],
    ['Duration', spanArr.length > 1 ? `${spanArr.length} periods` : '1 period'],
  ];

  function handleSubmit() {
    if (fbOk === null) return;
    setSubmitted(true);
    toast('Feedback submitted!', 'var(--green)', 'var(--green-bdr)');
    setTimeout(onClose, 1800);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--nav-bg)',
          border: `1px solid ${c.border}`,
          borderRadius: 16, padding: 28,
          backdropFilter: 'blur(24px)',
          boxShadow: `0 0 60px ${c.bg}, 0 25px 50px rgba(0,0,0,0.6)`,
          position: 'relative',
          animation: 'fadeUp 0.2s ease forwards',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 22, lineHeight: 1,
            cursor: 'pointer',
          }}
        >×</button>

        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.12em',
          color: c.badge, textTransform: 'uppercase', marginBottom: 5,
        }}>
          {slot.type} · {slot.day}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
          {slot.courseCode}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px' }}>
          {slot.courseTitle || slot.courseName}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          {metaItems.map(([label, val]) => (
            <div key={label} style={{
              background: 'var(--surface)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, color: 'var(--text-muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
              }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>Time Slots</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {periodLabels.map(pl => (
              <span key={pl} className="mono" style={{
                fontSize: 11, color: c.text,
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 6, padding: '3px 8px',
              }}>{pl}</span>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 0 16px' }} />

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--green)', fontSize: 14, fontWeight: 600 }}>
            ✓ Feedback submitted. Thank you.
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
            }}>Is this slot okay?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { val: true,  label: '✓ Yes', activeC: 'var(--green)', activeBg: 'var(--green-bg)', activeBdr: 'var(--green-bdr)' },
                { val: false, label: '✗ No',  activeC: 'var(--red)', activeBg: 'var(--red-bg)',  activeBdr: 'var(--red-bdr)' },
              ].map(opt => {
                const isActive = fbOk === opt.val;
                return (
                  <button key={String(opt.val)} onClick={() => setFbOk(opt.val)} style={{
                    flex: 1, padding: 8, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${isActive ? opt.activeBdr : 'var(--surface-border)'}`,
                    background: isActive ? opt.activeBg : 'var(--surface)',
                    color: isActive ? opt.activeC : 'var(--text-muted)',
                    transition: 'all 0.15s', cursor: 'pointer',
                  }}>{opt.label}</button>
                );
              })}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Optional comment..."
              style={{ height: 62, marginBottom: 12 }}
            />
            <button
              onClick={handleSubmit}
              disabled={fbOk === null}
              style={{
                width: '100%', padding: 10, borderRadius: 8,
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                background: fbOk !== null ? 'var(--blue-bg)' : 'var(--surface)',
                border: `1px solid ${fbOk !== null ? 'var(--blue-bdr)' : 'var(--surface-border)'}`,
                color: fbOk !== null ? 'var(--blue)' : 'var(--text-muted)',
                cursor: fbOk !== null ? 'pointer' : 'not-allowed',
              }}
            >Submit Feedback</button>
          </div>
        )}
      </div>
    </div>
  );
}