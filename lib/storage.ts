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
export interface Material { id: string; title: string; adminId?: string }
export interface Score { id: string; studentId?: string; value?: number; adminId?: string }
export interface Parent { id: string; adminId?: string }

export class AdminStorage {
  // ADMIN MANAGEMENT
  getAdmins = (): any[] => {
    try {
      const raw = localStorage.getItem('kevins_academy_admins');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  getAdminByUsername = (username: string): any => {
    const admins = this.getAdmins();
    return admins.find(a => a.username === username);
  };

  createAdmin = (data: any): any => {
    const admins = this.getAdmins();
    const newAdmin = { ...data, id: `admin_${Date.now()}`, createdAt: new Date().toISOString() };
    admins.push(newAdmin);
    localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));
    return newAdmin;
  };

  updateAdmin = (id: string, data: any): void => {
    const admins = this.getAdmins();
    const idx = admins.findIndex(a => a.id === id);
    if (idx !== -1) {
      admins[idx] = { ...admins[idx], ...data };
      localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));
    }
  };

  // 1. O'QUVCHILARNI OLISH (localStorage-backed)
  getStudents = (): Student[] => {
    try {
      const raw = localStorage.getItem('kevins_academy_students');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error(e); return []; }
  };

  // 2. YANGI O'QUVCHI QO'SHISH (localStorage)
  addStudent = (data: any): Student => {
    const students = this.getStudents();
    const newStudent = { ...data, id: `student_${Date.now()}` };
    students.push(newStudent);
    localStorage.setItem('kevins_academy_students', JSON.stringify(students));
    return newStudent;
  };

  // 3. O'CHIRISH
  deleteStudent = (id: string): void => {
    const students = this.getStudents().filter(s => s.id !== id);
    localStorage.setItem('kevins_academy_students', JSON.stringify(students));
  };

  // 4. TAHRIRLASH (UPDATE)
  updateStudent = (id: string, data: any): void => {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) {
      students[idx] = { ...students[idx], ...data };
      localStorage.setItem('kevins_academy_students', JSON.stringify(students));
    }
  };

  // GURUHLARNI OLISH (Vaqtinchalik mock yoki API)
  getGroups = (): Group[] => {
    try {
      const raw = localStorage.getItem('kevins_academy_groups');
      if (raw) return JSON.parse(raw);
      return [
        { id: '1', name: 'Beginner A1' },
        { id: '2', name: 'Intermediate B1' }
      ];
    } catch (e) { return []; }
  };

  // Save groups to localStorage
  saveGroups = (groups: Group[]) => {
    try {
      localStorage.setItem('kevins_academy_groups', JSON.stringify(groups));
    } catch (e) { console.error(e); }
  };

  saveStudents = (students: Student[]) => {
    try { localStorage.setItem('kevins_academy_students', JSON.stringify(students)); } catch (e) { console.error(e); }
  };

  // Parents
  getParents = (): Parent[] => {
    try { const raw = localStorage.getItem('kevins_academy_parents'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  };
  saveParents = (parents: Parent[]) => { try { localStorage.setItem('kevins_academy_parents', JSON.stringify(parents)); } catch (e) { console.error(e); } };

  // Payments / Attendance generic storage
  getPayments = (): Payment[] => {
    try { const raw = localStorage.getItem('kevins_academy_payments'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  };
  savePayments = (payments: Payment[]) => { localStorage.setItem('kevins_academy_payments', JSON.stringify(payments)); };

  getAttendance = (): Attendance[] => {
    try { const raw = localStorage.getItem('kevins_academy_attendance'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  };
  saveAttendance = (attendance: Attendance[]) => { localStorage.setItem('kevins_academy_attendance', JSON.stringify(attendance)); };

  // Generic data per-admin type (students, parents, materials, scores, etc.)
  getDataForAdmin = (adminId: string, type: string): any[] => {
    try {
      const raw = localStorage.getItem(`kevins_academy_${type}`);
      const all = raw ? JSON.parse(raw) : [];
      return all.filter((it: any) => it.adminId === adminId || it.adminId == null);
    } catch (e) { return []; }
  };
  saveDataForType = (type: string, data: any[]) => {
    try { localStorage.setItem(`kevins_academy_${type}`, JSON.stringify(data)); } catch (e) { console.error(e); }
  };

  // Materials convenience
  getMaterials = (): Material[] => {
    try { const raw = localStorage.getItem('kevins_academy_materials'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  };
  saveMaterials = (materials: Material[]) => { try { localStorage.setItem('kevins_academy_materials', JSON.stringify(materials)); } catch (e) { console.error(e); } };

  // Scores convenience
  getScores = (): Score[] => {
    try { const raw = localStorage.getItem('kevins_academy_scores'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  };
  saveScores = (scores: Score[]) => { try { localStorage.setItem('kevins_academy_scores', JSON.stringify(scores)); } catch (e) { console.error(e); } };

  // Admin management helpers
  deleteAdmin = (id: string) => {
    try {
      const raw = localStorage.getItem('kevins_academy_admins');
      const admins = raw ? JSON.parse(raw) : [];
      const filtered = admins.filter((a: any) => a.id !== id);
      localStorage.setItem('kevins_academy_admins', JSON.stringify(filtered));
    } catch (e) { console.error(e); }
  };
}

export const adminStorage = new AdminStorage();

// export individual helpers here as well to keep the API consistent with the
// full project version (and to avoid any undefined method problems if other
// code accidentally pulls in the root storage).
// simple wrappers; arguments are explicit so we avoid spread/tuple errors
export const getAdmins = () => adminStorage.getAdmins();
export const getAdminByUsername = (username: string) =>
  // @ts-ignore - stub may not implement this yet
  (adminStorage as any).getAdminByUsername?.(username);
export const createAdmin = (data: any) =>
  (adminStorage as any).createAdmin?.(data);
export const updateAdmin = (id: string, data: any) =>
  (adminStorage as any).updateAdmin?.(id, data);

// groups / students / payments wrappers
export const getGroups = () => (adminStorage as any).getGroups?.();
export const saveGroups = (groups: Group[]) => (adminStorage as any).saveGroups?.(groups);
export const getStudents = () => (adminStorage as any).getStudents?.();
export const addStudent = (data: any) => (adminStorage as any).addStudent?.(data);
export const updateStudent = (id: string, data: any) => (adminStorage as any).updateStudent?.(id, data);
export const deleteStudent = (id: string) => (adminStorage as any).deleteStudent?.(id);
export const saveStudents = (students: Student[]) => (adminStorage as any).saveStudents?.(students);

export const getPayments = () => (adminStorage as any).getPayments?.();
export const savePayments = (payments: Payment[]) => (adminStorage as any).savePayments?.(payments);
export const getAttendance = () => (adminStorage as any).getAttendance?.();
export const saveAttendance = (attendance: Attendance[]) => (adminStorage as any).saveAttendance?.(attendance);

export const getDataForAdmin = (adminId: string, type: string) => (adminStorage as any).getDataForAdmin?.(adminId, type);
export const saveDataForType = (type: string, data: any[]) => (adminStorage as any).saveDataForType?.(type, data);
export const getMaterials = () => (adminStorage as any).getMaterials?.();
export const saveMaterials = (materials: any[]) => (adminStorage as any).saveMaterials?.(materials);
export const getScores = () => (adminStorage as any).getScores?.();
export const saveScores = (scores: any[]) => (adminStorage as any).saveScores?.(scores);
export const deleteAdmin = (id: string) => (adminStorage as any).deleteAdmin?.(id);
export const getParents = () => (adminStorage as any).getParents?.();
export const saveParents = (parents: any[]) => (adminStorage as any).saveParents?.(parents);