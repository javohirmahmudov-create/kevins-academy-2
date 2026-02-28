'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, User, Users, UserCircle } from 'lucide-react';
import { useApp } from '@/lib/app-context';
// import the individual helpers instead of the whole object.  Turbopack
// sometimes initializes the singleton late, leaving methods undefined if you
// call them off `adminStorage` directly.
import {
  getAdmins,
  createAdmin,
  getAdminByUsername,
  updateAdmin,
} from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const {
    loginAdmin,
    isAdminAuthenticated,
    loginStudent,
    loginParent,
    impersonationWarning,
    clearImpersonationWarning,
    t
  } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'admin' | 'student' | 'parent'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Demo adminlarni xavfsiz yaratish useEffect'i
  useEffect(() => {
    // 🛡️ HIMOYA FILTRI: Agar helperlar haligacha funksiyalarga aylantirilmagan
    // bo'lsa, davom etma (Turbopack jadal qayta yuklash vaqtida muammo bo'lishi
    // mumkin).
    if (typeof getAdmins !== 'function' || typeof createAdmin !== 'function') {
      console.log('⏳ Storage funksiyalarini yuklashni kutyapmiz...');
      return;
    }

    try {
      const existingAdmins = getAdmins();
      
      let demoAdmin = existingAdmins.find(admin => admin.username === 'admin');
      let kevinAdmin = existingAdmins.find(admin => admin.username === 'kevin_teacher');

      // Adminlar yo'q bo'lsa yaratish, bor bo'lsa parolni yangilab qo'yish
      if (!demoAdmin) {
        createAdmin({
          username: 'admin',
          password: 'admin123',
          fullName: 'Demo Administrator',
          email: 'admin@kevinsacademy.com'
        });
      }

      if (!kevinAdmin) {
        createAdmin({
          username: 'kevin_teacher',
          password: 'kevin_0209',
          fullName: 'Kevin Teacher',
          email: 'kevin@kevinsacademy.com'
        });
      } else if (kevinAdmin.password !== 'kevin_0209') {
        updateAdmin(kevinAdmin.id, { password: 'kevin_0209' });
      }

      console.log('✅ Tizim tayyor: Demo adminlar bazada!');
    } catch (err) {
      console.error('❌ Demo yaratishda xato:', err);
    }
  }, []);

  // 2. Login qilish logikasi
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (userType === 'admin') {
        // API yo'qligini hisobga olib, lokal saqlovdan tekshiramiz
        const admin = getAdminByUsername(username);
        if (admin && admin.password === password) {
          // kontekstni yangilash uchun oddiyroq yo'l:
          // lokal saqlovga yozamiz va router orqali panelga o'tamiz.
          localStorage.setItem('currentAdmin', JSON.stringify(admin));
          // agar mavjud bo'lsa, loginAdmin funksiyasini chaqir, lekin unga bog'lanmaslik uchun
          // tarmoq xatolarini e'tiborsiz qoldiramiz
          loginAdmin(username, password).catch(() => {});
          router.push('/admin');
          return;
        } else {
          setError('Login yoki parol xato!');
        }
      } else if (userType === 'student') {
        const result = await loginStudent(username, password, { impersonate: isAdminAuthenticated });
        if (result.success) {
          router.push('/student');
        } else {
          setError(result.reason === 'inactive' ? 'Hisob faol emas' : 'Login yoki parol xato!');
        }
      } else {
        const parentResult = await loginParent(username, password);
        if (parentResult.success) {
          router.push('/parent');
        } else {
          setError('Login yoki parol xato!');
        }
      }
    } catch (err) {
      setError('Tizimga kirishda kutilmagan xato!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-red-600 dark:to-purple-800 rounded-2xl mb-4 shadow-lg"
          >
            <GraduationCap className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-red-600 dark:to-purple-600 bg-clip-text text-transparent">
            Kevin's Academy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Advanced English Education System</p>
        </div>

        {impersonationWarning && (
          <div className="mb-4 bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm flex justify-between">
            <span>Student rejimidasiz. Admin panelga qaytish uchun chiqib keting.</span>
            <button onClick={clearImpersonationWarning} className="underline font-bold">Yopish</button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
        >
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
            {userType === 'admin' ? t('admin_login') : userType === 'student' ? 'Student Login' : 'Parent Login'}
          </h2>

          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
            {(['admin', 'student', 'parent'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setUserType(type)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                  userType === type ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-500'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Kiriting..."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {loading ? 'Kutilmoqda...' : t('login')}
            </button>
          </form>
        </motion.div>

        <p className="text-center text-gray-500 text-sm mt-6">© 2024 Kevin's Academy.</p>
      </motion.div>
    </div>
  );
}
