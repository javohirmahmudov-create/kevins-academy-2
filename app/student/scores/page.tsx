'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Award } from 'lucide-react';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function StudentScoresPage() {
  const router = useRouter();
  const { currentStudent } = useApp();
  const [student, setStudent] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent);
      return;
    }

    const stored = localStorage.getItem('currentStudent');
    if (!stored) {
      router.replace('/');
      return;
    }

    try {
      setStudent(JSON.parse(stored));
    } catch {
      localStorage.removeItem('currentStudent');
      router.replace('/');
    }
  }, [currentStudent, router]);

  useEffect(() => {
    if (!student) return;

    (async () => {
      const allScores = (await getDataForAdmin('system', 'scores')) || [];
      const studentScores = allScores
        .filter((score: any) =>
          String(score.studentId || '') === String(student.id) ||
          score.studentName === student.fullName
        )
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setScores(studentScores);

      if (studentScores.length === 0) {
        setAverageScore(0);
        return;
      }

      const total = studentScores.reduce((sum: number, score: any) => sum + Number(score.value || 0), 0);
      setAverageScore(Math.round(total / studentScores.length));
    })();
  }, [student]);

  if (!student) return null;

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
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{score.subject || 'Overall Score'}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full ${score.scoreType === 'mock' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {score.scoreType === 'mock' ? 'MOCK EXAM' : 'WEEKLY'}
                      </span>
                      <span>{score.level || 'beginner'}</span>
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">{new Date(score.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Score</span>
                    <span className={`text-sm font-bold px-2 py-1 rounded ${getScoreColor(Number(score.value || 0))}`}>
                      {Number(score.value || 0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getProgressColor(Number(score.value || 0))}`}
                      style={{ width: `${Number(score.value || 0)}%` }}
                    />
                  </div>

                  {score.breakdown && typeof score.breakdown === 'object' && (
                    <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(score.breakdown as Record<string, any>).map(([key, val]) => {
                        const percent = typeof val === 'object' && val !== null
                          ? Number((val as any).percent ?? 0)
                          : Number(val || 0);
                        return (
                          <div key={key} className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1 flex justify-between">
                            <span className="capitalize">{key}</span>
                            <span className="font-semibold">{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {score.comment && (
                    <div className="pt-2">
                      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        {score.comment}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
