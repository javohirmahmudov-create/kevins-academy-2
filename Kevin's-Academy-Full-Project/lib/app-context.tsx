'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Eski storage importini olib tashladik yoki faqat turlar (interface) uchun qoldirdik
// import { Admin, Parent, AuthRole } from './storage'; 

// Turlarni shu yerning o'zida ham e'lon qilish mumkin yoki alohida types.ts ga ko'chirish
export type AuthRole = 'admin' | 'student' | 'parent';

interface SessionState {
  role: AuthRole;
  viewedAs?: AuthRole;
}

interface AppContextType {
  currentAdmin: any | null;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  isAdminAuthenticated: boolean;

  currentStudent: any | null;
  loginStudent: (username: string, password: string, options?: { impersonate?: boolean }) => Promise<{ success: boolean; reason?: string }>;
  logoutStudent: () => void;
  isStudentAuthenticated: boolean;

  currentParent: any | null;
  loginParent: (username: string, password: string) => Promise<{ success: boolean; reason?: string }>;
  logoutParent: () => void;
  isParentAuthenticated: boolean;

  sessionState: SessionState | null;
  impersonating: boolean;
  impersonationWarning: boolean;
  clearImpersonationWarning: () => void;

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

// Tarjimalar obyekti o'zgarishsiz qoladi...
const translations = {
    uz: { /* ... yuqoridagi uz tarjimalari ... */ },
    en: { /* ... yuqoridagi en tarjimalari ... */ }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [currentAdmin, setCurrentAdmin] = useState<any | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<any | null>(null);
  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState(false);
  const [currentParent, setCurrentParent] = useState<any | null>(null);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);
  
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [impersonationWarning, setImpersonationWarning] = useState(false);

  useEffect(() => {
    // 1. Tizim sozlamalarini tiklash
    const savedLanguage = localStorage.getItem('kevins_academy_language') as 'uz' | 'en' || 'uz';
    const savedTheme = localStorage.getItem('kevins_academy_theme') as 'light' | 'dark' || 'light';
    setLanguage(savedLanguage);
    setTheme(savedTheme);

    // 2. Admin sessiyasini tiklash
    const savedAdmin = localStorage.getItem('currentAdmin');
    if (savedAdmin) {
      const parsed = JSON.parse(savedAdmin);
      setCurrentAdmin(parsed);
      setIsAdminAuthenticated(true);
      setSessionState({ role: 'admin' });
    }

    // 3. Student sessiyasini tiklash
    const savedStudent = localStorage.getItem('currentStudent');
    if (savedStudent) {
      const parsed = JSON.parse(savedStudent);
      setCurrentStudent(parsed);
      setIsStudentAuthenticated(true);
      if (!savedAdmin) setSessionState({ role: 'student' });
    }

    // 4. Ota-ona sessiyasini tiklash
    const savedParent = localStorage.getItem('currentParent');
    if (savedParent) {
      const parsed = JSON.parse(savedParent);
      setCurrentParent(parsed);
      setIsParentAuthenticated(true);
      if (!savedAdmin && !savedStudent) setSessionState({ role: 'parent' });
    }
  }, []);

  // Theme useEffect o'zgarishsiz qoladi...
  useEffect(() => {
    localStorage.setItem('kevins_academy_language', language);
    localStorage.setItem('kevins_academy_theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [language, theme]);

  // --- AUTH FUNKSIYALARI (API-ga asoslangan) ---

  const loginAdmin = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const admin = await res.json();
        setCurrentAdmin(admin);
        setIsAdminAuthenticated(true);
        setSessionState({ role: 'admin' });
        localStorage.setItem('currentAdmin', JSON.stringify(admin));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };

  const logoutAdmin = () => {
    localStorage.removeItem('currentAdmin');
    setCurrentAdmin(null);
    setIsAdminAuthenticated(false);
    setSessionState(currentStudent ? { role: 'student' } : currentParent ? { role: 'parent' } : null);
  };

  const loginStudent = async (username: string, password: string, options?: { impersonate?: boolean }) => {
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await res.json();

      if (res.ok) {
        setCurrentStudent(result);
        setIsStudentAuthenticated(true);
        localStorage.setItem('currentStudent', JSON.stringify(result));

        if (options?.impersonate && isAdminAuthenticated) {
          setSessionState({ role: 'admin', viewedAs: 'student' });
          setImpersonationWarning(true);
        } else {
          setSessionState({ role: 'student' });
          setImpersonationWarning(false);
        }
        return { success: true };
      }
      return { success: false, reason: result.reason || 'not_found' };
    } catch (error) {
      return { success: false, reason: 'error' };
    }
  };

  const logoutStudent = () => {
    localStorage.removeItem('currentStudent');
    setCurrentStudent(null);
    setIsStudentAuthenticated(false);
    setSessionState(currentAdmin ? { role: 'admin' } : null);
  };

  const loginParent = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await res.json();
      if (res.ok) {
        setCurrentParent(result);
        setIsParentAuthenticated(true);
        localStorage.setItem('currentParent', JSON.stringify(result));
        setSessionState({ role: 'parent' });
        return { success: true };
      }
      return { success: false, reason: 'not_found' };
    } catch (error) {
      return { success: false, reason: 'error' };
    }
  };

  const logoutParent = () => {
    localStorage.removeItem('currentParent');
    setCurrentParent(null);
    setIsParentAuthenticated(false);
    setSessionState(currentAdmin ? { role: 'admin' } : null);
  };

  // Yordamchi funksiyalar
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(prev => prev === 'uz' ? 'en' : 'uz');
  const t = (key: string) => (translations[language] as any)[key] || key;
  const clearImpersonationWarning = () => setImpersonationWarning(false);
  const impersonating = Boolean(sessionState?.role === 'admin' && sessionState.viewedAs === 'student');

  return (
    <AppContext.Provider value={{
      currentAdmin, loginAdmin, logoutAdmin, isAdminAuthenticated,
      currentStudent, loginStudent, logoutStudent, isStudentAuthenticated,
      currentParent, loginParent, logoutParent, isParentAuthenticated,
      sessionState, impersonating, impersonationWarning, clearImpersonationWarning,
      language, setLanguage, theme, setTheme, toggleTheme, toggleLanguage, t
    }}>
      {children}
    </AppContext.Provider>
  );
};