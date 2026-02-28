// src/lib/storage.ts yoki mos yo'l

export type AuthRole = 'admin' | 'student' | 'parent';

export interface Admin {
  id: string;
  role?: 'admin';
  username: string;
  password?: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

// src/lib/storage.ts

export class AdminStorage {
  // Metodlarni arrow function qilib yozamiz (bu Turbopack-da xatolikni oldini oladi)
  getAdmins = (): Admin[] => {
    if (typeof window === 'undefined') return [];
    const admins = localStorage.getItem('kevins_academy_admins');
    return admins ? JSON.parse(admins) : [];
  };

  getAdminByUsername = (username: string): Admin | null => {
    const admins = this.getAdmins();
    return admins.find(a => a.username === username) || null;
  };

  createAdmin = (adminData: any): Admin => {
    const admins = this.getAdmins();
    const newAdmin = { ...adminData, id: `admin_${Date.now()}`, isActive: true };
    admins.push(newAdmin);
    localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));
    return newAdmin;
  };

  updateAdmin = (id: string, data: Partial<Admin>): void => {
    const admins = this.getAdmins();
    const index = admins.findIndex(a => a.id === id);
    if (index !== -1) {
      admins[index] = { ...admins[index], ...data };
      localStorage.setItem('kevins_academy_admins', JSON.stringify(admins));
    }
  };

  getCurrentAdminData = (): Admin | null => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('currentAdmin');
    return saved ? JSON.parse(saved) : null;
  };

  logoutAdmin = () => {
    localStorage.removeItem('currentAdmin');
  };
}

export const adminStorage = new AdminStorage();

// helpers exported individually so users can import functions directly and avoid
// having to rely on the singleton object being resolved correctly during
// Turbopack/ESM initialization.  This also sidesteps cases where `adminStorage`
// is imported but its prototype methods haven't been attached yet and thus
// `createAdmin` is undefined.

export const getAdmins = (...args: Parameters<AdminStorage['getAdmins']>) =>
  adminStorage.getAdmins(...args);
export const getAdminByUsername = (
  ...args: Parameters<AdminStorage['getAdminByUsername']>
) => adminStorage.getAdminByUsername(...args);
export const createAdmin = (
  ...args: Parameters<AdminStorage['createAdmin']>
) => adminStorage.createAdmin(...args);
export const updateAdmin = (
  ...args: Parameters<AdminStorage['updateAdmin']>
) => adminStorage.updateAdmin(...args);
