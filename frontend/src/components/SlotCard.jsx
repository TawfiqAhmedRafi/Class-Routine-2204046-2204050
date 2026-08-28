import { COLORS } from '../data/constants';

export default function SlotCard({ slot, onClick }) {
  const c = COLORS[slot.type] || COLORS.theory;
  const labLen = slot.periodSpan?.length || 1;

  const rawRoom = slot.room?.roomLabel || slot.room || '';
  let formattedRoom = '';

  if (rawRoom) {
    const lower = rawRoom.toLowerCase();
    if (lower.includes('seminar')) {
      formattedRoom = 'Seminar';
    } else if (lower.includes('computer')) {
      formattedRoom = 'CmL';
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
      onClick={() => onClick && onClick(slot)}
      style={{
        width: '100%', height: '100%', textAlign: 'left',
        position: 'relative', overflow: 'hidden',
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: '8px 10px',
        cursor: 'pointer', minHeight: labLen > 1 ? 70 : 58,
        transition: 'opacity 0.15s, transform 0.12s',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg,transparent,${c.border},transparent)`,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: c.badge,
          background: c.bg, border: `1px solid ${c.border}`,
          borderRadius: 4, padding: '1px 5px',
        }}>
          {slot.type}{labLen > 1 ? ` ×${labLen}` : ''}
        </span>
        
        {formattedRoom && (
          <span className="mono" style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.04em', background: 'var(--surface)',
            padding: '1px 4px', borderRadius: 4,
          }}>
            {formattedRoom}
          </span>
        )}
      </div>

      <div className="mono" style={{
        fontSize: 11, fontWeight: 700,
        color: c.text, letterSpacing: '0.03em',
        marginTop: 2,
      }}>
        {slot.courseCode}
      </div>

      <div style={{
        fontSize: 10, color: 'var(--text)',
        lineHeight: 1.3, flex: 1,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {slot.courseTitle}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
        {(slot.teacherInitials || []).map(t => (
          <span key={t} className="mono" style={{
            fontSize: 9, fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--surface-border)',
            borderRadius: 3, padding: '1px 4px',
          }}>{t}</span>
        ))}
        {slot.batchScope !== 'all' && (
          <span style={{
            fontSize: 9, fontWeight: 600, color: 'var(--gold)',
            background: 'var(--gold-bg)',
            borderRadius: 3, padding: '1px 4px',
          }}>{slot.batchScope}</span>
        )}
      </div>
    </button>
  );
}