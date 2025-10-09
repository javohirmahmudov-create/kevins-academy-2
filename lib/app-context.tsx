'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Admin, Parent, adminStorage, AuthRole } from './storage';

interface SessionState {
  role: AuthRole;
  viewedAs?: AuthRole;
}

interface AppContextType {
  // Admin authentication
  currentAdmin: Admin | null;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  isAdminAuthenticated: boolean;

  // Student authentication
  currentStudent: any | null;
  loginStudent: (
    username: string,
    password: string,
    options?: { impersonate?: boolean }
  ) => Promise<{ success: boolean; reason?: string }>;
  logoutStudent: () => void;
  isStudentAuthenticated: boolean;

  // Parent authentication
  currentParent: any | null;
  loginParent: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; reason?: string }>;
  logoutParent: () => void;
  isParentAuthenticated: boolean;
  sessionState: SessionState | null;
  impersonating: boolean;
  impersonationWarning: boolean;
  clearImpersonationWarning: () => void;

  // Language and theme (global for all users)
  language: 'uz' | 'en';
  setLanguage: (lang: 'uz' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Translation data
const translations = {
  uz: {
    // Common
    'welcome': 'Xush kelibsiz',
    'login': 'Kirish',
    'logout': 'Chiqish',
    'dashboard': 'Boshqaruv paneli',
    'students': 'O\'quvchilar',
    'parents': 'Ota-onalar',
    'groups': 'Guruhlar',
    'materials': 'Materiallar',
    'scores': 'Ballar',
    'attendance': 'Davomat',
    'payments': 'To\'lovlar',
    'add': 'Qo\'shish',
    'edit': 'Tahrirlash',
    'delete': 'O\'chirish',
    'save': 'Saqlash',
    'cancel': 'Bekor qilish',
    'search': 'Qidirish',
    'filter': 'Filtrlash',
    'export': 'Eksport',
    'import': 'Import',

    // Student
    'my_lessons': 'Mening darslarim',
    'homework': 'Uy vazifasi',
    'my_scores': 'Mening ballarim',
    'completed': 'Bajarilgan',
    'pending': 'Kutilmoqda',
    'overdue': 'Muddat tugagan',

    // Parent
    'child_name': 'Farzand nomi',
    'attendance_rate': 'Davomat darajasi',
    'overall_score': 'Umumiy ball',
    'payment_status': 'To\'lov holati',
    'skills_progress': 'Ko\'nikmalar taraqqiyoti',
    'recent_activity': 'So\'nggi faoliyat',

    // Admin
    'total_students': 'Jami o\'quvchilar',
    'active_groups': 'Faol guruhlar',
    'pending_payments': 'Kutilayotgan to\'lovlar',
    'today_attendance': 'Bugungi davomat',
    'quick_actions': 'Tezkor harakatlar',
    'add_new_student': 'Yangi o\'quvchi qo\'shish',
    'create_group': 'Guruh yaratish',
    'upload_material': 'Material yuklash',
    'manage_admins': 'Adminlarni boshqarish',

    // Status
    'paid': 'To\'langan',
    'unpaid': 'To\'lanmagan',
    'present': 'Hozir',
    'absent': 'Yo\'q',
    'late': 'Kechikdi',
    'active': 'Faol',
    'inactive': 'Faol emas',

    // Actions
    'mark_complete': 'Bajarilgan deb belgilash',
    'download': 'Yuklab olish',
    'view': 'Ko\'rish',
    'submit': 'Yuborish',
    'create': 'Yaratish',
    'update': 'Yangilash',
    'remove': 'O\'chirish',

    // Admin specific
    'admin_login': 'Admin kirishi',
    'admin_username': 'Admin nomi',
    'admin_password': 'Admin paroli',
    'create_admin': 'Admin yaratish',
    'admin_list': 'Adminlar ro\'yxati',
    'admin_management': 'Admin boshqaruvi',
  },
  en: {
    // Common
    'welcome': 'Welcome',
    'login': 'Login',
    'logout': 'Logout',
    'dashboard': 'Dashboard',
    'students': 'Students',
    'parents': 'Parents',
    'groups': 'Groups',
    'materials': 'Materials',
    'scores': 'Scores',
    'attendance': 'Attendance',
    'payments': 'Payments',
    'add': 'Add',
    'edit': 'Edit',
    'delete': 'Delete',
    'save': 'Save',
    'cancel': 'Cancel',
    'search': 'Search',
    'filter': 'Filter',
    'export': 'Export',
    'import': 'Import',

    // Student
    'my_lessons': 'My Lessons',
    'homework': 'Homework',
    'my_scores': 'My Scores',
    'completed': 'Completed',
    'pending': 'Pending',
    'overdue': 'Overdue',

    // Parent
    'child_name': 'Child Name',
    'attendance_rate': 'Attendance Rate',
    'overall_score': 'Overall Score',
    'payment_status': 'Payment Status',
    'skills_progress': 'Skills Progress',
    'recent_activity': 'Recent Activity',

    // Admin
    'total_students': 'Total Students',
    'active_groups': 'Active Groups',
    'pending_payments': 'Pending Payments',
    'today_attendance': 'Today\'s Attendance',
    'quick_actions': 'Quick Actions',
    'add_new_student': 'Add New Student',
    'create_group': 'Create Group',
    'upload_material': 'Upload Material',
    'manage_admins': 'Manage Admins',

    // Status
    'paid': 'Paid',
    'unpaid': 'Unpaid',
    'present': 'Present',
    'absent': 'Absent',
    'late': 'Late',
    'active': 'Active',
    'inactive': 'Inactive',

    // Actions
    'mark_complete': 'Mark as Complete',
    'download': 'Download',
    'view': 'View',
    'submit': 'Submit',
    'create': 'Create',
    'update': 'Update',
    'remove': 'Remove',

    // Admin specific
    'admin_login': 'Admin Login',
    'admin_username': 'Admin Username',
    'admin_password': 'Admin Password',
    'create_admin': 'Create Admin',
    'admin_list': 'Admin List',
    'admin_management': 'Admin Management',
  }
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Admin authentication state
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Student authentication state
  const [currentStudent, setCurrentStudent] = useState<any | null>(null);
  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState(false);

  // Parent authentication state
  const [currentParent, setCurrentParent] = useState<any | null>(null);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [impersonationWarning, setImpersonationWarning] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const savedLanguage = localStorage.getItem('kevins_academy_language') as 'uz' | 'en' || 'uz';
    const savedTheme = localStorage.getItem('kevins_academy_theme') as 'light' | 'dark' || 'light';

    setLanguage(savedLanguage);
    setTheme(savedTheme);

    // Load current admin
    const savedAdmin = adminStorage.getCurrentAdminData();
    if (savedAdmin) {
      setCurrentAdmin(savedAdmin);
      setIsAdminAuthenticated(true);
      setSessionState({ role: 'admin' });
    }

    const savedStudentRaw = localStorage.getItem('currentStudent');
    if (savedStudentRaw) {
      try {
        const parsed = JSON.parse(savedStudentRaw);
        setCurrentStudent(parsed);
        setIsStudentAuthenticated(true);
        setSessionState(prev => prev ? prev : { role: (parsed.role as AuthRole) || 'student' });
      } catch (err) {
        console.warn('Failed to parse stored student session', err);
        localStorage.removeItem('currentStudent');
      }
    }

    const savedParentRaw = localStorage.getItem('currentParent');
    if (savedParentRaw) {
      try {
        const parsed = JSON.parse(savedParentRaw);
        setCurrentParent(parsed);
        setIsParentAuthenticated(true);
        setSessionState(prev => prev ? prev : { role: (parsed.role as AuthRole) || 'parent' });
      } catch (err) {
        console.warn('Failed to parse stored parent session', err);
        localStorage.removeItem('currentParent');
      }
    }
  }, []);

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('kevins_academy_language', language);
    localStorage.setItem('kevins_academy_theme', theme);

    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      // Force re-render by updating a CSS custom property
      document.documentElement.style.setProperty('--theme-transition', Date.now().toString());
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.setProperty('--theme-transition', Date.now().toString());
    }

    // Debug log
    console.log('Theme changed to:', theme, 'Dark class:', document.documentElement.classList.contains('dark'));
  }, [language, theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // Force re-render by triggering a state change in parent
    // This will be caught by useEffect in the parent component
    window.dispatchEvent(new CustomEvent('themeChanged'));
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'uz' ? 'en' : 'uz');
  };

  const setLanguageState = (lang: 'uz' | 'en') => {
    setLanguage(lang);
  };

  const setThemeState = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  // Admin authentication functions
  const loginAdmin = async (username: string, password: string): Promise<boolean> => {
    try {
      const admin = adminStorage.authenticateAdmin(username, password);
      if (admin) {
        setCurrentAdmin(admin);
        setIsAdminAuthenticated(true);
        setSessionState({ role: 'admin' });
        setImpersonationWarning(false);
        if (currentStudent) {
          logoutStudent();
        }
        if (currentParent) {
          logoutParent();
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };

  const logoutAdmin = () => {
    adminStorage.logoutAdmin();
    setCurrentAdmin(null);
    setIsAdminAuthenticated(false);
    setSessionState(currentStudent ? { role: 'student' } : currentParent ? { role: 'parent' } : null);
  };

  // Student authentication functions
  const loginStudent = async (
    username: string,
    password: string,
    options?: { impersonate?: boolean }
  ): Promise<{ success: boolean; reason?: string }> => {
    try {
      const result = adminStorage.findStudentByCredentials(username, password);

      if (result.status === 'inactive') {
        return { success: false, reason: 'inactive' };
      }

      if (result.status === 'match' && result.student && result.adminId) {
        const sessionStudent = {
          ...result.student,
          adminId: result.adminId,
          role: 'student',
        } as any;

        setCurrentStudent(sessionStudent);
        setIsStudentAuthenticated(true);
        localStorage.setItem('currentStudent', JSON.stringify(sessionStudent));

        if (options?.impersonate && isAdminAuthenticated && currentAdmin) {
          setSessionState({ role: 'admin', viewedAs: 'student' });
          setImpersonationWarning(true);
        } else {
          if (currentAdmin) {
            adminStorage.logoutAdmin();
            setCurrentAdmin(null);
            setIsAdminAuthenticated(false);
          }
          if (currentParent) {
            setCurrentParent((prev: Parent | null) => {
              if (!prev) return prev;
              localStorage.removeItem('currentParent');
              return null;
            });
            setIsParentAuthenticated(false);
          }
          setSessionState({ role: 'student' });
          setImpersonationWarning(false);
        }

        return { success: true };
      }

      return { success: false, reason: 'not_found' };
    } catch (error) {
      console.error('Student login error:', error);
      return { success: false, reason: 'error' };
    }
  };

  const logoutStudent = () => {
    setCurrentStudent(null);
    setIsStudentAuthenticated(false);
    localStorage.removeItem('currentStudent');
    setSessionState(currentAdmin ? { role: 'admin' } : currentParent ? { role: 'parent' } : null);
  };

  // Parent authentication functions
  const loginParent = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; reason?: string }> => {
    try {
      const result = adminStorage.findParentByCredentials(username, password);

      if (result.status === 'match' && result.parent && result.adminId) {
        const sessionParent = {
          ...result.parent,
          adminId: result.adminId,
          role: 'parent',
        } as any;
        setCurrentParent(sessionParent);
        setIsParentAuthenticated(true);
        localStorage.setItem('currentParent', JSON.stringify(sessionParent));

        if (currentStudent) {
          setCurrentStudent((prev: any | null) => {
            if (!prev) return prev;
            localStorage.removeItem('currentStudent');
            return null;
          });
          setIsStudentAuthenticated(false);
        }
        if (currentAdmin) {
          adminStorage.logoutAdmin();
          setCurrentAdmin(null);
          setIsAdminAuthenticated(false);
        }

        setSessionState({ role: 'parent' });
        setImpersonationWarning(false);
        return { success: true };
      }

      return { success: false, reason: 'not_found' };
    } catch (error) {
      console.error('Parent login error:', error);
      return { success: false, reason: 'error' };
    }
  };

  const logoutParent = () => {
    setCurrentParent(null);
    setIsParentAuthenticated(false);
    localStorage.removeItem('currentParent');
    setSessionState(currentAdmin ? { role: 'admin' } : currentStudent ? { role: 'student' } : null);
  };

  const clearImpersonationWarning = () => setImpersonationWarning(false);

  const impersonating = Boolean(sessionState?.role === 'admin' && sessionState.viewedAs === 'student');

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <AppContext.Provider value={{
      // Admin authentication
      currentAdmin,
      loginAdmin,
      logoutAdmin,
      isAdminAuthenticated,

      // Student authentication
      currentStudent,
      loginStudent,
      logoutStudent,
      isStudentAuthenticated,

      currentParent,
      loginParent,
      logoutParent,
      isParentAuthenticated,
      sessionState,
      impersonating,
      impersonationWarning,
      clearImpersonationWarning,

      // Language and theme
      language,
      setLanguage: setLanguageState,
      theme,
      setTheme: setThemeState,
      toggleTheme,
      toggleLanguage,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
};
