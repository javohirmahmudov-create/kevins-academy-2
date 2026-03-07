'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, Mail, Phone, Trash2, Edit, Send, Search } from 'lucide-react';
import { getParents, getStudents, addParent, updateParent, deleteParent, Parent } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

function toApiErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? String(error.message || '') : '';
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const fromApi = String(parsed?.error || '').trim();
    return fromApi || fallback;
  } catch {
    return raw || fallback;
  }
}

function normalizePhoneForCompare(raw?: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('998')) return digits;
  if (digits.length === 9) return `998${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `998${digits.slice(1)}`;
  return digits;
}

const PARENT_META_PREFIX = '__KA_PARENT__:';

function resolveParentPhoneForInput(parent: Parent) {
  const rawPhone = String(parent.phone || '').trim();
  if (!rawPhone) return '';
  if (rawPhone.startsWith(PARENT_META_PREFIX)) {
    return String(parent.normalizedPhone || '').trim();
  }
  return rawPhone;
}

export default function ParentsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [childSearch, setChildSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentFilterGroup, setStudentFilterGroup] = useState('all');

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    phone: '',
    studentIds: [] as string[]
  });

  const normalizedFormPhone = normalizePhoneForCompare(formData.phone);
  const duplicatePhoneParent = normalizedFormPhone
    ? (parents || []).find((parent) => {
        const sameRecord = editingParent && String(parent.id) === String(editingParent.id);
        if (sameRecord) return false;
        return normalizePhoneForCompare(parent.phone) === normalizedFormPhone;
      })
    : null;
  const phoneInlineError = duplicatePhoneParent
    ? `Bu telefon raqam band: ${duplicatePhoneParent.fullName || duplicatePhoneParent.username || 'boshqa ota-ona'}`
    : '';

  useEffect(() => {
    (async () => {
      const p = await getParents();
      const s = await getStudents();
      setParents(Array.isArray(p) ? p : []);
      setStudents(Array.isArray(s) ? s : []);
    })();
  }, []);

  const handleAddParent = async () => {
    if (!formData.fullName || !formData.username || !formData.password || formData.studentIds.length === 0) {
      alert(t('fill_required_fields'));
      return;
    }

    if (phoneInlineError) {
      alert(phoneInlineError);
      return;
    }

    try {
      await addParent({
        fullName: formData.fullName,
        username: formData.username,
        password: formData.password,
        phone: formData.phone,
        studentId: formData.studentIds[0],
        studentIds: formData.studentIds,
      });
      setParents(await getParents());
      setFormData({ fullName: '', username: '', password: '', phone: '', studentIds: [] });
      setShowAddModal(false);
    } catch (error) {
      console.error('Parent save error:', error);
      alert(toApiErrorMessage(error, t('failed_save_parent')));
    }
  };

  const handleEditParent = (parent: Parent) => {
    const editablePhone = resolveParentPhoneForInput(parent);
    setStudentSearchInput('');
    setStudentSearchTerm('');
    setStudentFilterGroup('all');
    setEditingParent(parent);
    setFormData({
      fullName: parent.fullName,
      username: parent.username || '',
      password: parent.password || '',
      phone: editablePhone,
      studentIds: Array.isArray(parent.studentIds)
        ? parent.studentIds.map((id) => String(id))
        : (parent.studentId ? [String(parent.studentId)] : [])
    });
    setShowEditModal(true);
  };

  const handleUpdateParent = async () => {
    if (!editingParent || !formData.fullName || !formData.username) {
      alert(t('fill_required_fields'));
      return;
    }

    if (phoneInlineError) {
      alert(phoneInlineError);
      return;
    }

    const updateData: any = {
      fullName: formData.fullName,
      username: formData.username,
      phone: formData.phone,
      studentId: formData.studentIds[0],
      studentIds: formData.studentIds
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    try {
      await updateParent(editingParent.id, updateData);
      setParents(await getParents());
      setFormData({ fullName: '', username: '', password: '', phone: '', studentIds: [] });
      setEditingParent(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Parent update error:', error);
      alert(toApiErrorMessage(error, t('failed_update_parent')));
    }
  };

  const handleDeleteParent = async (id: string) => {
    if (confirm(t('delete_parent_confirm'))) {
      try {
        await deleteParent(id);
        setParents(await getParents());
      } catch (error) {
        console.error('Parent delete error:', error);
        alert(toApiErrorMessage(error, t('failed_delete_parent')));
      }
    }
  };

  const getStudentName = (studentId: string) => {
    const student = students.find((s: any) => String(s.id) === String(studentId));
    return student ? student.fullName : t('unknown_student');
  };

  const getParentStudentNames = (parent: Parent) => {
    const ids = Array.isArray(parent.studentIds)
      ? parent.studentIds.map((id) => String(id))
      : (parent.studentId ? [String(parent.studentId)] : []);

    const names = ids
      .map((id) => getStudentName(id))
      .filter(Boolean);

    return names.length > 0 ? names : [t('unknown_student')];
  };

  const getParentStudentGroups = (parent: Parent) => {
    const ids = Array.isArray(parent.studentIds)
      ? parent.studentIds.map((id) => String(id))
      : (parent.studentId ? [String(parent.studentId)] : []);

    const groups = ids
      .map((id) => {
        const student = students.find((s: any) => String(s.id) === String(id));
        return String(student?.group || '').trim();
      })
      .filter(Boolean);

    return Array.from(new Set(groups));
  };

  const availableGroups = useMemo(() => {
    const groups = (students || [])
      .map((student: any) => String(student?.group || '').trim())
      .filter(Boolean);

    return Array.from(new Set(groups)).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudentsForModal = useMemo(() => {
    const query = studentSearchTerm.trim().toLowerCase();
    const selectedIds = new Set((formData.studentIds || []).map((id) => String(id)));

    const selectedStudentsTop = (students || []).filter((student: any) => selectedIds.has(String(student.id)));
    const byGroup = (students || []).filter((student: any) => {
      if (studentFilterGroup === 'all') return true;
      return String(student?.group || '').trim().toLowerCase() === String(studentFilterGroup).trim().toLowerCase();
    });

    const byQuery = query
      ? byGroup.filter((student: any) => String(student?.fullName || '').toLowerCase().includes(query))
      : byGroup;

    return [
      ...selectedStudentsTop,
      ...byQuery.filter((student: any) => !selectedIds.has(String(student.id))),
    ];
  }, [students, studentSearchTerm, studentFilterGroup, formData.studentIds]);

  const applyStudentSearch = () => {
    setStudentSearchTerm(studentSearchInput);
  };

  const handleStudentIdsChange = (event: any) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => String(option.value));
    setFormData({ ...formData, studentIds: selected });
  };

  const filteredParents = useMemo(() => {
    const query = childSearch.trim().toLowerCase();
    const byGroup = (parents || []).filter((parent) => {
      if (selectedGroup === 'all') return true;
      const groups = getParentStudentGroups(parent);
      return groups.some((group) => String(group).toLowerCase() === String(selectedGroup).toLowerCase());
    });

    if (!query) return byGroup;

    return byGroup.filter((parent) => {
      const childNames = getParentStudentNames(parent).join(' ').toLowerCase();
      return childNames.includes(query);
    });
  }, [parents, students, childSearch, selectedGroup]);

  const studentGroupDistribution = useMemo(() => {
    const studentById = new Map((students || []).map((student: any) => [String(student.id), student]));
    const uniqueStudentIds = new Set<string>();

    (filteredParents || []).forEach((parent) => {
      const ids = Array.isArray(parent.studentIds)
        ? parent.studentIds.map((id) => String(id))
        : (parent.studentId ? [String(parent.studentId)] : []);

      ids.forEach((id) => uniqueStudentIds.add(id));
    });

    const groupCounter = new Map<string, number>();
    uniqueStudentIds.forEach((studentId) => {
      const student = studentById.get(String(studentId));
      const groupName = String(student?.group || 'Guruhsiz').trim() || 'Guruhsiz';
      groupCounter.set(groupName, (groupCounter.get(groupName) || 0) + 1);
    });

    return Array.from(groupCounter.entries())
      .map(([groupName, count]) => ({ groupName, count }))
      .sort((a, b) => b.count - a.count || a.groupName.localeCompare(b.groupName));
  }, [filteredParents, students]);

  const handleSendBotLink = async (parent: Parent) => {
    const directLink = parent.telegramInviteLink || '';
    try {
      const response = await fetch('/api/parents/send-bot-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: Number(parent.id) })
      });

      const result = await response.json();
      if (result?.ok) {
        if (result?.via === 'telegram') {
          alert("Bot link ota-onaning Telegramiga yuborildi. Endi u botda Start bosishi kerak.");
        } else {
          alert("Bot link ota-onaning telefon raqamiga yuborildi.");
        }
        return;
      }

      if (result?.reason === 'parent_must_start') {
        alert("Ota-ona botni birinchi marta o'zi ochib Start bosishi kerak. Hozir bot link ochiladi.");
      }
    } catch {
      // fallback to opening/copying link below
    }

    if (directLink) {
      try {
        const popup = window.open(directLink, '_blank', 'noopener,noreferrer');
        if (!popup) {
          window.location.href = directLink;
        }
      } catch {
        try {
          await navigator.clipboard.writeText(directLink);
          alert(t('bot_link_copied'));
        } catch {
          alert(`${t('bot_link_manual')}: ${directLink}`);
        }
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
            <button onClick={() => { setShowAddModal(true); setStudentSearchInput(''); setStudentSearchTerm(''); setStudentFilterGroup('all'); }} className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl hover:shadow-lg">
              <Plus className="w-5 h-5" />
              <span>{t('add_parent')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Farzand bo'yicha qidirish</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  placeholder="Farzand ismini kiriting"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Farzandlar guruhi bo'yicha qidirish</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="all">Barcha guruhlar</option>
                  {availableGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Farzandlar guruhi bo'yicha taqsimot</div>
              {studentGroupDistribution.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {studentGroupDistribution.map((item) => (
                    <div key={item.groupName} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                      <span>{item.groupName}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">Mos guruh topilmadi</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParents.map((parent, index) => (
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
                {parent.email ? (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{parent.email}</span>
                  </div>
                ) : null}
                {parent.phone && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{resolveParentPhoneForInput(parent)}</span>
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
                  <span className="text-sm font-medium text-blue-600">{getParentStudentNames(parent).join(', ')}</span>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredParents.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
              Mos farzand topilmadi
            </div>
          )}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('phone_number')}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+998 90 123 4567" />
                {phoneInlineError ? <p className="text-xs text-red-500 mt-1">{phoneInlineError}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('child_student')} *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                  <input
                    type="text"
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyStudentSearch();
                      }
                    }}
                    placeholder="Farzand ismini qidiring"
                    className="sm:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyStudentSearch}
                    className="w-full px-3 py-2 border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50"
                  >
                    Qidirish
                  </button>
                </div>
                <select
                  value={studentFilterGroup}
                  onChange={(e) => setStudentFilterGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-2"
                >
                  <option value="all">Barcha guruhlar</option>
                  {availableGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <select
                  multiple
                  value={formData.studentIds}
                  onChange={handleStudentIdsChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                >
                  {filteredStudentsForModal.map((student: any) => (
                    <option key={student.id} value={student.id}>{student.fullName}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Bir nechta farzand tanlash uchun Ctrl/Cmd tugmasini bosib turing</p>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setStudentSearchInput(''); setStudentSearchTerm(''); setStudentFilterGroup('all'); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleAddParent} disabled={Boolean(phoneInlineError)} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{t('add_parent')}</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('phone_number')}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                {phoneInlineError ? <p className="text-xs text-red-500 mt-1">{phoneInlineError}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('child_student')} *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                  <input
                    type="text"
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyStudentSearch();
                      }
                    }}
                    placeholder="Farzand ismini qidiring"
                    className="sm:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyStudentSearch}
                    className="w-full px-3 py-2 border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50"
                  >
                    Qidirish
                  </button>
                </div>
                <select
                  value={studentFilterGroup}
                  onChange={(e) => setStudentFilterGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-2"
                >
                  <option value="all">Barcha guruhlar</option>
                  {availableGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <select
                  multiple
                  value={formData.studentIds}
                  onChange={handleStudentIdsChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                >
                  {filteredStudentsForModal.map((student: any) => (
                    <option key={student.id} value={student.id}>{student.fullName}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Bir nechta farzand tanlash uchun Ctrl/Cmd tugmasini bosib turing</p>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingParent(null); setFormData({ fullName: '', username: '', password: '', phone: '', studentIds: [] }); setStudentSearchInput(''); setStudentSearchTerm(''); setStudentFilterGroup('all'); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleUpdateParent} disabled={Boolean(phoneInlineError)} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{t('update')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
