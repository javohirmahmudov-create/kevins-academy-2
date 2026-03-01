'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { getAttendance, addAttendance, getStudents } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRecord {
  id: string | number;
  studentName?: string;
  studentId?: string | number;
  date?: string;
  status?: AttendanceStatus | string;
  note?: string;
  group?: string;
}

interface StudentOption {
  id: string | number;
  fullName: string;
  group?: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const { t } = useApp();
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [formData, setFormData] = useState<{
    studentId: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    note: string;
  }>({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    note: ''
  });

  const loadData = async () => {
    try {
      const [attendanceData, studentsData] = await Promise.all([
        getAttendance(),
        getStudents()
      ]);

      setAttendance((Array.isArray(attendanceData) ? attendanceData : []) as AttendanceRecord[]);
      setStudents((Array.isArray(studentsData) ? studentsData : []) as StudentOption[]);
    } catch {
      setAttendance([]);
      setStudents([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAttendance = async () => {
    if (!formData.studentId) {
      alert(t('please_select_student'));
      return;
    }

    if (formData.status === 'late' && !formData.note.trim()) {
      alert(t('please_add_late_comment'));
      return;
    }

    const selectedStudent = (students || []).find((student) => String(student.id) === String(formData.studentId));

    const newAttendance = {
      studentId: Number(formData.studentId),
      studentName: selectedStudent?.fullName,
      date: formData.date,
      status: formData.status,
      note: formData.note.trim() || undefined,
      group: 'Not Assigned'
    };

    try {
      await addAttendance(newAttendance);
      await loadData();
      setFormData({ studentId: '', date: new Date().toISOString().split('T')[0], status: 'present', note: '' });
      setShowMarkModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('failed_mark_attendance');
      alert(message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'late': return <Clock className="w-5 h-5 text-orange-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStudentDisplayName = (record: AttendanceRecord) => {
    return record.studentName || (students || []).find((student) => String(student.id) === String(record.studentId))?.fullName || `ID: ${record.studentId || '-'}`;
  };

  const getStudentGroup = (record: AttendanceRecord) => {
    return (students || []).find((student) => String(student.id) === String(record.studentId))?.group || 'Not Assigned';
  };

  const groupOptions = Array.from(new Set((students || []).map((student) => student.group || 'Not Assigned'))).sort((a, b) => a.localeCompare(b));

  const filteredAttendance = (attendance || []).filter((record) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || getStudentDisplayName(record).toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || getStudentGroup(record) === selectedGroup;
    return matchesSearch && matchesGroup;
  }).sort((a, b) => {
    const groupA = getStudentGroup(a);
    const groupB = getStudentGroup(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

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
                <h1 className="text-2xl font-bold text-gray-900">{t('attendance_management')}</h1>
                <p className="text-sm text-gray-500">{t('track_student_attendance')}</p>
              </div>
            </div>
            <button onClick={() => setShowMarkModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Calendar className="w-5 h-5" />
              <span>{t('mark_attendance')}</span>
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
            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
            placeholder={t('search_by_student_name')}
          />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
          >
            <option value="">{t('all_groups')}</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('student')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('group')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('date')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('status')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('comment')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                  {filteredAttendance.map((record, index: number) => (
                  <motion.tr key={record.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{getStudentDisplayName(record)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{getStudentGroup(record) === 'Not Assigned' ? t('not_assigned') : getStudentGroup(record)}</td>
                    <td className="px-6 py-4 text-gray-600">{record.date ? new Date(record.date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(record.status || 'present')}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status || 'present')}`}>
                          {t(String(record.status || 'present'))}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{record.note || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={async () => {
                          await fetch(`/api/attendance?id=${encodeURIComponent(String(record.id))}`, {
                            method: 'DELETE'
                          });
                          await loadData();
                        }}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showMarkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('mark_attendance')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('student')} *</label>
                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none">
                  <option value="">{t('select_student')}</option>
                  {(students || []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')} *</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('status')} *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['present', 'absent', 'late'] as const).map((status) => (
                    <button key={status} onClick={() => setFormData({ ...formData, status })} className={`px-4 py-3 rounded-xl border-2 transition-all ${formData.status === status ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-pink-300'}`}>
                      <div className="flex flex-col items-center space-y-1">
                        {getStatusIcon(status)}
                        <span className="text-sm font-medium capitalize">{t(status)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('comment')} {formData.status === 'late' ? '*' : `(${t('optional')})`}
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder={formData.status === 'late' ? t('why_student_late') : t('optional_note')}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowMarkModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleMarkAttendance} className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:shadow-lg">{t('mark')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
