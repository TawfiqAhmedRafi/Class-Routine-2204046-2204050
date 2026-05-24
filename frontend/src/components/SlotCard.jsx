import { COLORS } from '../data/constants';

export default function SlotCard({ slot, onClick }) {
  const c = COLORS[slot.type] || COLORS.theory;
  const labLen = slot.periodSpan?.length || 1;

  // Format the room based on type
  const rawRoom = slot.room?.roomLabel || slot.room || '';
  let formattedRoom = '';

  if (rawRoom) {
    const lower = rawRoom.toLowerCase();
    if (lower.includes('seminar')) {
      formattedRoom = 'Seminar';
    } else if (lower.includes('lab')) {
      // Takes the first letter of the first two words (e.g., "Communications Lab" -> "CL")
      const words = rawRoom.split(/[\s-]+/).filter(Boolean);
      formattedRoom = words.length >= 2 
        ? (words[0][0] + words[1][0]).toUpperCase()
        : rawRoom.substring(0, 2).toUpperCase();
    } else {
      // Strips "R" or "Room" and returns the number (e.g., "R 301" -> "301")
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
      {/* Top shimmer line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg,transparent,${c.border},transparent)`,
      }} />

      {/* Header Row: Type Badge + Room Number */}
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
            fontSize: 10, fontWeight: 600, color: 'rgba(150,170,210,0.6)',
            letterSpacing: '0.04em', background: 'rgba(255,255,255,0.03)',
            padding: '1px 4px', borderRadius: 4,
          }}>
            {formattedRoom}
          </span>
        )}
      </div>

      {/* Course code */}
      <div className="mono" style={{
        fontSize: 11, fontWeight: 700,
        color: c.text, letterSpacing: '0.03em',
        marginTop: 2,
      }}>
        {slot.courseCode}
      </div>

      {/* Course title */}
      <div style={{
        fontSize: 10, color: 'rgba(200,210,230,0.7)',
        lineHeight: 1.3, flex: 1,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {slot.courseTitle}
      </div>

      {/* Teachers + batch */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
        {(slot.teacherInitials || []).map(t => (
          <span key={t} className="mono" style={{
            fontSize: 9, fontWeight: 600,
            color: 'rgba(150,170,210,0.9)',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 3, padding: '1px 4px',
          }}>{t}</span>
        ))}
        {slot.batchScope !== 'all' && (
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#f0c060',
            background: 'rgba(240,190,60,0.12)',
            borderRadius: 3, padding: '1px 4px',
          }}>{slot.batchScope}</span>
        )}
      </div>
    </button>
  );
}