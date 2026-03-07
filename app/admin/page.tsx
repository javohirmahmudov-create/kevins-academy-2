'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeLanguageToggle } from '@/components/theme-language-toggle';
import { useApp } from '@/lib/app-context';
import { getStudents, getGroups, getPayments, getAttendance, updateAdmin } from '@/lib/storage';
import {
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Activity,
  GraduationCap,
  LogOut,
  Shield,
  Brain,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

type DisconnectedParentRow = {
  parentId: number;
  parentName: string;
  parentPhone: string;
  studentId: number | null;
  studentName: string;
  level: string;
  statusText: string;
  disconnectedAt: string;
  lastError?: string;
}

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
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [disconnectedRows, setDisconnectedRows] = useState<DisconnectedParentRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showDisconnectedPanel, setShowDisconnectedPanel] = useState(false);

  useEffect(() => {
    if (!currentAdmin) {
      router.push('/');
      return;
    }

    setUser(currentAdmin);
    setNotifyTelegram(currentAdmin?.notifyTelegram !== false);
    setNotifySms(currentAdmin?.notifySms !== false);
    loadStats();
    loadDisconnectedAlerts();
  }, [currentAdmin, router]);

  useEffect(() => {
    if (!currentAdmin?.id) return;
    const timer = setInterval(() => {
      loadDisconnectedAlerts();
    }, 20000);

    return () => clearInterval(timer);
  }, [currentAdmin?.id]);

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

      const isSameLocalDay = (value?: string | null, targetDate?: Date) => {
        if (!value) return false;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        const target = targetDate || new Date();
        return parsed.getFullYear() === target.getFullYear()
          && parsed.getMonth() === target.getMonth()
          && parsed.getDate() === target.getDate();
      };

      const pendingOrOverduePayments = (Array.isArray(payments) ? payments : []).filter((payment: any) => {
        const displayStatus = payment?.isOverdue ? 'overdue' : String(payment?.status || 'pending').toLowerCase();
        return displayStatus === 'pending' || displayStatus === 'overdue';
      }).length;

      const todayAttendanceCount = (Array.isArray(attendance) ? attendance : []).filter((row: any) => {
        if (isSameLocalDay(row?.date)) return true;
        if (typeof row?.date === 'string' && row.date.trim()) {
          const direct = row.date.trim().split('T')[0];
          const now = new Date();
          const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          return direct === todayLocal;
        }
        return false;
      }).length;

      setStats({
        totalStudents: students.length,
        activeGroups: groups.length,
        pendingPayments: pendingOrOverduePayments,
        todayAttendance: todayAttendanceCount
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

  const loadDisconnectedAlerts = async () => {
    if (!currentAdmin?.id) return;
    setAlertsLoading(true);
    try {
      const response = await fetch('/api/admin/alerts/disconnected-parents', {
        headers: {
          'x-admin-id': String(currentAdmin.id),
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data?.error || 'Alertlarni yuklashda xatolik'));
      }
      setDisconnectedRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error('Disconnected alerts load failed:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    router.push('/');
  };

  const dismissDisconnectedAlerts = async (parentIds: number[]) => {
    const cleanIds = Array.from(new Set((parentIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)));
    if (cleanIds.length === 0 || !currentAdmin?.id) return;

    try {
      const response = await fetch('/api/admin/alerts/disconnected-parents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': String(currentAdmin.id),
        },
        body: JSON.stringify({ parentIds: cleanIds }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(String(data?.error || 'Alertni o‘chirishda xatolik'));
      }

      await loadDisconnectedAlerts();
    } catch (error) {
      console.error('Dismiss disconnected alert failed:', error);
    }
  };

  const handleDismissDisconnectedAlert = async (parentId: number) => {
    await dismissDisconnectedAlerts([parentId]);
  };

  const handleDismissAllDisconnectedAlerts = async () => {
    await dismissDisconnectedAlerts(disconnectedRows.map((row) => Number(row.parentId)));
  };

  const saveNotificationSettings = async () => {
    if (!user?.id) return;
    setSettingsSaving(true);
    try {
      const updated = await updateAdmin(String(user.id), {
        notifyTelegram,
        notifySms,
      });

      const nextAdmin = {
        ...(currentAdmin || {}),
        ...(updated || {}),
        notifyTelegram,
        notifySms,
      };

      localStorage.setItem('currentAdmin', JSON.stringify(nextAdmin));
      setUser(nextAdmin);
    } catch (error) {
      console.error('Notification settings save failed:', error);
      alert('Settings saqlanmadi');
    } finally {
      setSettingsSaving(false);
    }
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
    { icon: Activity, label: 'Foydalanuvchilar Faolligi', href: '/admin/activity', color: 'from-amber-500 to-yellow-600' },
    { icon: ClipboardList, label: 'Task Dispatcher', href: '/admin/tasks', color: 'from-yellow-500 to-amber-600' },
    { icon: Brain, label: 'Vocabulary Live', href: '/admin/vocabulary', color: 'from-indigo-500 to-violet-600' },
  ];

  const statCards = [
    { label: t('total_students'), value: stats.totalStudents, icon: Users, color: 'bg-blue-500', href: '/admin/students' },
    { label: t('active_groups'), value: stats.activeGroups, icon: BookOpen, color: 'bg-purple-500', href: '/admin/groups' },
    { label: t('pending_payments'), value: stats.pendingPayments, icon: DollarSign, color: 'bg-orange-500', href: '/admin/payments' },
    { label: t('today_attendance'), value: stats.todayAttendance, icon: Calendar, color: 'bg-green-500', href: '/admin/attendance' },
  ];

  const visibleDisconnectedRows = disconnectedRows;

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
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('administrator')}</p>
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
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-red-500/40 bg-gradient-to-r from-black via-zinc-900 to-zinc-800 p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-base font-bold text-amber-300">🚨 Aloqasi uzilgan ota-onalar</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                {alertsLoading ? 'Yangilanmoqda...' : `${visibleDisconnectedRows.length} ta`}
              </span>
              {visibleDisconnectedRows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowDisconnectedPanel((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
                >
                  {showDisconnectedPanel ? 'Yig\'ish' : 'Ko\'rish'}
                  {showDisconnectedPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              ) : null}
            </div>
          </div>

          {visibleDisconnectedRows.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-300">Hozircha uzilgan aloqa aniqlanmadi.</p>
          ) : showDisconnectedPanel ? (
            <div className="mt-3 space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDismissAllDisconnectedAlerts}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
                >
                  <X className="w-3.5 h-3.5" />
                  Hammasini o‘chirish
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {visibleDisconnectedRows.map((row) => (
                  <div key={row.parentId} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                      <p className="text-amber-100"><span className="text-amber-300">Ota-ona / Tel:</span> {row.parentName} / {row.parentPhone || '-'}</p>
                      <p className="text-amber-100"><span className="text-amber-300">Farzandi / Level:</span> {row.studentName} - {row.level}</p>
                      <p className="text-red-300 font-semibold">{row.statusText}</p>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-amber-200 text-xs md:text-sm">{new Date(row.disconnectedAt).toLocaleString()}</p>
                        <button
                          type="button"
                          onClick={() => handleDismissDisconnectedAlert(row.parentId)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
                          title="Xabarni o‘chirish"
                        >
                          <X className="w-3 h-3" /> O‘chirish
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-200">
              {visibleDisconnectedRows.length} ta ogohlantirish mavjud. “Ko‘rish” tugmasini bosing.
            </p>
          )}
        </motion.div>

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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('manage')} {item.label.toLowerCase()}</p>
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
              <p className="text-sm opacity-90 mt-1">{t('create_student_account')}</p>
            </button>
            <button
              onClick={() => router.push('/admin/groups')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 text-left transition-all"
            >
              <p className="font-semibold">{t('create_group')}</p>
              <p className="text-sm opacity-90 mt-1">{t('setup_new_class_group')}</p>
            </button>
            <button
              onClick={() => router.push('/admin/materials')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 text-left transition-all"
            >
              <p className="font-semibold">{t('upload_material')}</p>
              <p className="text-sm opacity-90 mt-1">{t('add_learning_resources')}</p>
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="mt-8 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Settings · Bildirishnomalar</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <span className="text-sm text-gray-800 dark:text-gray-200">Telegram xabarlarini yuborish</span>
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={(e) => setNotifyTelegram(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <span className="text-sm text-gray-800 dark:text-gray-200">SMS xabarlarini yuborish</span>
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
          <button
            onClick={saveNotificationSettings}
            disabled={settingsSaving}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            {settingsSaving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </motion.div>
      </main>
    </div>
  );
}