'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, Mail, Phone, Trash2, Edit, Send } from 'lucide-react';
import { getParents, getStudents, saveParents, Parent } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function ParentsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    studentId: ''
  });

  useEffect(() => {
    (async () => {
      const p = await getParents();
      const s = await getStudents();
      setParents(Array.isArray(p) ? p : []);
      setStudents(Array.isArray(s) ? s : []);
    })();
  }, []);

  const handleAddParent = async () => {
    if (!formData.fullName || !formData.username || !formData.password || !formData.email || !formData.studentId) {
      alert(t('fill_required_fields'));
      return;
    }

    try {
      const parents = await getParents();
      const newParent: Parent = {
        id: `parent_${Date.now()}`,
        fullName: formData.fullName,
        username: formData.username,
        password: formData.password,
        email: formData.email,
        phone: formData.phone,
        studentId: formData.studentId,
        createdAt: new Date().toISOString()
      };

      await saveParents([...(parents || []), newParent]);
      setParents(await getParents());
      setFormData({ fullName: '', username: '', password: '', email: '', phone: '', studentId: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Parent save error:', error);
      setParents([]);
      alert(t('failed_save_parent'));
    }
  };

  const handleEditParent = (parent: Parent) => {
    setEditingParent(parent);
    setFormData({
      fullName: parent.fullName,
      username: parent.username || '',
      password: parent.password || '',
      email: parent.email,
      phone: parent.phone,
      studentId: parent.studentId
    });
    setShowEditModal(true);
  };

  const handleUpdateParent = async () => {
    if (!editingParent || !formData.fullName || !formData.username || !formData.email) {
      alert(t('fill_required_fields'));
      return;
    }

    const updateData: any = {
      fullName: formData.fullName,
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
      studentId: formData.studentId
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    try {
      const parents = await getParents();
      const updatedParents = (parents || []).map(parent =>
        parent.id === editingParent.id
          ? { ...parent, ...updateData }
          : parent
      );
      await saveParents(updatedParents);
      setParents(await getParents());
      setFormData({ fullName: '', username: '', password: '', email: '', phone: '', studentId: '' });
      setEditingParent(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Parent update error:', error);
      setParents([]);
      alert(t('failed_update_parent'));
    }
  };

  const handleDeleteParent = async (id: string) => {
    if (confirm(t('delete_parent_confirm'))) {
      try {
        const parents = await getParents();
        const filteredParents = (parents || []).filter(parent => parent.id !== id);
        await saveParents(filteredParents);
        setParents(await getParents());
      } catch (error) {
        console.error('Parent delete error:', error);
        setParents([]);
        alert(t('failed_delete_parent'));
      }
    }
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? student.fullName : t('unknown_student');
  };

  const handleSendBotLink = async (parent: Parent) => {
    const directLink = parent.telegramInviteLink || '';
    if (directLink) {
      try {
        await navigator.clipboard.writeText(directLink);
        alert(t('bot_link_copied'));
      } catch {
        alert(`${t('bot_link_manual')}: ${directLink}`);
      }
      return;
    }

    const fallbackPhone = parent.normalizedPhone || parent.phone || '';
    if (!fallbackPhone) {
      alert(t('bot_link_not_available'));
      return;
    }

    const manualCommand = `/start ${fallbackPhone}`;
    try {
      await navigator.clipboard.writeText(manualCommand);
      alert(t('start_command_copied'));
    } catch {
      alert(`${t('send_start_command')}: ${manualCommand}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/admin')} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span>{t('back_to_dashboard')}</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('parents_management')}</h1>
              <p className="text-sm text-gray-600">{t('manage_parent_accounts')}</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl hover:shadow-lg">
              <Plus className="w-5 h-5" />
              <span>{t('add_parent')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(parents || []).map((parent, index) => (
            <motion.div key={parent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEditParent(parent)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteParent(parent.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{parent.fullName}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <span className="font-medium">{t('username')}:</span>
                  <span>{parent.username}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{parent.email}</span>
                </div>
                {parent.phone && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{parent.phone}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500 mr-2">Telegram:</span>
                  {(parent as any).telegramConnected ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      🟢 {t('telegram_connected')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      🔴 {t('telegram_not_connected')}
                    </span>
                  )}
                </div>

                {!(parent as any).telegramConnected && (
                  <button
                    onClick={() => handleSendBotLink(parent)}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t('send_bot_link')}</span>
                  </button>
                )}

                <div className="pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">{t('child')}: </span>
                  <span className="text-sm font-medium text-blue-600">{getStudentName(parent.studentId)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('add_parent')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('full_name')} *</label>
                <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('parent_full_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('login_username')} *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('parent_login_username')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('password')} *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('parent_login_password')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('email')} *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="parent@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('phone_number')}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+998 90 123 4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('child_student')} *</label>
                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">{t('select_student')}</option>
                  {(students || []).map((student) => (
                    <option key={student.id} value={student.id}>{student.fullName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleAddParent} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg">{t('add_parent')}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('edit_parent')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('full_name')} *</label>
                <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('login_username')} *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('password')}</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('leave_empty_keep_current')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('email')} *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('phone_number')}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('child_student')} *</label>
                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">{t('select_student')}</option>
                  {(students || []).map((student) => (
                    <option key={student.id} value={student.id}>{student.fullName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingParent(null); setFormData({ fullName: '', username: '', password: '', email: '', phone: '', studentId: '' }); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleUpdateParent} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg">{t('update')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
