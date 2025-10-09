'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, BookOpen, Edit, Trash2 } from 'lucide-react';
import { adminStorage, Group } from '@/lib/storage';

export default function GroupsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    level: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced';
    description: string;
  }>({
    name: '',
    level: 'Beginner',
    description: ''
  });

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = () => {
    const allGroups = adminStorage.getGroups();
    const students = adminStorage.getStudents();
    
    // Count students for each group
    const groupsWithCount = allGroups.map(group => ({
      ...group,
      studentCount: students.filter(s => s.group === group.name).length
    }));
    
    setGroups(groupsWithCount);
  };

  const handleAddGroup = () => {
    if (!formData.name) {
      alert('Please enter group name');
      return;
    }

    const groups = adminStorage.getGroups();
    const newGroup = {
      id: `group_${Date.now()}`,
      name: formData.name,
      level: formData.level,
      description: formData.description,
      teacher: 'Unassigned',
      schedule: 'TBD',
      maxStudents: 20,
      createdAt: new Date().toISOString()
    };

    adminStorage.saveGroups([...groups, newGroup]);

    loadGroups();
    setFormData({ name: '', level: 'Beginner', description: '' });
    setShowAddModal(false);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      level: group.level as any,
      description: group.description
    });
    setShowEditModal(true);
  };

  const handleUpdateGroup = () => {
    if (!editingGroup || !formData.name) {
      alert('Please enter group name');
      return;
    }

    const allGroups = adminStorage.getGroups();
    const updatedGroups = allGroups.map(g => 
      g.id === editingGroup.id 
        ? { ...g, name: formData.name, level: formData.level, description: formData.description }
        : g
    );
    adminStorage.saveGroups(updatedGroups);

    loadGroups();
    setFormData({ name: '', level: 'Beginner', description: '' });
    setEditingGroup(null);
    setShowEditModal(false);
  };

  const handleDeleteGroup = (id: string) => {
    if (confirm('Are you sure you want to delete this group?')) {
    const groups = adminStorage.getGroups();
    const filteredGroups = groups.filter(g => g.id !== id);
    adminStorage.saveGroups(filteredGroups);
      loadGroups();
    }
  };

  const levelColors = {
    Beginner: 'from-green-500 to-emerald-600',
    Elementary: 'from-blue-500 to-cyan-600',
    Intermediate: 'from-purple-500 to-pink-600',
    Advanced: 'from-orange-500 to-red-600'
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
                <h1 className="text-2xl font-bold text-gray-900">Group Management</h1>
                <p className="text-sm text-gray-500">Manage all groups</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>Create Group</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group, index) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
              <div 
                onClick={() => router.push(`/admin/groups/${group.id}`)}
                className="cursor-pointer"
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${levelColors[group.level || 'Beginner']} rounded-2xl flex items-center justify-center mb-4`}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{group.description}</p>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${levelColors[group.level || 'Beginner']} text-white`}>
                    {group.level || 'Beginner'}
                  </span>
                  <div className="flex items-center space-x-1 text-gray-600 cursor-pointer hover:text-purple-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">{group.studentCount || 0} students</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleEditGroup(group)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"
                >
                  <Edit className="w-4 h-4" />
                  <span className="text-sm">Edit</span>
                </button>
                <button 
                  onClick={() => handleDeleteGroup(group.id)} 
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Delete</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g., Beginner A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Level *</label>
                <select value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value as any })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
                  <option value="Beginner">Beginner</option>
                  <option value="Elementary">Elementary</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" rows={3} placeholder="Brief description..." />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddGroup} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg">Create Group</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g., Beginner A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Level *</label>
                <select value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value as any })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
                  <option value="Beginner">Beginner</option>
                  <option value="Elementary">Elementary</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" rows={3} placeholder="Brief description..." />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingGroup(null); setFormData({ name: '', level: 'Beginner', description: '' }); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdateGroup} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg">Update Group</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
