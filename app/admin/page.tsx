'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeLanguageToggle } from '@/components/theme-language-toggle';
import { useApp } from '@/lib/app-context';
import { getStudents, getGroups, getPayments, getAttendance } from '@/lib/storage';
import {
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  GraduationCap,
  LogOut,
  Shield
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const { t, currentAdmin, logoutAdmin } = useApp();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeGroups: 0,
    pendingPayments: 0,
    todayAttendance: 0
  });

  useEffect(() => {
    if (!currentAdmin) {
      router.push('/');
      return;
    }

    setUser(currentAdmin);
    loadStats();
  }, [currentAdmin, router]);

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      // Force component re-render when theme changes
      loadStats();
    };

    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  const loadStats = async () => {
    try {
      const students = await getStudents();
      const groups = await getGroups();
      const payments = await getPayments();
      const attendance = await getAttendance();

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      setStats({
        totalStudents: students.length,
        activeGroups: groups.length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        todayAttendance: attendance.filter(a => a.date === today).length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fallback to empty stats if no admin logged in
      setStats({
        totalStudents: 0,
        activeGroups: 0,
        pendingPayments: 0,
        todayAttendance: 0
      });
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    router.push('/');
  };

  if (!user) return null;
  const menuItems = [
    { icon: Users, label: t('students'), href: '/admin/students', color: 'from-blue-500 to-blue-600' },
    { icon: Users, label: t('parents'), href: '/admin/parents', color: 'from-purple-500 to-pink-600' },
    { icon: BookOpen, label: t('groups'), href: '/admin/groups', color: 'from-purple-500 to-purple-600' },
    { icon: FileText, label: t('materials'), href: '/admin/materials', color: 'from-green-500 to-green-600' },
    ...(currentAdmin?.username === 'kevin_teacher' ? [{ icon: Shield, label: t('manage_admins'), href: '/admin/admins', color: 'from-red-500 to-red-600' }] : []),
    { icon: BarChart3, label: t('scores'), href: '/admin/scores', color: 'from-orange-500 to-orange-600' },
    { icon: Calendar, label: t('attendance'), href: '/admin/attendance', color: 'from-pink-500 to-pink-600' },
    { icon: DollarSign, label: t('payments'), href: '/admin/payments', color: 'from-teal-500 to-teal-600' },
  ];

  const statCards = [
    { label: t('total_students'), value: stats.totalStudents, icon: Users, color: 'bg-blue-500', href: '/admin/students' },
    { label: t('active_groups'), value: stats.activeGroups, icon: BookOpen, color: 'bg-purple-500', href: '/admin/groups' },
    { label: t('pending_payments'), value: stats.pendingPayments, icon: DollarSign, color: 'bg-orange-500', href: '/admin/payments' },
    { label: t('today_attendance'), value: stats.todayAttendance, icon: Calendar, color: 'bg-green-500', href: '/admin/attendance' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kevin's Academy</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeLanguageToggle />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => router.push(stat.href)}
              className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-xl transition-all hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <div className={`${stat.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              onClick={() => router.push(item.href)}
              className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all group hover:scale-105"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{item.label}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Manage {item.label.toLowerCase()}</p>
            </motion.button>
          ))}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 dark:from-red-600 dark:via-red-700 dark:to-purple-800 rounded-2xl p-8 text-white shadow-2xl"
        >
          <h2 className="text-2xl font-bold mb-4">{t('quick_actions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/admin/students')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 text-left transition-all"
            >
              <p className="font-semibold">{t('add_new_student')}</p>
              <p className="text-sm opacity-90 mt-1">Create student account</p>
            </button>
            <button
              onClick={() => router.push('/admin/groups')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 text-left transition-all"
            >
              <p className="font-semibold">{t('create_group')}</p>
              <p className="text-sm opacity-90 mt-1">Setup new class group</p>
            </button>
            <button
              onClick={() => router.push('/admin/materials')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 text-left transition-all"
            >
              <p className="font-semibold">{t('upload_material')}</p>
              <p className="text-sm opacity-90 mt-1">Add learning resources</p>
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}