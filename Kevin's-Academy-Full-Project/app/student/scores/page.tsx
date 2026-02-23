'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, TrendingUp, Award } from 'lucide-react';

export default function StudentScoresPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'student') {
      router.push('/');
      return;
    }
    
    setUser(parsedUser);
    loadScores(parsedUser);
  }, [router]);

  const loadScores = (student: any) => {
    const allScores = JSON.parse(localStorage.getItem('kevins_academy_scores') || '[]');
    const studentScores = allScores.filter((s: any) => s.studentName === student.fullName);
    setScores(studentScores);

    // Calculate average
    if (studentScores.length > 0) {
      const latestScore = studentScores[studentScores.length - 1];
      const skills = ['vocabulary', 'grammar', 'speaking', 'reading', 'writing', 'listening'];
      const total = skills.reduce((sum, skill) => sum + (latestScore[skill] || 0), 0);
      setAverageScore(Math.round(total / skills.length));
    }
  };

  if (!user) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/student')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">My Scores</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Average Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-8 mb-8 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 mb-2">Overall Average</p>
              <h2 className="text-5xl font-bold">{averageScore}%</h2>
              <p className="text-white/80 mt-2">Keep up the great work!</p>
            </div>
            <Award className="w-24 h-24 text-white/20" />
          </div>
        </motion.div>

        {scores.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scores yet</h3>
            <p className="text-gray-600">Your teacher hasn't added any scores for you yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {scores.map((score, index) => (
              <motion.div
                key={score.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Score Report</h3>
                  <span className="text-sm text-gray-500">
                    {new Date(score.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.keys(score)
                    .filter(key => !['id', 'studentName', 'createdAt'].includes(key) && typeof score[key] === 'number' && score[key] > 0)
                    .map((skill) => {
                      const value = score[skill] || 0;
                      const label = skill.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      return (
                        <div key={skill} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded ${getScoreColor(value)}`}>
                              {value}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(value)}`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
