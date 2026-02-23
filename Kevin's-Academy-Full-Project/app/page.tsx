'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, User, Users, UserCircle } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { adminStorage } from '@/lib/storage';

// Demo admin yaratish uchun import
import '@/scripts/create-demo-admin';

export default function Home() {
  const router = useRouter();
  const {
    loginAdmin,
    isAdminAuthenticated,
    loginStudent,
    loginParent,
    sessionState,
    impersonationWarning,
    clearImpersonationWarning,
    t
  } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'admin' | 'student' | 'parent'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo admin yaratish
  useEffect(() => {
    try {
      console.log('🔄 Setting up demo admins...');
      const existingAdmins = adminStorage.getAdmins();
      console.log('📋 Existing admins:', existingAdmins.length);

      // Agar admin yo'q bo'lsa yoki eski parol bilan bo'lsa, yaratish/yangilash
      let demoAdmin = existingAdmins.find(admin => admin.username === 'admin');
      let kevinAdmin = existingAdmins.find(admin => admin.username === 'kevin_teacher');

      console.log('👤 Demo admin found:', !!demoAdmin);
      console.log('👨‍🏫 Kevin admin found:', !!kevinAdmin);

      // Admin parollarini tekshirish va yangilash
      if (demoAdmin && demoAdmin.password !== 'admin123') {
        console.log('🔐 Updating demo admin password...');
        adminStorage.updateAdmin(demoAdmin.id, { password: 'admin123' });
        demoAdmin = adminStorage.getAdminByUsername('admin') || demoAdmin;
      }

      if (kevinAdmin && kevinAdmin.password !== 'kevin_0209') {
        console.log('🔐 Updating kevin admin password...');
        adminStorage.updateAdmin(kevinAdmin.id, { password: 'kevin_0209' });
        kevinAdmin = adminStorage.getAdminByUsername('kevin_teacher') || kevinAdmin;
      }

      // Agar adminlar umuman yo'q bo'lsa, yaratish
      if (!demoAdmin) {
        console.log('➕ Creating demo admin...');
        demoAdmin = adminStorage.createAdmin({
          username: 'admin',
          password: 'admin123',
          fullName: 'Demo Administrator',
          email: 'admin@kevinsacademy.com'
        });
      }

      if (!kevinAdmin) {
        console.log('➕ Creating kevin admin...');
        kevinAdmin = adminStorage.createAdmin({
          username: 'kevin_teacher',
          password: 'kevin_0209',
          fullName: 'Kevin Teacher',
          email: 'kevin@kevinsacademy.com'
        });
      }

      console.log('✅ Demo admins ready!');
      console.log('📊 Final admin count:', adminStorage.getAdmins().length);
      console.log('🔑 Current Kevin admin password:', kevinAdmin?.password);
    } catch (error) {
      console.error('❌ Error setting up demo admins:', error);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting login for:', username, 'as', userType);
      if (userType === 'admin') {
        const success = await loginAdmin(username, password);
        if (success) {
          console.log('🎉 Admin login successful, redirecting...');
          router.push('/admin');
          return;
        }
        console.log('❌ Admin login failed');
        setError('Invalid username or password');
        return;
      }

      if (userType === 'student') {
        const result = await loginStudent(username, password, { impersonate: isAdminAuthenticated });
        if (result.success) {
          console.log('🎉 Student login successful, redirecting...');
          router.push('/student');
        } else if (result.reason === 'inactive') {
          setError('This student account is inactive.');
        } else {
          setError('Invalid username or password');
        }
        return;
      }

      const parentResult = await loginParent(username, password);
      if (parentResult.success) {
        console.log('🎉 Parent login successful, redirecting...');
        router.push('/parent');
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('💥 Login error:', err);
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-red-600 dark:to-purple-800 rounded-2xl mb-4 shadow-lg"
          >
            <GraduationCap className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-red-600 dark:to-purple-600 bg-clip-text text-transparent">
            Kevin's Academy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Advanced English Education System</p>
        </div>

        {/* Impersonation Warning */}
        {impersonationWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">You are viewing as a student.</p>
                <p className="text-xs">Log out from the student portal to return to admin mode.</p>
              </div>
              <button
                onClick={clearImpersonationWarning}
                className="text-xs underline hover:text-yellow-900"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
        >
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
            {userType === 'admin' ? t('admin_login') : userType === 'student' ? 'Student Login' : 'Parent Login'}
          </h2>

          {/* User Type Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
            <button
              onClick={() => setUserType('admin')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                userType === 'admin'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Admin
            </button>
            <button
              onClick={() => setUserType('student')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                userType === 'student'
                  ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Student
            </button>
            <button
              onClick={() => setUserType('parent')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                userType === 'parent'
                  ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <UserCircle className="w-4 h-4 inline mr-2" />
              Parent
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {userType === 'admin' ? t('admin_username') : userType === 'student' ? 'Student Username' : 'Parent Username'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {userType === 'admin' ? t('admin_password') : userType === 'student' ? 'Student Password' : 'Parent Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 dark:from-red-600 dark:to-purple-800 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : t('login')}
            </button>
          </form>

        </motion.div>

        {/* Footer */}
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          © 2024 Kevin's Academy. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
