'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeLanguageToggle } from '@/components/theme-language-toggle';
import { useApp } from '@/lib/app-context';
import { adminStorage, Admin } from '@/lib/storage';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Shield,
  LogOut,
  GraduationCap,
  ArrowLeft
} from 'lucide-react';

export default function AdminManagement() {
  const router = useRouter();
  const { t, currentAdmin, logoutAdmin } = useApp();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [newAdmin, setNewAdmin] = useState({
    username: '',
    password: '',
    fullName: '',
    email: ''
  });
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: ''
  });

  useEffect(() => {
    if (!currentAdmin) {
      router.push('/');
      return;
    }

    // Faqat super admin (kevin_teacher) uchun admin management
    if (currentAdmin.username !== 'kevin_teacher') {
      router.push('/admin');
      return;
    }

    loadAdmins();
  }, [currentAdmin, router]);

  const loadAdmins = () => {
    const allAdmins = adminStorage.getAdmins();
    setAdmins(allAdmins);
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAdmin.username || !newAdmin.password || !newAdmin.fullName || !newAdmin.email) {
      alert(t('Please fill all fields'));
      return;
    }

    try {
      adminStorage.createAdmin(newAdmin);
      setNewAdmin({ username: '', password: '', fullName: '', email: '' });
      setShowCreateForm(false);
      loadAdmins();
      alert(t('Admin created successfully'));
    } catch (error) {
      alert(t('Error creating admin'));
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditForm({
      username: admin.username,
      password: admin.password,
      fullName: admin.fullName,
      email: admin.email
    });
  };

  const handleUpdateAdmin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAdmin || !editForm.username || !editForm.password || !editForm.fullName || !editForm.email) {
      alert(t('Please fill all fields'));
      return;
    }

    try {
      adminStorage.updateAdmin(editingAdmin.id, editForm);
      setEditingAdmin(null);
      setEditForm({ username: '', password: '', fullName: '', email: '' });
      loadAdmins();
      alert(t('Admin updated successfully'));
    } catch (error) {
      alert(t('Error updating admin'));
    }
  };

  const handleDeleteAdmin = (adminId: string) => {
    if (confirm(t('Are you sure you want to delete this admin?'))) {
      try {
        // Admin va uning barcha ma'lumotlarini o'chirish
        adminStorage.deleteAdmin(adminId);

        // Agar o'chirilgan admin joriy admin bo'lsa, logout qilish
        if (currentAdmin?.id === adminId) {
          logoutAdmin();
          router.push('/');
          return;
        }

        loadAdmins();
        alert(t('Admin deleted successfully'));
      } catch (error) {
        alert(t('Error deleting admin'));
      }
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    router.push('/');
  };

  if (!currentAdmin || currentAdmin.username !== 'kevin_teacher') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">Only super administrators can access this page.</p>
          <button
            onClick={() => router.push('/admin')}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin_management')}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage system administrators</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeLanguageToggle />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentAdmin.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Super Admin</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('admin_list')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Total: {admins.length} administrators</p>
          </div>

          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>{t('create_admin')}</span>
          </button>
        </div>

        {/* Edit Admin Form */}
        {editingAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Edit Admin: {editingAdmin.username}</h3>
            <form onSubmit={handleUpdateAdmin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_username')}
                  </label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_password')}
                  </label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  {t('update')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Create Admin Form */}
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('create_admin')}</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_username')}
                  </label>
                  <input
                    type="text"
                    value={newAdmin.username}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_password')}
                  </label>
                  <input
                    type="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newAdmin.fullName}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  {t('create')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Admins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.map((admin, index) => (
            <motion.div
              key={admin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  admin.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {admin.isActive ? t('active') : t('inactive')}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{admin.fullName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">@{admin.username}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{admin.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Created: {new Date(admin.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => handleEditAdmin(admin)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-1"
                >
                  <Edit className="w-4 h-4" />
                  <span>{t('edit')}</span>
                </button>

                {admin.id !== currentAdmin.id && (
                  <button
                    onClick={() => handleDeleteAdmin(admin.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('delete')}</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {admins.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No administrators found</h3>
            <p className="text-gray-600 dark:text-gray-400">Create your first admin account to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
