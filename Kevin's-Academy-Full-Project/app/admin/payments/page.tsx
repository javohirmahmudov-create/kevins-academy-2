'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, DollarSign, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { getPayments, getStudents, savePayments, Payment } from '@/lib/storage';

export default function PaymentsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    setPayments(getPayments());
    setStudents(getStudents());
  }, []);

  const [formData, setFormData] = useState({
    studentName: '',
    amount: 500000,
    month: 'October 2024',
    status: 'pending' as const,
    dueDate: new Date().toISOString().split('T')[0]
  });

  const handleAddPayment = () => {
    if (!formData.studentName) {
      alert('Please select a student');
      return;
    }

    const payments = getPayments();
    const newPayment: Payment = {
      id: `payment_${Date.now()}`,
      studentName: formData.studentName,
      amount: formData.amount,
      month: formData.month,
      status: formData.status,
      dueDate: formData.dueDate
    };

    savePayments([...payments, newPayment]);
    setPayments(getPayments());
    setFormData({ studentName: '', amount: 500000, month: 'October 2024', status: 'pending', dueDate: new Date().toISOString().split('T')[0] });
    setShowAddModal(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'overdue': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-orange-100 text-orange-700';
      case 'overdue': return 'bg-red-100 text-red-700';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(amount);
  };

  const togglePaymentStatus = (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (payment) {
      const newStatus = payment.status === 'paid' ? 'pending' : 'paid';
      savePayments(payments.map(p => p.id === id ? { ...p, status: newStatus as any } : p));
      setPayments(getPayments());
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
                <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
                <p className="text-sm text-gray-500">Track student payments</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <DollarSign className="w-5 h-5" />
              <span>Add Payment</span>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Month</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Due Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment, index) => (
                  <motion.tr key={payment.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{payment.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className="px-6 py-4 text-gray-600">{payment.month}</td>
                    <td className="px-6 py-4 text-gray-600">{payment.dueDate}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(payment.status)}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button onClick={() => togglePaymentStatus(payment.id)} className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                          {payment.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                        <button onClick={() => { savePayments(getPayments().filter(p => p.id !== payment.id)); setPayments(getPayments()); }} className="text-red-600 hover:text-red-700 text-sm font-medium">Delete</button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
              <Clock className="w-12 h-12 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Payment Record</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student *</label>
                <select value={formData.studentName} onChange={(e) => setFormData({ ...formData, studentName: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.fullName}>
                      {student.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (UZS) *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month *</label>
                <input type="text" value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" placeholder="October 2024" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddPayment} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:shadow-lg">Add Payment</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
