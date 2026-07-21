import { useState, useEffect } from 'react';
import { fetchSeries, fetchPendingRequests, fetchAllRequests, approveRequest, rejectRequest } from '../services/api';
import { toast } from '../components/Toast';
import TeacherManager from '../components/HodPanel/TeacherManager';
import SeriesManager from '../components/HodPanel/SeriesManager';
import RoutineBuilder from '../components/HodPanel/RoutineBuilder';
import RequestManager from '../components/HodPanel/RequestManager';

export default function HodDashboard({ user }) {
  const [seriesConfigs, setSeriesConfigs] = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [allRequests,   setAllRequests]   = useState([]);
  const [hodTab,        setHodTab]        = useState('routine');

  async function loadData() {
    try {
      const [ser, pend, all] = await Promise.all([fetchSeries(), fetchPendingRequests(), fetchAllRequests()]);
      if (ser.success) setSeriesConfigs(ser.data);
      if (pend.success) setRequests(pend.data);
      if (all.success) setAllRequests(all.data);
    } catch (_) {}
  }

  useEffect(() => { loadData(); }, []);

  async function handleDecide(id, action, reason) {
    try {
      let res = action === 'approved' ? await approveRequest(id) : await rejectRequest(id, reason);
      if (res.success) { 
        toast(action === 'approved' ? 'Approved' : 'Rejected', action === 'approved' ? '#30d890' : '#ff7a6a'); 
        loadData(); 
      }
    } catch (err) { toast('Action failed', '#ff7a6a'); }
  }

  const tabBtnStyle = (k) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer',
    background: hodTab === k ? 'rgba(60,100,220,0.25)' : 'transparent',
    color: hodTab === k ? '#a8c2ff' : 'rgba(140,165,215,0.45)', fontWeight: hodTab === k ? 700 : 400
  });

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 className="grad-text" style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>HOD Control Panel</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtnStyle('routine')} onClick={() => setHodTab('routine')}>Manage Routine</button>
        <button style={tabBtnStyle('series')} onClick={() => setHodTab('series')}>Series Settings</button>
        <button style={tabBtnStyle('teachers')} onClick={() => setHodTab('teachers')}>Manage Teachers</button>
        <button style={tabBtnStyle('requests')} onClick={() => setHodTab('requests')}>Requests ({requests.length})</button>
      </div>

      {hodTab === 'routine' && <RoutineBuilder configs={seriesConfigs} />}
      {hodTab === 'series' && <SeriesManager configs={seriesConfigs} reload={loadData} />}
      {hodTab === 'teachers' && <TeacherManager />}
      {hodTab === 'requests' && <RequestManager requests={requests} allRequests={allRequests} onDecide={handleDecide} />}
    </div>
  );
}