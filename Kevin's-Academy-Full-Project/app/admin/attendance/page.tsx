'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { adminStorage, Attendance } from '@/lib/storage';

export default function AttendancePage() {
  const router = useRouter();
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    setAttendance(adminStorage.getAttendance());
    setStudents(adminStorage.getStudents());
  }, []);
  const [formData, setFormData] = useState<{
    studentName: string;
    date: string;
    status: 'present' | 'absent' | 'late';
  }>({
    studentName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present'
  });

  useEffect(() => {
    setAttendance(adminStorage.getAttendance());
    setStudents(adminStorage.getStudents());
  }, []);

  const handleMarkAttendance = () => {
    if (!formData.studentName) {
      alert('Please select a student');
      return;
    }

    const attendanceRecords = adminStorage.getAttendance();
    const newAttendance: Attendance = {
      id: `attendance_${Date.now()}`,
      studentName: formData.studentName,
      date: formData.date,
      status: formData.status,
      group: 'Not Assigned'
    };

    adminStorage.saveAttendance([...attendanceRecords, newAttendance]);
    setAttendance(adminStorage.getAttendance());
    setFormData({ studentName: '', date: new Date().toISOString().split('T')[0], status: 'present' });
    setShowMarkModal(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'late': return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-orange-100 text-orange-700';
    }
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
                <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                <p className="text-sm text-gray-500">Track student attendance</p>
              </div>
            </div>
            <button onClick={() => setShowMarkModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Calendar className="w-5 h-5" />
              <span>Mark Attendance</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendance.map((record, index) => (
                  <motion.tr key={record.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{record.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{record.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(record.status)}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => { adminStorage.saveAttendance(adminStorage.getAttendance().filter(a => a.id !== record.id)); setAttendance(adminStorage.getAttendance()); }} className="text-red-600 hover:text-red-700 text-sm font-medium">Delete</button>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Mark Attendance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student *</label>
                <select value={formData.studentName} onChange={(e) => setFormData({ ...formData, studentName: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none">
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.fullName}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['present', 'absent', 'late'] as const).map((status) => (
                    <button key={status} onClick={() => setFormData({ ...formData, status })} className={`px-4 py-3 rounded-xl border-2 transition-all ${formData.status === status ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-pink-300'}`}>
                      <div className="flex flex-col items-center space-y-1">
                        {getStatusIcon(status)}
                        <span className="text-sm font-medium capitalize">{status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowMarkModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleMarkAttendance} className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:shadow-lg">Mark</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
