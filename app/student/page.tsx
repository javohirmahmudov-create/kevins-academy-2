"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';
import { BookOpen, BarChart3, LogOut, GraduationCap, AlertCircle } from 'lucide-react';

type SkillResult = {
  key: string;
  label: string;
  score: number;
};

const skillLabels: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
};

const skillColors: Record<string, string> = {
  vocabulary: 'bg-blue-500',
  grammar: 'bg-purple-500',
  speaking: 'bg-green-500',
  reading: 'bg-orange-500',
  writing: 'bg-pink-500',
  listening: 'bg-teal-500',
};

export default function StudentDashboard() {
  const router = useRouter();
  const {
    currentStudent,
    impersonating,
    impersonationWarning,
    clearImpersonationWarning,
    logoutStudent,
  } = useApp();
  const [student, setStudent] = useState<any | null>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [skillBreakdown, setSkillBreakdown] = useState<SkillResult[]>([]);
  const [latestScoreDate, setLatestScoreDate] = useState<string | null>(null);

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent);
      return;
    }

    const stored = localStorage.getItem('currentStudent');
    if (stored) {
      try {
        setStudent(JSON.parse(stored));
      } catch {
        localStorage.removeItem('currentStudent');
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  }, [currentStudent, router]);

  useEffect(() => {
    if (!student?.adminId) return;

    (async () => {
      try {
        const adminId = student.adminId;
        const allScores = (await getDataForAdmin(adminId, 'scores')) || [];
        const studentScores = allScores.filter((s: any) => s.studentName === student.fullName);
        setScores(studentScores);

        if (studentScores.length > 0) {
          const latest = studentScores[studentScores.length - 1];
          const skills = Object.keys(latest).filter(key =>
            !['id', 'studentName', 'createdAt'].includes(key) && typeof latest[key as keyof typeof latest] === 'number'
          );
          const total = skills.reduce((sum, key) => sum + (latest[key as keyof typeof latest] || 0), 0);
          setAverageScore(skills.length > 0 ? Math.round(total / skills.length) : 0);
          setSkillBreakdown(
            skills
              .map((key) => ({
                key,
                label: skillLabels[key] || key,
                score: Number(latest[key as keyof typeof latest] ?? 0),
              }))
              .filter((skill) => skill.score > 0)
          );
          setLatestScoreDate(latest.createdAt || null);
        } else {
          setAverageScore(0);
          setSkillBreakdown([]);
          setLatestScoreDate(null);
        }
      } catch (error) {
        console.error('Error loading scores:', error);
      }
    })();
  }, [student]);

  const handleLogout = () => {
    logoutStudent();
    router.push('/');
  };

  if (!student) return null;

  const menuItems = [
    { icon: BookOpen, label: 'My Lessons', href: '/student/lessons', color: 'from-blue-500 to-blue-600' },
    { icon: BarChart3, label: 'My Scores', href: '/student/scores', color: 'from-orange-500 to-orange-600' },
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
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{student?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {impersonationWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm flex items-start justify-between"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">You are viewing as a student.</p>
                <p className="text-xs">Log out from the student portal to return to the admin dashboard.</p>
              </div>
            </div>
            <button
              onClick={clearImpersonationWarning}
              className="text-xs underline hover:text-yellow-900"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-red-600 dark:via-red-700 dark:to-purple-800 rounded-2xl p-8 text-white"
        >
          <h2 className="text-3xl font-bold mb-2">Welcome back, {student.fullName}!</h2>
          <p className="text-blue-100">Review your lessons and scores below.</p>
        </motion.div>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Average Score</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Latest overall performance{latestScoreDate ? ` · ${new Date(latestScoreDate).toLocaleDateString()}` : ''}
            </p>
            <div className="flex items-end space-x-4">
              <span className="text-5xl font-bold text-gray-900 dark:text-white">{averageScore}%</span>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Keep practicing to improve your results.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Skill Breakdown</h3>
            {skillBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No scores recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skillBreakdown.map((skill, index) => (
                  <motion.div
                    key={skill.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{skill.label}</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{skill.score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.score}%` }}
                        transition={{ duration: 0.6 }}
                        className={`${skillColors[skill.key] || 'bg-blue-500'} h-2 rounded-full`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </section>

        <section className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => router.push(item.href)}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all text-left"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{item.label}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {item.label === 'My Lessons' ? 'View materials shared by your teacher.' : 'Track your detailed score history.'}
                </p>
              </motion.button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
