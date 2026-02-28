'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Phone, UserMinus } from 'lucide-react';
import { getGroups, getStudents, updateStudent, Student, Group } from '@/lib/storage';
export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    loadGroupDetails();
  }, [params.id]);

  const loadGroupDetails = async () => {
    const allGroups = await getGroups();
    const foundGroup = allGroups.find(g => g.id === params.id);
    
    if (foundGroup) {
      setGroup(foundGroup);
      
      // Get students in this group
      const allStudents = await getStudents();
      const groupStudents = allStudents.filter(s => s.group === foundGroup.name);
      setStudents(groupStudents);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (confirm('Remove this student from the group?')) {
      await updateStudent(studentId, { group: 'Not Assigned' });
      await loadGroupDetails();
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const levelColors = {
    Beginner: 'from-green-500 to-emerald-600',
    Elementary: 'from-blue-500 to-cyan-600',
    Intermediate: 'from-purple-500 to-pink-600',
    Advanced: 'from-orange-500 to-red-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/groups')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r ${levelColors[group.level]} text-white`}>
                {group.level}
              </span>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {students.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-12 text-center shadow-lg border border-gray-100"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Students Yet</h3>
            <p className="text-gray-500 mb-6">This group doesn't have any students assigned yet.</p>
            <button
              onClick={() => router.push('/admin/students')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all"
            >
              Add Students
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${levelColors[group.level]} rounded-full flex items-center justify-center`}>
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.fullName}</h3>
                      <p className="text-sm text-gray-500">@{student.username}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    student.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {student.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{student.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{student.phone}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveStudent(student.id)}
                  className="w-full flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  <span className="text-sm">Remove from Group</span>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}