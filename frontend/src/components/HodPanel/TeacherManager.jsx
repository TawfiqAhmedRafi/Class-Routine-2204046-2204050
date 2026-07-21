import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { fetchTeachers, addTeacher, deleteTeacher } from '../../services/api';
import { toast } from '../Toast';

const inputSt = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  color: '#d0dcf0', fontSize: 12, outline: 'none', width: '100%',
  boxSizing: 'border-box'
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
    <div className="teacher-manager">
      <style>{`
        .teacher-manager * { box-sizing: border-box; }

        .tm-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 24px;
        }

        .tm-panel {
          padding: 20px;
          border-radius: 14px;
        }
        .tm-panel-add {
          height: fit-content;
        }
        .tm-title {
          margin: 0 0 16px;
          font-size: 14px;
          color: #a8c2ff;
        }

        .tm-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tm-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .tm-submit {
          padding: 10px;
          border-radius: 8px;
          background: rgba(60,100,220,0.2);
          border: 1px solid rgba(99,140,255,0.4);
          color: #a8c2ff;
          font-weight: 700;
          cursor: pointer;
        }

        .tm-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tm-loading {
          color: #555;
        }

        .tm-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          flex-wrap: wrap;
        }
        .tm-row-info {
          min-width: 0;
        }
        .tm-row-name {
          font-size: 13px;
          font-weight: 700;
          color: #d0dcf0;
          word-break: break-word;
        }
        .tm-row-initials {
          color: #a8c2ff;
          font-size: 11px;
        }
        .tm-row-desig {
          font-size: 11px;
          color: rgba(140,165,215,0.5);
          word-break: break-word;
        }
        .tm-remove-btn {
          padding: 6px 10px;
          border-radius: 6px;
          background: rgba(255,90,69,0.1);
          border: 1px solid rgba(255,90,69,0.3);
          color: #ff7a6a;
          cursor: pointer;
          font-size: 11px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Tablet: stack the two main panels into a single column */
        @media (max-width: 900px) {
          .tm-grid {
            grid-template-columns: 1fr;
          }
          .tm-panel-add {
            height: auto;
          }
        }

        /* Small phones: initials/password fields stack too, and each
           staff row goes full-column so the remove button sits below
           the info instead of squeezing it */
        @media (max-width: 480px) {
          .tm-form-row {
            grid-template-columns: 1fr;
          }
          .tm-row {
            flex-direction: column;
            align-items: stretch;
          }
          .tm-remove-btn {
            width: 100%;
            text-align: center;
          }
          .tm-panel {
            padding: 16px;
          }
        }
      `}</style>

      <div className="tm-grid">
        <div className="glass tm-panel tm-panel-add">
          <h3 className="tm-title">Add New Teacher</h3>
          <form onSubmit={handleAdd} className="tm-form">
            <input
              required
              placeholder="Full Name"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              style={inputSt}
            />
            <div className="tm-form-row">
              <input
                required
                placeholder="Initials (e.g. MKH)"
                value={form.initials}
                onChange={e => setForm({...form, initials: e.target.value.toUpperCase()})}
                style={{...inputSt, textTransform: 'uppercase'}}
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                style={inputSt}
              />
            </div>
            <input
              required
              placeholder="Designation (e.g. Assistant Professor)"
              value={form.designation}
              onChange={e => setForm({...form, designation: e.target.value})}
              style={inputSt}
            />
            <button type="submit" className="tm-submit">
              + Add Teacher
            </button>
          </form>
        </div>

        <div className="glass tm-panel">
          <h3 className="tm-title">Active Staff</h3>
          {loading ? <div className="tm-loading">Loading...</div> : (
            <div className="tm-list">
              {teachers.map(t => (
                <div key={t._id} className="tm-row">
                  <div className="tm-row-info">
                    <div className="tm-row-name">
                      {t.name} <span className="mono tm-row-initials">({t.credentials?.initials})</span>
                    </div>
                    <div className="tm-row-desig">{t.designation}</div>
                  </div>
                  <button
                    className="tm-remove-btn"
                    onClick={() => handleDelete(t._id, t.credentials?.initials)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}