// Local Storage Management for Kevin's Academy

// Student interface
export interface Student {
  id: string;
  fullName: string;
  role?: 'student';
  password?: string; // Student login password
  username?: string; // Student login username
  email: string;
  phone: string;
  group: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// Group interface
export interface Group {
  id: string;
  name: string;
  description: string;
  teacher: string;
  schedule: string;
  maxStudents: number;
  level?: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced';
  studentCount?: number;
  createdAt: string;
}

// Material interface
export interface Material {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  group: string;
  uploadedBy: string;
  uploadedAt: string;
  dueDate?: string;
}

// Score interface
export interface Score {
  id: string;
  studentName: string;
  vocabulary: number;
  grammar: number;
  speaking: number;
  reading: number;
  writing: number;
  listening: number;
  createdAt: string;
}

// Attendance interface
export interface Attendance {
  id: string;
  studentName: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  group: string;
}
// Payment interface
export interface Payment {
  id: string;
  studentName: string;
  amount: number;
  month: string;
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  paidDate?: string;
}

// Parent interface
export interface Parent {
  id: string;
  fullName: string;
  role?: 'parent';
  email: string;
  phone: string;
  username?: string;
  password?: string;
  studentId: string;
  createdAt: string;
}

// Admin interface
export interface Admin {
  id: string;
  role?: 'admin';
  username: string;
  password: string; // In production, this should be hashed
  fullName: string;
  email: string;
  createdAt: string;
  isActive: boolean;
}

export type AuthRole = 'admin' | 'student' | 'parent';


// Multi-admin storage system
export class AdminStorage {
  private getAdminKey(adminId: string, key: string): string {
    return `kevins_academy_${adminId}_${key}`;
  }

  private getCurrentAdmin(): Admin | null {
    const currentAdmin = localStorage.getItem('kevins_academy_current_admin');
    return currentAdmin ? JSON.parse(currentAdmin) : null;
  }

  private setCurrentAdmin(admin: Admin | null): void {
    if (admin) {
      localStorage.setItem('kevins_academy_current_admin', JSON.stringify(admin));
    } else {
      localStorage.removeItem('kevins_academy_current_admin');
    }
  }

  // Admin management functions
  createAdmin(adminData: Omit<Admin, 'id' | 'createdAt' | 'isActive'>): Admin {
    const admins = this.getAdmins();
    const newAdmin: Admin = {
      ...adminData,
      role: 'admin',
      id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    admins.push(newAdmin);
    localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));

    return newAdmin;
  }

  getAdmins(): Admin[] {
    const admins = localStorage.getItem('kevins_academy_admins');
    return admins ? JSON.parse(admins) : [];
  }

  getAdminById(id: string): Admin | null {
    const admins = this.getAdmins();
    return admins.find(admin => admin.id === id) || null;
  }

  getAdminByUsername(username: string): Admin | null {
    const admins = this.getAdmins();
    return admins.find(admin => admin.username === username) || null;
  }

  updateAdmin(id: string, updates: Partial<Admin>): Admin | null {
    const admins = this.getAdmins();
    const adminIndex = admins.findIndex(admin => admin.id === id);

    if (adminIndex === -1) return null;

    admins[adminIndex] = { ...admins[adminIndex], ...updates };
    localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));

    // Update current admin if it's the same admin
    const currentAdmin = this.getCurrentAdmin();
    if (currentAdmin && currentAdmin.id === id) {
      this.setCurrentAdmin(admins[adminIndex]);
    }

    return admins[adminIndex];
  }

  deleteAdmin(id: string): boolean {
    const admins = this.getAdmins();
    const filteredAdmins = admins.filter(admin => admin.id !== id);

    if (filteredAdmins.length === admins.length) return false;

    localStorage.setItem('kevins_academy_admins', JSON.stringify(filteredAdmins));

    // O'chirilgan adminning barcha ma'lumotlarini ham o'chirish
    const adminKeys = [
      'students', 'groups', 'materials', 'scores',
      'attendance', 'payments', 'parents'
    ];

    adminKeys.forEach(key => {
      const adminKey = this.getAdminKey(id, key);
      localStorage.removeItem(adminKey);
    });

    // Clear current admin if it's the deleted admin
    const currentAdmin = this.getCurrentAdmin();
    if (currentAdmin && currentAdmin.id === id) {
      this.setCurrentAdmin(null);
    }

    return true;
  }

  // Authentication functions
  authenticateAdmin(username: string, password: string): Admin | null {
    const admin = this.getAdminByUsername(username);
    if (admin && admin.password === password && admin.isActive) {
      this.setCurrentAdmin(admin);
      return admin;
    }
    return null;
  }

  logoutAdmin(): void {
    this.setCurrentAdmin(null);
  }

  getCurrentAdminData(): Admin | null {
    return this.getCurrentAdmin();
  }

  // Data storage functions with admin namespace
  saveData(key: string, data: any): void {
    const currentAdmin = this.getCurrentAdmin();
    if (!currentAdmin) {
      throw new Error('No admin logged in');
    }

    const adminKey = this.getAdminKey(currentAdmin.id, key);
    localStorage.setItem(adminKey, JSON.stringify(data));
  }

  getData(key: string): any {
    const currentAdmin = this.getCurrentAdmin();
    if (!currentAdmin) {
      throw new Error('No admin logged in');
    }

    const adminKey = this.getAdminKey(currentAdmin.id, key);
    const data = localStorage.getItem(adminKey);
    return data ? JSON.parse(data) : null;
  }

  updateData(key: string, updateFn: (data: any) => any): any {
    const currentData = this.getData(key);
    const updatedData = updateFn(currentData);
    this.saveData(key, updatedData);
    return updatedData;
  }

  deleteData(key: string): void {
    const currentAdmin = this.getCurrentAdmin();
    if (!currentAdmin) {
      throw new Error('No admin logged in');
    }

    const adminKey = this.getAdminKey(currentAdmin.id, key);
    localStorage.removeItem(adminKey);
  }

  /**
   * Read namespaced data for a specific admin without requiring them to be the current admin.
   * This is safe for read-only access from public (student) flows.
   */
  getDataForAdmin(adminId: string, key: string): any {
    const adminKey = this.getAdminKey(adminId, key);
    const data = localStorage.getItem(adminKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Find a student across all admins by credentials without mutating current admin context.
   */
  findStudentByCredentials(
    username: string,
    password: string
  ): { status: 'not_found' | 'inactive' | 'match'; student: Student | null; adminId: string | null } {
    const admins = this.getAdmins();
    let lastInactive: { student: Student; adminId: string } | null = null;

    for (const admin of admins) {
      const students: Student[] = this.getDataForAdmin(admin.id, 'students') || [];
      const match = students.find(s => s.username === username);
      if (!match) continue;

      if (match.password !== password) {
        continue;
      }

      if (match.status === 'inactive') {
        lastInactive = { student: match, adminId: admin.id };
        continue;
      }

      return { status: 'match', student: match, adminId: admin.id };
    }

    if (lastInactive) {
      return { status: 'inactive', student: lastInactive.student, adminId: lastInactive.adminId };
    }

    return { status: 'not_found', student: null, adminId: null };
  }

  // Convenience methods for common data types
  getStudents(): Student[] {
    return this.getData('students') || [];
  }

  saveStudents(students: Student[]): void {
    const normalized = students.map(student => ({
      ...student,
      role: 'student',
    }));
    this.saveData('students', normalized);
  }

  getGroups(): Group[] {
    return this.getData('groups') || [];
  }

  saveGroups(groups: Group[]): void {
    this.saveData('groups', groups);
  }

  getMaterials(): Material[] {
    return this.getData('materials') || [];
  }

  saveMaterials(materials: Material[]): void {
    this.saveData('materials', materials);
  }

  getScores(): Score[] {
    return this.getData('scores') || [];
  }

  saveScores(scores: Score[]): void {
    this.saveData('scores', scores);
  }

  getAttendance(): Attendance[] {
    return this.getData('attendance') || [];
  }

  saveAttendance(attendance: Attendance[]): void {
    this.saveData('attendance', attendance);
  }

  getPayments(): Payment[] {
    return this.getData('payments') || [];
  }

  savePayments(payments: Payment[]): void {
    this.saveData('payments', payments);
  }

  getParents(): Parent[] {
    return this.getData('parents') || [];
  }

  saveParents(parents: Parent[]): void {
    const normalized = parents.map(parent => ({
      ...parent,
      role: 'parent',
    }));
    this.saveData('parents', normalized);
  }

  /**
   * Find a parent across all admins by credentials without mutating current admin context.
   */
  findParentByCredentials(
    username: string,
    password: string
  ): { status: 'not_found' | 'match'; parent: Parent | null; adminId: string | null } {
    const admins = this.getAdmins();

    for (const admin of admins) {
      const parents: Parent[] = this.getDataForAdmin(admin.id, 'parents') || [];
      const match = parents.find(p => p.username === username);
      if (!match) continue;

      if (match.password !== password) {
        continue;
      }

      return { status: 'match', parent: match, adminId: admin.id };
    }

    return { status: 'not_found', parent: null, adminId: null };
  }
}

// Export singleton instance
export const adminStorage = new AdminStorage();
