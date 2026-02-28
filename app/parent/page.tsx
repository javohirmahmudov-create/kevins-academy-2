'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeLanguageToggle } from '@/components/theme-language-toggle';
import { useApp } from '@/lib/app-context';
import { getDataForAdmin, Student, Score, Attendance, Payment, Parent } from '@/lib/storage';
import {
  User,
  Calendar,
  DollarSign,
  LogOut,
  GraduationCap,
  TrendingUp,
  CheckCircle,
  XCircle
} from 'lucide-react';

type ParentSession = Parent & { adminId: string };

interface ChildSummary {
  name: string;
  group: string;
  attendanceRate: number;
  overallScore: number;
  paymentStatus: Payment['status'];
  nextPaymentDue: string;
}

interface SkillBreakdown {
  key: string;
  label: string;
  score: number;
}

interface ActivityItem {
  type: 'score' | 'attendance';
  title: string;
  description: string;
  date: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { currentParent, logoutParent, t } = useApp();
  const [parentSession, setParentSession] = useState<ParentSession | null>(null);
  const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
  const [skills, setSkills] = useState<SkillBreakdown[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChildData = async (sessionParent: ParentSession) => {
    setLoading(true);
    setError(null);

    try {
      const parents = (await getDataForAdmin(sessionParent.adminId, 'parents') as Parent[] | null) || [];
      const parentRecord = parents.find(p => p.id === sessionParent.id) || sessionParent;

      const students = (await getDataForAdmin(sessionParent.adminId, 'students') as Student[] | null) || [];
      const child = students.find(s => s.id === parentRecord.studentId);

      if (!child) {
        setChildSummary(null);
        setSkills([]);
        setRecentActivity([]);
        setError('Child record not found. Please contact the administrator.');
        return;
      }

      const scores = (await getDataForAdmin(sessionParent.adminId, 'scores') as Score[] | null) || [];
      const childScores = scores.filter(score => score.studentName === child.fullName);

      const attendance = (await getDataForAdmin(sessionParent.adminId, 'attendance') as Attendance[] | null) || [];
      const childAttendance = attendance.filter(record => record.studentName === child.fullName);

      const payments = (await getDataForAdmin(sessionParent.adminId, 'payments') as Payment[] | null) || [];
      const childPayments = payments.filter(payment => payment.studentName === child.fullName);
      const latestPayment = childPayments[childPayments.length - 1];

      const attendedCount = childAttendance.filter(record => record.status === 'present' || record.status === 'late').length;
      const attendanceRate = childAttendance.length > 0 ? Math.round((attendedCount / childAttendance.length) * 100) : 0;

      let overallScore = 0;
      const skillBreakdown: SkillBreakdown[] = [];

      if (childScores.length > 0) {
        const latestScore = childScores[childScores.length - 1];
        const scoreFields = Object.keys(latestScore).filter(key =>
          !['id', 'studentName', 'createdAt'].includes(key) && typeof latestScore[key as keyof Score] === 'number'
        );

        const total = scoreFields.reduce((sum, field) => sum + Number(latestScore[field as keyof Score] || 0), 0);
        overallScore = scoreFields.length > 0 ? Math.round(total / scoreFields.length) : 0;

        skillBreakdown.push(
          ...scoreFields
            .map(field => ({
              key: field,
              label: field
                .split('_')
                .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
                .join(' '),
              score: Number(latestScore[field as keyof Score] || 0),
            }))
            .filter(skill => skill.score > 0)
        );
      }

      const activities: ActivityItem[] = [];

      childScores.slice(-3).reverse().forEach(score => {
        const scoreFields = Object.keys(score).filter(key =>
          !['id', 'studentName', 'createdAt'].includes(key) && typeof score[key as keyof Score] === 'number'
        );
        const average = scoreFields.length > 0
          ? Math.round(scoreFields.reduce((sum, field) => sum + Number(score[field as keyof Score] || 0), 0) / scoreFields.length)
          : 0;
        activities.push({
          type: 'score',
          title: 'Test Score Received',
          description: `Average: ${average}%`,
          date: score.createdAt || new Date().toISOString(),
        });
      });

      childAttendance.slice(-3).reverse().forEach(record => {
        activities.push({
          type: 'attendance',
          title: 'Attendance Marked',
          description: `${record.status.charAt(0).toUpperCase() + record.status.slice(1)} - ${record.date}`,
          date: record.date,
        });
      });

      setChildSummary({
        name: child.fullName,
        group: child.group,
        attendanceRate,
        overallScore,
        paymentStatus: latestPayment?.status || 'pending',
        nextPaymentDue: latestPayment?.dueDate || 'N/A',
      });
      setSkills(skillBreakdown);
      setRecentActivity(
        activities
          .slice(0, 5)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch (err) {
      console.error('Failed to load parent data', err);
      setError('Failed to load data. Please try again later.');
      setChildSummary(null);
      setSkills([]);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const resolveSession = async () => {
      if (currentParent) {
        const session = currentParent as ParentSession;
        setParentSession(session);
        await loadChildData(session);
        return;
      }

      const stored = localStorage.getItem('currentParent');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ParentSession;
          setParentSession(parsed);
          await loadChildData(parsed);
          return;
        } catch (err) {
          console.warn('Failed to parse stored parent session', err);
          localStorage.removeItem('currentParent');
        }
      }

      router.replace('/');
      setLoading(false);
    };

    resolveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParent, router]);

  useEffect(() => {
    if (!parentSession) return;
    const handleThemeChange = async () => await loadChildData(parentSession);
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, [parentSession]);

  const handleLogout = () => {
    logoutParent();
    router.push('/');
  };

  if (loading) {
    return null;
  }

  if (!parentSession || !childSummary) {
    return null;
  }

  const paymentIsPaid = childSummary.paymentStatus === 'paid';

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
                <p className="text-sm text-gray-500 dark:text-gray-400">Parent Portal</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeLanguageToggle />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{parentSession?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Parent</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-red-600 dark:via-red-700 dark:to-purple-800 rounded-2xl p-8 text-white mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">Hello, {parentSession.fullName}!</h2>
          <p className="text-blue-100">Here's how your child {childSummary.name} is doing</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('child_name')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Group: {childSummary.group}</p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('attendance_rate')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.attendanceRate}%</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('overall_score')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.overallScore}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('payment_status')}</p>
                <div className="flex items-center space-x-2">
                  {paymentIsPaid ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-lg font-semibold text-green-600">{t('paid')}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-lg font-semibold text-red-600">{t('pending')}</span>
                    </>
                  )}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Next due: {childSummary.nextPaymentDue}</p>
          </motion.div>
        </div>

        {/* Skills Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('skills_progress')}</h3>
          <div className="space-y-4">
            {skills.map((skill, index) => (
              <div key={skill.key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{skill.label}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{skill.score}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${skill.score}%` }}
                    transition={{ delay: 0.7 + index * 0.1, duration: 0.8 }}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('recent_activity')}</h3>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className={`p-4 rounded-xl ${
                activity.type === 'score' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-purple-50 dark:bg-purple-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
