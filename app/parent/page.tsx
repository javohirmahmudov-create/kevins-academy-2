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
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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

interface RankingSummary {
  weeklyRank: number;
  mockRank: number;
  totalInGroup: number;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { currentParent, logoutParent, t } = useApp();
  const [parentSession, setParentSession] = useState<ParentSession | null>(null);
  const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
  const [skills, setSkills] = useState<SkillBreakdown[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [ranking, setRanking] = useState<RankingSummary>({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
  const [trendData, setTrendData] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChildData = async (sessionParent: ParentSession) => {
    setLoading(true);
    setError(null);

    try {
      const parents = (await getDataForAdmin(sessionParent.adminId, 'parents') as Parent[] | null) || [];
      const parentRecord = parents.find(p => p.id === sessionParent.id) || sessionParent;

      const students = (await getDataForAdmin(sessionParent.adminId, 'students') as Student[] | null) || [];
      const child = students.find(s => String(s.id) === String(parentRecord.studentId));

      if (!child) {
        setChildSummary(null);
        setSkills([]);
        setRecentActivity([]);
        setError('Child record not found. Please contact the administrator.');
        return;
      }

      const scores = (await getDataForAdmin(sessionParent.adminId, 'scores') as Score[] | null) || [];
      const childScores = scores.filter(score =>
        String((score as any).studentId || '') === String(child.id) ||
        (score as any).studentName === child.fullName
      );

      const groupStudents = students.filter((student) => student.group === child.group);
      const groupStudentIds = new Set(groupStudents.map((student) => String(student.id)));
      const groupScores = scores.filter((score) => groupStudentIds.has(String((score as any).studentId || '')));

      const buildRankMap = (type: 'weekly' | 'mock') => {
        const latestByStudent = new Map<string, number>();
        const rows = groupScores
          .filter((row: any) => (row.scoreType || 'weekly') === type)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        rows.forEach((row: any) => {
          const sid = String(row.studentId || '');
          if (!sid || latestByStudent.has(sid)) return;
          latestByStudent.set(sid, Number(row.overallPercent ?? row.value ?? 0));
        });

        const ranked = groupStudents
          .map((student) => ({ studentId: String(student.id), score: latestByStudent.get(String(student.id)) ?? 0 }))
          .sort((a, b) => b.score - a.score);

        let lastScore: number | null = null;
        let currentRank = 0;
        const rankMap = new Map<string, number>();

        ranked.forEach((item, index) => {
          if (lastScore === null || item.score < lastScore) {
            currentRank = index + 1;
            lastScore = item.score;
          }
          rankMap.set(item.studentId, currentRank);
        });

        return rankMap;
      };

      const weeklyRankMap = buildRankMap('weekly');
      const mockRankMap = buildRankMap('mock');
      setRanking({
        weeklyRank: weeklyRankMap.get(String(child.id)) || 0,
        mockRank: mockRankMap.get(String(child.id)) || 0,
        totalInGroup: groupStudents.length,
      });

      const attendance = (await getDataForAdmin(sessionParent.adminId, 'attendance') as Attendance[] | null) || [];
      const childAttendance = attendance.filter(record =>
        String((record as any).studentId || '') === String(child.id) ||
        (record as any).studentName === child.fullName
      );

      const payments = (await getDataForAdmin(sessionParent.adminId, 'payments') as Payment[] | null) || [];
      const childPayments = payments.filter(payment =>
        String((payment as any).studentId || '') === String(child.id) ||
        (payment as any).studentName === child.fullName
      );
      const latestPayment = childPayments[childPayments.length - 1];

      const attendedCount = childAttendance.filter(record => record.status === 'present' || record.status === 'late').length;
      const attendanceRate = childAttendance.length > 0 ? Math.round((attendedCount / childAttendance.length) * 100) : 0;

      let overallScore = 0;
      const skillBreakdown: SkillBreakdown[] = [];

      if (childScores.length > 0) {
        const latestScore = childScores[childScores.length - 1];
        if (typeof (latestScore as any).value === 'number') {
          overallScore = Math.round(Number((latestScore as any).value));
          skillBreakdown.push({
            key: 'overall',
            label: (latestScore as any).subject ? `Subject: ${(latestScore as any).subject}` : 'Overall',
            score: overallScore,
          });
        } else {
        const scoreFields = Object.keys(latestScore).filter(key =>
          !['id', 'studentId', 'studentName', 'createdAt'].includes(key) && typeof latestScore[key as keyof Score] === 'number'
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
      }

      const latestRelevantScores = childScores
        .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .slice(-8);

      const trend = latestRelevantScores.map((score: any) => {
        const base: Record<string, any> = {
          label: new Date(score.createdAt || Date.now()).toLocaleDateString(),
          overall: Number(score.overallPercent ?? score.value ?? 0),
          type: score.scoreType || 'weekly',
        };

        if (score.breakdown && typeof score.breakdown === 'object') {
          Object.entries(score.breakdown as Record<string, any>).forEach(([key, value]) => {
            if (value && typeof value === 'object' && typeof (value as any).percent === 'number') {
              base[key] = Number((value as any).percent);
            } else if (typeof value === 'number') {
              base[key] = Number(value);
            }
          });
        }

        return base;
      });
      setTrendData(trend);

      const activities: ActivityItem[] = [];

      childScores.slice(-3).reverse().forEach(score => {
        const average = typeof (score as any).value === 'number'
          ? Math.round(Number((score as any).value))
          : (() => {
              const scoreFields = Object.keys(score).filter(key =>
                !['id', 'studentId', 'studentName', 'createdAt'].includes(key) && typeof score[key as keyof Score] === 'number'
              );
              return scoreFields.length > 0
                ? Math.round(scoreFields.reduce((sum, field) => sum + Number(score[field as keyof Score] || 0), 0) / scoreFields.length)
                : 0;
            })();
        activities.push({
          type: 'score',
          title: 'Test Score Received',
          description: `${(score as any).subject || 'Overall'}: ${average}%`,
          date: score.createdAt || new Date().toISOString(),
        });
      });

      childAttendance.slice(-3).reverse().forEach(record => {
        const recordStatus = String(record.status || 'unknown');
        const statusLabel = recordStatus.charAt(0).toUpperCase() + recordStatus.slice(1);
        const recordDate = record.date || new Date().toISOString();
        activities.push({
          type: 'attendance',
          title: 'Attendance Marked',
          description: `${statusLabel} - ${recordDate}`,
          date: recordDate,
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
      setRanking({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
      setTrendData([]);
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

  if (!parentSession) {
    return null;
  }

  if (!childSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Group Ranking</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Weekly Rank</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {ranking.weeklyRank > 0 ? `#${ranking.weeklyRank}` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Mock Exam Rank</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                    {ranking.mockRank > 0 ? `#${ranking.mockRank}` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Group Size</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-300">{ranking.totalInGroup || 0}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Criteria Trend</h3>
              {trendData.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Not enough score data yet.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="overall" name="Overall" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="vocabulary" stroke="#0ea5e9" dot={false} />
                      <Line type="monotone" dataKey="grammar" stroke="#8b5cf6" dot={false} />
                      <Line type="monotone" dataKey="translation" stroke="#14b8a6" dot={false} />
                      <Line type="monotone" dataKey="attendance" stroke="#22c55e" dot={false} />
                      <Line type="monotone" dataKey="listening" stroke="#f97316" dot={false} />
                      <Line type="monotone" dataKey="reading" stroke="#eab308" dot={false} />
                      <Line type="monotone" dataKey="speaking" stroke="#ec4899" dot={false} />
                      <Line type="monotone" dataKey="writing" stroke="#ef4444" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kevin's Academy</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Parent Portal</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Parent account connected</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {error || 'Child data not linked yet. Please ask admin to re-save this parent with the correct student.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
            >
              Back to Login
            </button>
          </div>
        </main>
      </div>
    );
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
