// lib/storage.ts

export interface Student {
  id: string;
  adminId?: string | number;
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
  adminId?: string | number;
  name: string;
  level?: string;
  track?: 'foundation' | 'cefr' | 'ielts' | string;
  telegramChatId?: string;
  description?: string;
  teacher?: string;
  schedule?: string;
  maxStudents?: number;
  createdAt?: string;
}

export interface IeltsProgressMapPayload {
  studentId: string | number;
  groupName?: string;
  listeningTotalTests?: number;
  listeningSolvedTests?: number;
  listeningReadingCorrect?: number;
  scriptWritingCount?: number;
  podcastVideoAnalysisCount?: number;
  writingTask1Uploads?: number;
  writingTask2Uploads?: number;
  speakingGeneralCount?: number;
  speakingAcademicCount?: number;
  fluencyScore?: number;
  lexicalScore?: number;
  grammarScore?: number;
  pronunciationScore?: number;
  vocabularyTotalWords?: number;
  vocabularyKnownWords?: number;
  vocabularyUnknownWords?: number;
  vocabularyUploadNote?: string;
  vocabularyUploadFiles?: string[];
  grammarTopicTests?: number;
  grammarFixScore?: number;
  grammarErrorWorkCount?: number;
  articleReadCount?: number;
  articleTranslationCount?: number;
  readingArtScore?: number;
  attendanceEffectPercent?: number;
}

export interface Payment {
  id: string;
  amount: number;
  studentId?: string;
  studentName?: string;
  month?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  penaltyPerDay?: number;
  paidAt?: string;
  note?: string;
  status?: 'paid' | 'pending' | 'overdue' | string;
  overdueDays?: number;
  penaltyAmount?: number;
  totalDue?: number;
  isOverdue?: boolean;
  warning?: string | null;
  adminId?: string;
  createdAt?: string;
}
export interface Attendance {
  id: string;
  studentId?: string;
  studentName?: string;
  date?: string;
  status?: 'present' | 'absent' | 'late' | string;
  note?: string;
  adminId?: string;
}
export interface Material { id: string; title: string; adminId?: string; dueDate?: string; content?: string; fileUrl?: string; fileType?: string; group?: string; uploadedAt?: string }
export interface Score {
  id: string;
  studentId?: string;
  studentName?: string;
  subject?: string;
  comment?: string;
  value?: number;
  adminId?: string;
  level?: string;
  category?: string;
  scoreType?: 'weekly' | 'mock' | string;
  maxScore?: number;
  overallPercent?: number;
  mockScore?: number;
  examDateTime?: string;
  breakdown?: Record<string, any>;
  createdAt?: string;
}
export interface Parent {
  id: string;
  fullName?: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  studentId?: string;
  studentIds?: string[];
  adminId?: string;
  telegramChatId?: string;
  telegramConnected?: boolean;
  telegramInviteLink?: string;
  normalizedPhone?: string;
  botStatus?: 'CONNECTED' | 'DISCONNECTED' | string;
  botDisconnectedAt?: string;
  botLastCheckedAt?: string;
  botLastError?: string;
  createdAt?: string;
}

export interface Admin {
  id: string | number;
  username: string;
  password: string;
  fullName: string;
  email?: string;
  contactPhone?: string;
  telegramUsername?: string;
  notifyTelegram?: boolean;
  notifySms?: boolean;
  isActive?: boolean;
  createdAt: string;
}

// small wrapper to call our API
async function apiFetch(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers || {});
  if (typeof window !== 'undefined') {
    try {
      const rawAdmin = localStorage.getItem('currentAdmin');
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin);
        if (admin?.id !== undefined && admin?.id !== null) {
          headers.set('x-admin-id', String(admin.id));
        }
      }
    } catch {
      // ignore malformed localStorage
    }
  }

  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `${res.status}`;
    try {
      const parsed = JSON.parse(text || '{}');
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        message = parsed.error;
      } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        message = parsed.message;
      }
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  return res.json();
}

async function apiFetchAsAdmin(path: string, adminId?: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers || {});
  if (adminId && adminId !== 'system') {
    headers.set('x-admin-id', String(adminId));
  }
  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `${res.status}`;
    try {
      const parsed = JSON.parse(text || '{}');
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        message = parsed.error;
      } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        message = parsed.message;
      }
    } catch {
      // keep raw text
    }
    throw new Error(message);
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
export const updateParent = (id: string | number, data: any) =>
  apiFetch('/api/parents', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Number(id), ...data }),
  });
export const deleteParent = (id: string | number) =>
  apiFetch(`/api/parents?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });

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

export const getIeltsProgressMap = (studentId: string | number) =>
  apiFetch(`/api/ielts/progress?studentId=${encodeURIComponent(String(studentId))}`);

export const saveIeltsProgressMap = (data: IeltsProgressMapPayload) =>
  apiFetch('/api/ielts/progress', {
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
  await Promise.all(
    payments.map((p: any) => {
      const idNum = Number(p?.id);
      const hasNumericId = Number.isFinite(idNum) && String(p?.id).trim() !== '';
      return hasNumericId
        ? apiFetch(`/api/payments?id=${encodeURIComponent(String(p.id))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...p, id: idNum })
          })
        : addPayment(p);
    })
  );
  return getPayments();
};

export const saveAttendance = async (attendance: Attendance[]) => {
  await Promise.all(
    attendance.map((a: any) => {
      const idNum = Number(a?.id);
      const hasNumericId = Number.isFinite(idNum) && String(a?.id).trim() !== '';
      return hasNumericId
        ? apiFetch(`/api/attendance?id=${encodeURIComponent(String(a.id))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...a, id: idNum })
          })
        : addAttendance(a);
    })
  );
  return getAttendance();
};

export const saveMaterials = async (materials: Material[]) => {
  await Promise.all(materials.map((m: any) => (m.id ? apiFetch(`/api/materials?id=${encodeURIComponent(m.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) }) : addMaterial(m))));
  return getMaterials();
};

export const saveScores = async (scores: Score[]) => {
  await Promise.all(
    scores.map((s: any) => {
      const idNum = Number(s?.id);
      const hasNumericId = Number.isFinite(idNum) && String(s?.id).trim() !== '';
      return hasNumericId
        ? apiFetch(`/api/scores?id=${encodeURIComponent(String(s.id))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...s, id: idNum })
          })
        : addScore(s);
    })
  );
  return getScores();
};

export const saveParents = async (parents: Parent[]) => {
  await Promise.all(
    parents.map((p: any) => {
      const idNum = Number(p?.id);
      const hasNumericId = Number.isFinite(idNum) && String(p?.id).trim() !== '';
      return hasNumericId
        ? apiFetch(`/api/parents?id=${encodeURIComponent(String(p.id))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...p, id: idNum })
          })
        : addParent(p);
    })
  );
  return getParents();
};

// Generic data getter (returns appropriate collection based on type)
export const getDataForAdmin = async (adminId: string, resourceType: 'scores' | 'materials' | 'parents' | 'students' | 'attendance' | 'payments') => {
  switch (resourceType) {
    case 'scores':
      return apiFetchAsAdmin('/api/scores', adminId);
    case 'materials':
      return apiFetchAsAdmin('/api/materials', adminId);
    case 'parents':
      return apiFetchAsAdmin('/api/parents', adminId);
    case 'students':
      return apiFetchAsAdmin('/api/students', adminId);
    case 'attendance':
      return apiFetchAsAdmin('/api/attendance', adminId);
    case 'payments':
      return apiFetchAsAdmin('/api/payments', adminId);
    default:
      return [];
  }
};
