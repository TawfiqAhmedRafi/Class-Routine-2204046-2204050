import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authStudent = (roll, registration) =>
  api.post("/api/auth/student", { roll, registration }).then((r) => r.data);

export const authStaff = (initials, password) =>
  api.post("/api/auth/staff", { initials, password }).then((r) => r.data);

// ── Series ────────────────────────────────────────────────────────────────────

export const fetchSeries = () => api.get("/api/series").then((r) => r.data);

export const addSeries = (series, currentSemester, label) =>
  api
    .post("/api/series", { series, currentSemester, label })
    .then((r) => r.data);

export const editSeriesLabel = (series, label) =>
  api.patch(`/api/series/${series}/edit`, { label }).then((r) => r.data);

export const updateSeriesSemester = (series, currentSemester) =>
  api
    .patch(`/api/series/${series}/semester`, { currentSemester })
    .then((r) => r.data);

export const deleteSeries = (series) =>
  api.delete(`/api/series/${series}`).then((r) => r.data);

export const reactivateSeries = (series, currentSemester, label) =>
  api
    .post("/api/series", { series, currentSemester, label })
    .then((r) => r.data);

// ── Routine Slots ─────────────────────────────────────────────────────────────

export const fetchRoutine = (series, batch = "all", semester = null) => {
  const params = { batch };
  if (semester) params.semester = semester;
  return api.get(`/api/routine/${series}`, { params }).then((r) => r.data);
};

export const fetchMasterRoutine = (batch = "all") =>
  api.get("/api/routine/all/slots", { params: { batch } }).then((r) => r.data);

export const createSlot = (slot) =>
  api.post("/api/routine/slots", slot).then((r) => r.data);

export const updateSlot = (id, updates) =>
  api.put(`/api/routine/slots/${id}`, updates).then((r) => r.data);

export const deleteSlot = (id) =>
  api.delete(`/api/routine/slots/${id}`).then((r) => r.data);

// ── Requests ──────────────────────────────────────────────────────────────────

export const submitRequest = (payload) =>
  api.post("/api/requests", payload).then((r) => r.data);

export const fetchPendingRequests = () =>
  api.get("/api/requests/pending").then((r) => r.data);

export const fetchAllRequests = () =>
  api.get("/api/requests/all").then((r) => r.data);

export const approveRequest = (id) =>
  api.post(`/api/requests/${id}/approve`).then((r) => r.data);

export const rejectRequest = (id, reason = "") =>
  api.post(`/api/requests/${id}/reject`, { reason }).then((r) => r.data);

// ── Users / Teachers ──────────────────────────────────────────────────────────
export const fetchTeachers = () => api.get("/api/users/teachers").then((r) => r.data);

export const addTeacher = (teacherData) =>
  api.post("/api/users/teachers", teacherData).then((r) => r.data);

export const deleteTeacher = (id) =>
  api.delete(`/api/users/teachers/${id}`).then((r) => r.data);

// ── Health ────────────────────────────────────────────────────────────────────

export const healthCheck = () => api.get("/api/health").then((r) => r.data);

export default api;
