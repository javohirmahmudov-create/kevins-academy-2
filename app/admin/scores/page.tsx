'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, TrendingUp, User, Trash2 } from 'lucide-react';
import { getScores, addScore, getStudents } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function ScoresPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [scores, setScores] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    subject: 'overall',
    value: 0
  });

  const loadData = async () => {
    try {
      const [scoresData, studentsData] = await Promise.all([getScores(), getStudents()]);
      setScores(Array.isArray(scoresData) ? scoresData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch {
      setScores([]);
      setStudents([]);
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

    try {
      await addScore({
        studentId: Number(formData.studentId),
        studentName: student?.fullName || '',
        subject: formData.subject || 'overall',
        value: Number(formData.value || 0)
      });

      await loadData();
      setFormData({ studentId: '', subject: 'overall', value: 0 });
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
                    <p className="text-sm text-gray-500">{getStudentGroup(score) === 'Not Assigned' ? t('not_assigned') : getStudentGroup(score)} · {score.subject || 'overall'} · {new Date(score.createdAt || Date.now()).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">{Number(score.value || 0)}%</span>
                  </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('add_student_score')}</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('subject')}</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="overall"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('score_range')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, value: Number(e.target.value || 0) }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleAddScore} className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg">{t('add_score')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
