// lib/storage.ts

export interface Student {
  id: string;
  fullName: string;
  role?: 'student';
  password?: string;
  username?: string;
  email: string;
  phone: string;
  group: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  level?: string;
  description?: string;
  teacher?: string;
  schedule?: string;
  maxStudents?: number;
  createdAt?: string;
}

export interface Payment { id: string; amount: number; studentId?: string; adminId?: string; createdAt?: string }
export interface Attendance { id: string; studentId?: string; date?: string; status?: string; adminId?: string }
export interface Material { id: string; title: string; adminId?: string; dueDate?: string }
export interface Score { id: string; studentId?: string; value?: number; adminId?: string }
export interface Parent { id: string; adminId?: string }

// small wrapper to call our API
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { credentials: 'include', ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status}`);
  }
  return res.json();
}

// ---- Admin helpers --------------------------------------------------------
export const getAdmins = () => apiFetch('/api/admins');
export const createAdmin = (data: any) =>
  apiFetch('/api/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const updateAdmin = (id: string, data: any) =>
  apiFetch('/api/admins', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
export const deleteAdmin = (id: string) =>
  apiFetch(`/api/admins?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Groups ----------------------------------------------------------------
export const getGroups = async () => {
  try {
    const data = await apiFetch('/api/groups');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addGroup = (data: any) =>
  apiFetch('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const updateGroup = (id: string, data: any) =>
  apiFetch('/api/groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
export const deleteGroup = (id: string) =>
  apiFetch(`/api/groups?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Students -------------------------------------------------------------
export const getStudents = async () => {
  try {
    const data = await apiFetch('/api/students');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addStudent = (data: any) =>
  apiFetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const updateStudent = (id: string, data: any) =>
  apiFetch('/api/students', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
export const deleteStudent = (id: string) =>
  apiFetch(`/api/students?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Parents --------------------------------------------------------------
export const getParents = async () => {
  try {
    const data = await apiFetch('/api/parents');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addParent = (data: any) =>
  apiFetch('/api/parents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// ---- Payments -------------------------------------------------------------
export const getPayments = async () => {
  try {
    const data = await apiFetch('/api/payments');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addPayment = (data: any) =>
  apiFetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// ---- Attendance -----------------------------------------------------------
export const getAttendance = async () => {
  try {
    const data = await apiFetch('/api/attendance');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addAttendance = (data: any) =>
  apiFetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// ---- Scores ---------------------------------------------------------------
export const getScores = async () => {
  try {
    const data = await apiFetch('/api/scores');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addScore = (data: any) =>
  apiFetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// ---- Materials ------------------------------------------------------------
export const getMaterials = async () => {
  try {
    const data = await apiFetch('/api/materials');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
export const addMaterial = (data: any) =>
  apiFetch('/api/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// Compatibility wrappers for older localStorage-style helpers
export const getAdminByUsername = async (username: string) => {
  const admins = await getAdmins();
  return admins.find((a: any) => a.username === username);
};

export const saveGroups = async (groups: Group[]) => {
  await Promise.all(groups.map((g: any) => (g.id ? updateGroup(g.id, g) : addGroup(g))));
  return getGroups();
};

export const saveStudents = async (students: Student[]) => {
  await Promise.all(students.map((s: any) => (s.id ? updateStudent(s.id, s) : addStudent(s))));
  return getStudents();
};

export const savePayments = async (payments: Payment[]) => {
  await Promise.all(payments.map((p: any) => (p.id ? apiFetch(`/api/payments?id=${encodeURIComponent(p.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }) : addPayment(p))));
  return getPayments();
};

export const saveAttendance = async (attendance: Attendance[]) => {
  await Promise.all(attendance.map((a: any) => (a.id ? apiFetch(`/api/attendance?id=${encodeURIComponent(a.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }) : addAttendance(a))));
  return getAttendance();
};

export const saveMaterials = async (materials: Material[]) => {
  await Promise.all(materials.map((m: any) => (m.id ? apiFetch(`/api/materials?id=${encodeURIComponent(m.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) }) : addMaterial(m))));
  return getMaterials();
};

export const saveScores = async (scores: Score[]) => {
  await Promise.all(scores.map((s: any) => (s.id ? apiFetch(`/api/scores?id=${encodeURIComponent(s.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }) : addScore(s))));
  return getScores();
};

export const saveParents = async (parents: Parent[]) => {
  await Promise.all(parents.map((p: any) => (p.id ? apiFetch(`/api/parents?id=${encodeURIComponent(p.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }) : addParent(p))));
  return getParents();
};

// Generic data getter (returns appropriate collection based on type)
export const getDataForAdmin = async (adminId: string, resourceType: 'scores' | 'materials' | 'parents' | 'students' | 'attendance' | 'payments') => {
  switch (resourceType) {
    case 'scores':
      return getScores();
    case 'materials':
      return getMaterials();
    case 'parents':
      return getParents();
    case 'students':
      return getStudents();
    case 'attendance':
      return getAttendance();
    case 'payments':
      return getPayments();
    default:
      return [];
  }
};
