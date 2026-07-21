import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { fetchTeachers, addTeacher, deleteTeacher } from '../../services/api';
import { toast } from '../Toast';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%'
};

export default function TeacherManager() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', initials: '', designation: '', password: '' });

  async function loadTeachers() {
    try {
      const res = await fetchTeachers();
      if (res.success) setTeachers(res.data);
    } catch (err) { toast('Failed to load teachers', '#ff7a6a'); } 
    finally { setLoading(false); }
  }

  useEffect(() => { loadTeachers(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      const res = await addTeacher(form);
      if (res.success) {
        toast(`Teacher ${form.initials} added`, '#30d890');
        setForm({ name: '', initials: '', designation: '', password: '' });
        loadTeachers();
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to add teacher', '#ff7a6a');
    }
  }

  async function handleDelete(id, initials) {
    const result = await Swal.fire({
      title: `Delete ${initials}?`,
      text: "This will remove the teacher's access permanently.",
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ff7a6a', cancelButtonColor: '#555',
      confirmButtonText: 'Yes, Delete', background: '#0a0d14', color: '#e2eaff',
    });

    if (result.isConfirmed) {
      try {
        const res = await deleteTeacher(id);
        if (res.success) { toast(`Teacher deleted`, '#ff7a6a'); loadTeachers(); }
      } catch (err) { toast('Failed to delete teacher', '#ff7a6a'); }
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
      <div className="glass" style={{ padding: 20, borderRadius: 14, height: 'fit-content' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#a8c2ff' }}>Add New Teacher</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input required placeholder="Full Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputSt}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input required placeholder="Initials (e.g. MKH)" value={form.initials} onChange={e => setForm({...form, initials: e.target.value.toUpperCase()})} style={{...inputSt, textTransform: 'uppercase'}}/>
            <input required type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={inputSt}/>
          </div>
          <input required placeholder="Designation (e.g. Assistant Professor)" value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} style={inputSt}/>
          <button type="submit" style={{ padding: 10, borderRadius: 8, background: 'rgba(60,100,220,0.2)', border: '1px solid rgba(99,140,255,0.4)', color: '#a8c2ff', fontWeight: 700, cursor: 'pointer' }}>
            + Add Teacher
          </button>
        </form>
      </div>

      <div className="glass" style={{ padding: 20, borderRadius: 14 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#a8c2ff' }}>Active Staff</h3>
        {loading ? <div style={{ color: '#555' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teachers.map(t => (
              <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#d0dcf0' }}>{t.name} <span className="mono" style={{ color: '#a8c2ff', fontSize: 11 }}>({t.credentials?.initials})</span></div>
                  <div style={{ fontSize: 11, color: 'rgba(140,165,215,0.5)' }}>{t.designation}</div>
                </div>
                <button onClick={() => handleDelete(t._id, t.credentials?.initials)} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,90,69,0.1)', border: '1px solid rgba(255,90,69,0.3)', color: '#ff7a6a', cursor: 'pointer', fontSize: 11 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}