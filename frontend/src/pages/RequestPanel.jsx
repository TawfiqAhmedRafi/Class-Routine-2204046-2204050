import { useState, useEffect } from 'react';
import { fetchRoutine, submitRequest } from '../services/api';
import { DAYS, TEACHERS } from '../data/constants';
import { toast } from '../components/Toast';

const LABS = ['DSP Lab', 'Computer Lab', 'Electronics Lab', 'Communication Lab', 'A&P Lab'];

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', padding: '10px 14px',
      background: 'rgba(20,25,40,0.9)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#d0dcf0', fontSize: 13, outline: 'none',
    }}>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

export default function RequestPanel({ user }) {
  const [type,      setType]      = useState('slot_change');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]  = useState(false);

  // Live slots for the user's series
  const [slots, setSlots] = useState([]);

  // Slot change fields
  const [slotId,   setSlotId]   = useState('');
  const [propDay,  setPropDay]  = useState('Saturday');
  const [periods,  setPeriods]  = useState([]);
  const [scReason, setScReason] = useState('');

  // Lab booking fields
  const [lbCode,   setLbCode]   = useState('');
  const [lbTitle,  setLbTitle]  = useState('');
  const [lbDay,    setLbDay]    = useState('Saturday');
  const [lbStart,  setLbStart]  = useState(1);
  const [lbDur,    setLbDur]    = useState(3);
  const [lbRoom,   setLbRoom]   = useState(LABS[0]);
  const [lbBatch,  setLbBatch]  = useState('all');
  const [lbReason, setLbReason] = useState('');

  // Load slots for the dropdown
  useEffect(() => {
    const series = user.series || 22;
    fetchRoutine(series)
      .then(res => { if (res.success) setSlots(res.data); })
      .catch(() => {});
  }, [user.series]);

  function togglePeriod(p) {
    setPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p].sort((a,b)=>a-b));
  }

  async function submit() {
    setSubmitting(true);
    try {
      let payload;

      if (type === 'slot_change') {
        if (!slotId || periods.length === 0) {
          toast('Select a slot and at least one period', '#ff7a6a', 'rgba(255,90,69,0.35)');
          setSubmitting(false); return;
        }
        payload = {
          type: 'slot_change',
          submittedBy: user.initials || user.roll,
          slotChange: {
            existingSlotId: slotId,
            proposedDay: propDay,
            proposedPeriodSpan: periods,
            reason: scReason,
          },
        };
      } else {
        if (!lbCode || !lbTitle) {
          toast('Fill in course code and title', '#ff7a6a', 'rgba(255,90,69,0.35)');
          setSubmitting(false); return;
        }
        const selectedSlot = slots.find(s => s._id === slotId);
        payload = {
          type: 'lab_booking',
          submittedBy: user.initials || user.roll,
          labBooking: {
            series: user.series || selectedSlot?.series || 22,
            semester: selectedSlot?.semester || 'even',
            day: lbDay,
            startPeriod: lbStart,
            periodSpan: lbDur,
            courseCode: lbCode,
            courseTitle: lbTitle,
            room: lbRoom,
            batchScope: lbBatch,
            reason: lbReason,
            teachers: [user.initials],
          },
        };
      }

      const res = await submitRequest(payload);
      if (res.success) {
        toast('✓ Request submitted — awaiting HOD approval', '#f0c060', 'rgba(240,190,60,0.35)');
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setSlotId(''); setPropDay('Saturday'); setPeriods([]); setScReason('');
          setLbCode(''); setLbTitle(''); setLbReason('');
        }, 2500);
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to submit request', '#ff7a6a', 'rgba(255,90,69,0.35)');
    } finally {
      setSubmitting(false);
    }
  }

  const btnStyle = (k) => ({
    flex: 1, padding: 9, borderRadius: 7, border: 'none', fontSize: 13,
    fontWeight: type === k ? 700 : 400, cursor: 'pointer',
    background: type === k ? 'rgba(60,100,220,0.22)' : 'transparent',
    color: type === k ? '#a8c2ff' : 'rgba(140,165,215,0.45)',
    transition: 'all 0.15s',
  });

  const inputSt = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, color: '#d0dcf0', fontSize: 13, outline: 'none',
  };

  const dayOpts    = DAYS.map(d => ({ value: d, label: d }));
  const periodOpts = [1,2,3,4,5,6,7,8,9].map(p => ({ value: p, label: `P${p}` }));
  const durOpts    = [1,2,3].map(d => ({ value: d, label: `${d} period${d>1?'s':''}` }));
  const batchOpts  = ["20","21","22","23","24","25"];

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px', maxWidth: 640, margin: '0 auto' }} className="fade-up">

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#c0d0e8', margin: '0 0 4px' }}>
          Submit Routine Request
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(140,165,215,0.45)', margin: 0 }}>
          Requests route to HOD for approval. Routine updates only execute after explicit HOD sign-off.
        </p>
      </div>

      <div className="glass" style={{ borderRadius: 16, padding: 24 }}>

        {/* Type toggle */}
        <div style={{ marginBottom: 18 }}>
          <label className="field-label">Request Type</label>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: 3 }}>
            <button style={btnStyle('slot_change')} onClick={() => setType('slot_change')}>Slot Change</button>
            <button style={btnStyle('lab_booking')} onClick={() => setType('lab_booking')}>Lab Booking</button>
          </div>
        </div>

        {/* Slot change */}
        {type === 'slot_change' && (
          <>
            <Field label="Slot to Change">
              <select value={slotId} onChange={e => setSlotId(e.target.value)} style={{ ...inputSt, background: 'rgba(20,25,40,0.9)' }}>
                <option value="">— Select Slot —</option>
                {slots.map(s => (
                  <option key={s._id} value={s._id}>{s.day} P{s.startPeriod} · {s.courseCode}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Proposed Day">
                <Sel value={propDay} onChange={setPropDay} options={dayOpts} />
              </Field>
              <Field label="Proposed Periods">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9].map(p => (
                    <button
                      key={p}
                      onClick={() => togglePeriod(p)}
                      className={`period-btn${periods.includes(p) ? ' active' : ''}`}
                    >{p}</button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Reason">
              <textarea
                value={scReason} onChange={e => setScReason(e.target.value)}
                placeholder="Why is this change needed?"
                style={{ height: 72 }}
              />
            </Field>
          </>
        )}

        {/* Lab booking */}
        {type === 'lab_booking' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Course Code">
                <input style={inputSt} placeholder="e.g. ETE 1214" value={lbCode} onChange={e => setLbCode(e.target.value)} />
              </Field>
              <Field label="Course Title">
                <input style={inputSt} placeholder="e.g. Electronics Lab" value={lbTitle} onChange={e => setLbTitle(e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Day">
                <Sel value={lbDay} onChange={setLbDay} options={dayOpts} />
              </Field>
              <Field label="Start Period">
                <Sel value={lbStart} onChange={v => setLbStart(Number(v))} options={periodOpts} />
              </Field>
              <Field label="Duration">
                <Sel value={lbDur} onChange={v => setLbDur(Number(v))} options={durOpts} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Lab Room">
                <Sel value={lbRoom} onChange={setLbRoom} options={LABS} />
              </Field>
              <Field label="Batch">
                <Sel value={lbBatch} onChange={setLbBatch} options={batchOpts} />
              </Field>
            </div>
            <Field label="Reason">
              <textarea
                value={lbReason} onChange={e => setLbReason(e.target.value)}
                placeholder="Why is this lab session needed?"
                style={{ height: 72 }}
              />
            </Field>
          </>
        )}

        <button
          onClick={submit}
          disabled={submitting || submitted}
          style={{
            width: '100%', padding: 12, borderRadius: 10, marginTop: 16,
            border: '1px solid rgba(99,140,255,0.4)',
            background: submitted ? 'rgba(48,216,144,0.15)' : 'rgba(50,90,200,0.2)',
            color: submitted ? '#30d890' : '#a8c2ff',
            fontSize: 14, fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {submitting ? 'Submitting…' : submitted ? '✓ Submitted!' : 'Submit Request →'}
        </button>
      </div>
    </div>
  );
}