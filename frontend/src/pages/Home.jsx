import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 1 }}>
      <div className="glass fade-up" style={{ textAlign: 'center', maxWidth: 600, padding: '60px 40px', borderRadius: '24px' }}>
        
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.25em', color: 'rgba(99,140,255,0.6)', textTransform: 'uppercase', marginBottom: 16 }}>
          Rajshahi University of Engineering & Technology
        </div>
        
        <h1 className="grad-text" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, margin: '0 0 24px', lineHeight: 1.1 }}>
          Department of ETE<br/>Class Routine
        </h1>
        
        <p style={{ color: 'rgba(140,165,215,0.6)', fontSize: '1.1rem', marginBottom: '40px', lineHeight: 1.6 }}>
          The centralized portal for dynamic class schedules, master routines, and request management.
        </p>
        
        <Link to="/login" style={{
          display: 'inline-block', padding: '16px 40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(60,100,220,0.4) 0%, rgba(60,100,220,0.1) 100%)', 
          border: '1px solid rgba(99,140,255,0.5)', color: '#e2eaff', 
          fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none',
          transition: 'all 0.2s ease', boxShadow: '0 8px 32px rgba(60,100,220,0.2)'
        }}>
          Access Portal →
        </Link>
      </div>
    </div>
  );
}