'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User,
  Mail,
  Phone,
  GraduationCap
} from 'lucide-react';
import { getStudents, getGroups, addStudent, updateStudent, deleteStudent, Student } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function StudentsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true); // Yuklanish holati

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    group: '',
    username: '',
    password: ''
  });

  // --- MA'LUMOTLARNI YUKLASH (BAZADAN) ---
  const loadData = async () => {
    try {
      setLoading(true);
      const fetchedStudents = await getStudents();
      const fetchedGroups = await getGroups();
      setStudents(fetchedStudents);
      setGroups(fetchedGroups);
    } catch (error) {
      console.error("Xatolik:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupFromQuery = params.get('group') || '';
    setSelectedGroup(groupFromQuery);
  }, []);

  // --- O'QUVCHI QO'SHISH ---
  const handleAddStudent = async () => {
    if (!formData.fullName || !formData.email || !formData.username || !formData.password) {
      alert(t('fill_required_fields'));
      return;
    }

    try {
      await addStudent({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        group: formData.group || 'Not Assigned',
        username: formData.username,
        password: formData.password
      });

      await loadData(); // Ro'yxatni yangilash
      setFormData({ fullName: '', email: '', phone: '', group: '', username: '', password: '' });
      setShowAddModal(false);
    } catch (err) {
      alert(t('save_error'));
    }
  };

  // --- TAHRIRLASH ---
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      group: student.group,
      username: student.username || '',
      password: '' // Xavfsizlik uchun parolni bo'sh qoldiramiz
    });
    setShowEditModal(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent || !formData.fullName || !formData.email) {
      alert(t('fill_required_fields'));
      return;
    }

    try {
      await updateStudent(editingStudent.id, {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        group: formData.group,
        username: formData.username,
        password: formData.password || undefined
      });

      await loadData();
      setShowEditModal(false);
      setEditingStudent(null);
    } catch (err) {
      alert(t('update_error'));
    }
  };

  // --- O'CHIRISH ---
  const handleDeleteStudent = async (id: string) => {
    if (confirm(t('delete_student_confirm'))) {
      try {
        await deleteStudent(id);
        await loadData();
      } catch (err) {
        alert(t('delete_error'));
      }
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup = !selectedGroup || student.group === selectedGroup;

    return matchesSearch && matchesGroup;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header va Search Bar qismi o'zgarmadi (G'o'zallik saqlab qolindi) */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('students_management')}</h1>
                <p className="text-sm text-gray-500">{t('manage_all_students_db')}</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>{t('add_student')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_students')}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">{t('all_groups')}</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
              >
                {/* Kartochka ichi o'zgarmadi */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.fullName}</h3>
                      <p className="text-sm text-gray-500">{student.username}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {student.status}
                  </span>
                </div>
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2"><Mail className="w-4 h-4" /> <span>{student.email}</span></div>
                  <div className="flex items-center space-x-2"><Phone className="w-4 h-4" /> <span>{student.phone}</span></div>
                  <div className="flex items-center space-x-2"><GraduationCap className="w-4 h-4" /> <span>{student.group}</span></div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEditStudent(student)} className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <Edit className="w-4 h-4" /> <span className="text-sm">{t('edit')}</span>
                  </button>
                  <button onClick={() => handleDeleteStudent(student.id)} className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                    <Trash2 className="w-4 h-4" /> <span className="text-sm">{t('delete')}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('add_new_student')}</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('full_name')}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="email"
                placeholder={t('email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder={t('phone')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{t('select_group')}</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t('username')}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="password"
                placeholder={t('password')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleAddStudent}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition-all"
              >
                {t('add_student')}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('edit')} {t('student')}</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('full_name')}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="email"
                placeholder={t('email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder={t('phone')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{t('select_group')}</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t('username')}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="password"
                placeholder={t('password_keep_current')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleUpdateStudent}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition-all"
              >
                {t('update_student')}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}