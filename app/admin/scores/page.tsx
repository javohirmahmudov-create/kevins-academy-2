'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, TrendingUp, User } from 'lucide-react';
import { getScores, saveScores, getStudents, getGroups, Score } from '@/lib/storage';

type ScoreFormData = {
  studentName: string;
  [key: string]: number | string;
};

const createEmptyFormData = (): ScoreFormData => ({
  studentName: '',
  vocabulary: 0,
  grammar: 0,
  speaking: 0,
  reading: 0,
  writing: 0,
  listening: 0,
  vocabulary_writing: 0,
  pronunciation: 0,
  class_participation: 0,
  presentation: 0
});

export default function ScoresPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [scores, setScores] = useState<Score[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    setScores(getScores());
    setStudents(getStudents());
    setGroups(getGroups());
  }, []);

  const [formData, setFormData] = useState<ScoreFormData>(createEmptyFormData());

  // Get student's level from their group
  const getStudentLevel = (studentName: string) => {
    const student = students.find(s => s.fullName === studentName);
    if (!student) return null;
    
    const group = groups.find(g => g.name === student.group);
    return group?.level || null;
  };

  // Define scoring criteria for each level
  const scoringCriteria: any = {
    'Beginner': ['Grammar', 'Vocabulary', 'Vocabulary Writing', 'Pronunciation', 'Class Participation'],
    'Elementary': ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Pronunciation', 'Class Participation'],
    'Intermediate': ['Grammar', 'Vocabulary', 'Speaking', 'Reading', 'Writing', 'Listening'],
    'Advanced': ['Grammar', 'Vocabulary', 'Speaking', 'Reading', 'Writing', 'Listening', 'Presentation']
  };

  const handleStudentChange = (studentName: string) => {
    setFormData(prev => ({ ...prev, studentName }));
    const student = students.find(s => s.fullName === studentName);
    setSelectedStudent(student);
  };

  const handleAddScore = () => {
    if (!formData.studentName) {
      alert('Please select a student');
      return;
    }

    const existingScores = getScores();
    const { studentName, ...metrics } = formData;
    const normalizedMetrics = Object.entries(metrics).reduce<Record<string, number>>((acc, [key, value]) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(numericValue)) {
        acc[key] = numericValue;
      }
      return acc;
    }, {});

    const newScore: Score = {
      id: `score_${Date.now()}`,
      studentName,
      createdAt: new Date().toISOString(),
      ...normalizedMetrics
    };

    saveScores([...existingScores, newScore]);
    setScores(getScores());
    setFormData(createEmptyFormData());
    setShowAddModal(false);
  };

  const getAverage = (score: Score) => {
    const metricEntries = Object.entries(score).filter(([key, value]) => !['id', 'studentName', 'createdAt'].includes(key) && typeof value === 'number');
    if (!metricEntries.length) {
      return 0;
    }
    const total = metricEntries.reduce((sum, [, value]) => sum + (value as number), 0);
    return Math.round(total / metricEntries.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Scores Management</h1>
                <p className="text-sm text-gray-500">Track student performance</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>Add Score</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {scores.map((score, index) => (
            <motion.div key={score.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{score.studentName}</h3>
                    <p className="text-sm text-gray-500">Average: {getAverage(score)}%</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-green-600">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-semibold">{getAverage(score)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.keys(score)
                  .filter(key => !['id', 'studentName', 'createdAt'].includes(key) && typeof score[key as keyof Score] === 'number' && score[key as keyof Score] as number > 0)
                  .map((key, idx) => {
                    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
                    return { 
                      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
                      value: score[key as keyof Score] as number, 
                      color: colors[idx % colors.length] 
                    };
                  }).map((skill) => (
                  <div key={skill.label} className="text-center">
                    <p className="text-xs text-gray-600 mb-1">{skill.label}</p>
                    <div className="relative w-16 h-16 mx-auto">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className={skill.color} strokeDasharray={`${skill.value * 1.76} 176`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-900">{skill.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Student Score</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student *</label>
                <select 
                  value={formData.studentName} 
                  onChange={(e) => handleStudentChange(e.target.value)} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.fullName}>
                      {student.fullName} ({student.group})
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Level:</span> {getStudentLevel(selectedStudent.fullName) || 'Not assigned'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const level = getStudentLevel(selectedStudent.fullName);
                      const criteria = level ? scoringCriteria[level] : ['Grammar', 'Vocabulary', 'Speaking', 'Reading', 'Writing', 'Listening'];
                      
                      return criteria.map((criterion: string) => {
                        const fieldName = criterion.toLowerCase().replace(/\s+/g, '_');
                        return (
                          <div key={criterion}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{criterion}</label>
                            <input 
                              type="number" 
                              min="0" 
                              max="100" 
                              value={Number(formData[fieldName]) || ''}
                              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value ? parseInt(e.target.value) : 0 })} 
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" 
                              placeholder="0"
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddScore} className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg">Add Score</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
