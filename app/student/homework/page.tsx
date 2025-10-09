'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function StudentHomeworkPage() {
  const router = useRouter();
  const [homework, setHomework] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'student') {
      router.push('/');
      return;
    }
    
    setUser(parsedUser);
    loadHomework(parsedUser);
  }, [router]);

  const loadHomework = (student: any) => {
    // For now, show sample homework with dates
    // In production, this would come from localStorage or API
    const sampleHomework = [
      {
        id: '1',
        title: 'Grammar Exercise - Unit 5',
        description: 'Complete exercises 1-10 on page 45',
        dueDate: '2024-10-15',
        status: 'pending',
        subject: 'Grammar',
        assignedDate: '2024-10-10'
      },
      {
        id: '2',
        title: 'Vocabulary Quiz Preparation',
        description: 'Study vocabulary words from Unit 4',
        dueDate: '2024-10-12',
        status: 'completed',
        subject: 'Vocabulary',
        assignedDate: '2024-10-08'
      },
      {
        id: '3',
        title: 'Speaking Practice',
        description: 'Record a 2-minute presentation about your favorite hobby',
        dueDate: '2024-10-18',
        status: 'pending',
        subject: 'Speaking',
        assignedDate: '2024-10-11'
      },
      {
        id: '4',
        title: 'Reading Comprehension',
        description: 'Read the article and answer questions 1-5',
        dueDate: '2024-10-20',
        status: 'pending',
        subject: 'Reading',
        assignedDate: '2024-10-13'
      }
    ];
    
    setHomework(sampleHomework);
  };

  if (!user) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'overdue': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getSubjectColor = (subject: string) => {
    const colors: any = {
      'Grammar': 'bg-purple-100 text-purple-700',
      'Vocabulary': 'bg-blue-100 text-blue-700',
      'Speaking': 'bg-green-100 text-green-700',
      'Reading': 'bg-orange-100 text-orange-700',
      'Writing': 'bg-pink-100 text-pink-700',
      'Listening': 'bg-teal-100 text-teal-700'
    };
    return colors[subject] || 'bg-gray-100 text-gray-700';
  };

  const pendingCount = homework.filter(h => h.status === 'pending').length;
  const completedCount = homework.filter(h => h.status === 'completed').length;

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
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Homework</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 mb-1">Pending Tasks</p>
                <p className="text-4xl font-bold">{pendingCount}</p>
              </div>
              <Clock className="w-16 h-16 text-white/20" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 mb-1">Completed</p>
                <p className="text-4xl font-bold">{completedCount}</p>
              </div>
              <CheckCircle className="w-16 h-16 text-white/20" />
            </div>
          </motion.div>
        </div>

        {/* Homework List */}
        {homework.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No homework assigned</h3>
            <p className="text-gray-600">Your teacher hasn't assigned any homework yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(
              homework.reduce((acc: any, task: any) => {
                const date = task.assignedDate;
                if (!acc[date]) acc[date] = [];
                acc[date].push(task);
                return acc;
              }, {})
            ).map(([date, dateTasks]: [string, any]) => (
              <div key={date}>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </h2>
                <div className="space-y-4">
                  {dateTasks.map((task: any, index: number) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSubjectColor(task.subject)}`}>
                              {task.subject}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">{task.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(task.status)}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      {task.status === 'pending' && (
                        <button className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all">
                          Mark as Complete
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
