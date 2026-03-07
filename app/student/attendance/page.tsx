'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function StudentAttendancePage() {
  const router = useRouter();
  const { currentStudent, t, language } = useApp();
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const adminScope = student?.adminId ? String(student.adminId) : 'system';

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
      try {
        const allAttendance = (await getDataForAdmin(adminScope, 'attendance')) || [];
        const studentAttendance = allAttendance
          .filter((a: any) =>
            String(a.studentId || '') === String(student.id) ||
            a.studentName === student.fullName
          )
          .sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

        setAttendance(studentAttendance);

        const present = studentAttendance.filter((a: any) => a.status === 'present').length;
        const absent = studentAttendance.filter((a: any) => a.status === 'absent').length;
        const late = studentAttendance.filter((a: any) => a.status === 'late').length;
        setStats({ present, absent, late, total: studentAttendance.length });
      } catch (error) {
        console.error('Error loading attendance:', error);
        setAttendance([]);
        setStats({ present: 0, absent: 0, late: 0, total: 0 });
      }
    })();
  }, [student, adminScope]);

  if (!student) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'late': return <Clock className="w-5 h-5 text-yellow-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-200';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200';
      case 'late': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  const groupedAttendance = (attendance || []).reduce((acc: Record<string, any[]>, record: any) => {
    const key = record?.date ? String(record.date).split('T')[0] : 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const groupedDates = Object.keys(groupedAttendance).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

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
              <span>{t('back_to_dashboard')}</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">{t('my_attendance')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('attendance_rate')}</p>
                <p className="text-3xl font-bold text-gray-900">{attendanceRate}%</p>
              </div>
              <Calendar className="w-12 h-12 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('present')}</p>
                <p className="text-3xl font-bold text-green-600">{stats.present}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('absent')}</p>
                <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('late')}</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.late}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </motion.div>
        </div>

        {/* Attendance List */}
        {attendance.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no_attendance_records')}</h3>
            <p className="text-gray-600">{t('teacher_no_attendance_yet')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedDates.map((dateKey) => (
              <div key={dateKey} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-blue-50/70">
                  <span className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-sm font-semibold text-gray-800 border border-blue-100">
                    {dateKey === 'unknown'
                      ? t('unknown_date')
                      : new Date(dateKey).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('status')}</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">{t('comment')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(groupedAttendance[dateKey] || []).map((record, index) => (
                        <motion.tr
                          key={`${dateKey}-${record.id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(record.status)}
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                                {t(record.status || 'not_available')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {record.note || '-'}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
