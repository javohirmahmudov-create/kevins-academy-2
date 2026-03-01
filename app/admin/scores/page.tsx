'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, TrendingUp, User, Trash2, Trophy } from 'lucide-react';
import { getScores, addScore, getStudents, getGroups } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

type ScoreType = 'weekly' | 'mock';

const BEGINNER_CATEGORIES = ['vocabulary', 'grammar', 'translation', 'attendance'] as const;
const ADVANCED_CATEGORIES = ['listening', 'reading', 'speaking', 'writing'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  translation: 'Translation',
  attendance: 'Attendance',
  listening: 'Listening',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
};

const normalizeLevel = (raw?: string | null) => {
  const level = String(raw || '').trim().toLowerCase();
  if (level.includes('advanced')) return 'advanced';
  if (level.includes('intermediate')) return 'intermediate';
  if (level.includes('elementary')) return 'elementary';
  return 'beginner';
};

const getCategoriesForLevel = (level: string) => {
  const normalized = normalizeLevel(level);
  return normalized === 'intermediate' || normalized === 'advanced'
    ? [...ADVANCED_CATEGORIES]
    : [...BEGINNER_CATEGORIES];
};

export default function ScoresPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [scores, setScores] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    scoreType: 'weekly' as ScoreType,
    maxScore: 100,
    examDate: new Date().toISOString().split('T')[0],
    examTime: '10:00',
    sections: {} as Record<string, number>,
  });

  const loadData = async () => {
    try {
      const [scoresData, studentsData, groupsData] = await Promise.all([getScores(), getStudents(), getGroups()]);
      setScores(Array.isArray(scoresData) ? scoresData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch {
      setScores([]);
      setStudents([]);
      setGroups([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStudentName = (score: any) => {
    if (score.studentName) return score.studentName;
    const student = students.find((s: any) => String(s.id) === String(score.studentId));
    return student?.fullName || `${t('student')} #${score.studentId ?? t('unknown_student')}`;
  };

  const getStudentGroup = (score: any) => {
    const student = students.find((s: any) => String(s.id) === String(score.studentId));
    return student?.group || 'Not Assigned';
  };

  const getLevelForStudent = (studentId: string) => {
    const student = students.find((s: any) => String(s.id) === String(studentId));
    if (!student?.group) return 'beginner';
    const group = groups.find((g: any) => g.name === student.group);
    return normalizeLevel(group?.level || 'beginner');
  };

  const currentLevel = getLevelForStudent(formData.studentId);
  const currentCategories = getCategoriesForLevel(currentLevel);

  useEffect(() => {
    setFormData((prev) => {
      const nextSections: Record<string, number> = {};
      currentCategories.forEach((category) => {
        nextSections[category] = Number(prev.sections?.[category] || 0);
      });
      return { ...prev, sections: nextSections };
    });
  }, [formData.studentId]);

  const overallPercent = (() => {
    if (currentCategories.length === 0) return 0;
    const max = Number(formData.maxScore || 100) || 100;
    const percents = currentCategories.map((category) => {
      const score = Number(formData.sections?.[category] || 0);
      return (Math.max(0, Math.min(score, max)) / max) * 100;
    });
    return Math.round((percents.reduce((sum, value) => sum + value, 0) / currentCategories.length) * 100) / 100;
  })();

  const groupOptions = Array.from(new Set((students || []).map((student: any) => student.group || 'Not Assigned'))).sort((a, b) => a.localeCompare(b));

  const filteredScores = (scores || []).filter((score: any) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || getStudentName(score).toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || getStudentGroup(score) === selectedGroup;
    return matchesSearch && matchesGroup;
  }).sort((a: any, b: any) => {
    const groupA = getStudentGroup(a);
    const groupB = getStudentGroup(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const handleAddScore = async () => {
    if (!formData.studentId) {
      alert(t('please_select_student'));
      return;
    }

    const student = students.find((s: any) => String(s.id) === String(formData.studentId));
    const level = getLevelForStudent(formData.studentId);
    const maxScore = Number(formData.maxScore || 100);

    if (maxScore <= 0) {
      alert('Max score must be greater than 0');
      return;
    }

    try {
      await addScore({
        studentId: Number(formData.studentId),
        studentName: student?.fullName || '',
        subject: formData.scoreType === 'mock' ? 'MOCK EXAM' : 'Weekly Assessment',
        value: Number(overallPercent),
        overallPercent: Number(overallPercent),
        level,
        category: 'overall',
        scoreType: formData.scoreType,
        maxScore,
        mockScore: formData.scoreType === 'mock' ? Number(overallPercent) : null,
        examDate: formData.examDate,
        examTime: formData.examTime,
        breakdown: formData.sections,
      });

      await loadData();
      setFormData({
        studentId: '',
        scoreType: 'weekly',
        maxScore: 100,
        examDate: new Date().toISOString().split('T')[0],
        examTime: '10:00',
        sections: {},
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Score save error:', error);
      alert(t('failed_save_score'));
    }
  };

  const handleDeleteScore = async (id: string | number) => {
    if (!confirm(t('delete_score_confirm'))) return;
    await fetch(`/api/scores?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    await loadData();
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
                <h1 className="text-2xl font-bold text-gray-900">{t('scores_management')}</h1>
                <p className="text-sm text-gray-500">{t('track_student_performance')}</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>{t('add_score')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder={t('search_by_student_name')}
          />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">{t('all_groups')}</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
            ))}
          </select>
        </div>
        <div className="space-y-4">
          {filteredScores.map((score, index) => (
            <motion.div key={score.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{getStudentName(score)}</h3>
                    <p className="text-sm text-gray-500">
                      {getStudentGroup(score) === 'Not Assigned' ? t('not_assigned') : getStudentGroup(score)} · {score.level || 'beginner'} · {new Date(score.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${score.scoreType === 'mock' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {score.scoreType === 'mock' ? 'MOCK EXAM' : 'WEEKLY'}
                      </span>
                      {score.examDateTime && (
                        <span className="text-xs text-gray-500">{new Date(score.examDateTime).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">{Number((score.overallPercent ?? score.value) || 0)}%</span>
                  </div>
                  {score.scoreType === 'mock' && <Trophy className="w-5 h-5 text-purple-600" />}
                  <button
                    onClick={() => handleDeleteScore(score.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[94vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('add_student_score')}</h2>
              <p className="text-sm text-gray-500">Level-based scoring + MOCK EXAM support</p>
            </div>

            <div className="px-5 sm:px-7 py-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setFormData((prev) => ({ ...prev, scoreType: 'weekly' }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${formData.scoreType === 'weekly' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                WEEKLY SCORE
              </button>
              <button
                onClick={() => setFormData((prev) => ({ ...prev, scoreType: 'mock' }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${formData.scoreType === 'mock' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                MOCK EXAM
              </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('student')} *</label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">{t('select_student')}</option>
                    {students.map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} ({student.group || t('no_group')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
                  <input
                    type="text"
                    value={currentLevel}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max score (each section)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxScore}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maxScore: Number(e.target.value || 100) }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                {formData.scoreType === 'mock' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mock Date</label>
                      <input
                        type="date"
                        value={formData.examDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, examDate: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mock Time</label>
                      <input
                        type="time"
                        value={formData.examTime}
                        onChange={(e) => setFormData((prev) => ({ ...prev, examTime: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {currentCategories.map((category) => {
                    const currentValue = Number(formData.sections?.[category] || 0);
                    return (
                      <div key={category} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">{CATEGORY_LABELS[category]}</label>
                          <span className="text-sm text-gray-500">{currentValue}/{formData.maxScore}</span>
                        </div>
                        <div className="grid grid-cols-[1fr,88px] gap-3 items-center">
                          <input
                            type="range"
                            min="0"
                            max={Math.max(1, Number(formData.maxScore || 100))}
                            value={currentValue}
                            onChange={(e) => {
                              const next = Number(e.target.value || 0);
                              setFormData((prev) => ({
                                ...prev,
                                sections: { ...prev.sections, [category]: next },
                              }));
                            }}
                            className="w-full accent-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max={Math.max(1, Number(formData.maxScore || 100))}
                            value={currentValue}
                            onChange={(e) => {
                              const next = Number(e.target.value || 0);
                              setFormData((prev) => ({
                                ...prev,
                                sections: { ...prev.sections, [category]: next },
                              }));
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">% Overall (auto)</span>
                  <span className="text-lg font-bold text-gray-900">{overallPercent}%</span>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-7 py-4 border-t border-gray-100 bg-white sticky bottom-0">
              <div className="flex space-x-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
                <button onClick={handleAddScore} className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg">{t('add_score')}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
