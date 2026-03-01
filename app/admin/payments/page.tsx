'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, DollarSign, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { getPayments, addPayment, getStudents, Payment } from '@/lib/storage';

export default function PaymentsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  const loadData = async () => {
    try {
      const [paymentsData, studentsData] = await Promise.all([
        getPayments(),
        getStudents()
      ]);

      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch {
      setPayments([]);
      setStudents([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [formData, setFormData] = useState({
    studentId: '',
    amount: 500000,
    month: 'October 2024',
    status: 'pending' as const,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    penaltyPerDay: 10000,
    paidAt: new Date().toISOString().split('T')[0],
    note: ''
  });

  const handleAddPayment = async () => {
    if (!formData.studentId) {
      alert('Please select a student');
      return;
    }

    if (formData.status === 'paid' && !formData.paidAt) {
      alert('Please set paid date');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert('Please set payment start and end dates');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert('Start date cannot be after end date');
      return;
    }

    const selectedStudent = (students || []).find((student) => String(student.id) === String(formData.studentId));

    try {
      await addPayment({
        studentId: Number(formData.studentId),
        studentName: selectedStudent?.fullName,
        amount: formData.amount,
        month: formData.month,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        dueDate: formData.endDate,
        penaltyPerDay: Number(formData.penaltyPerDay || 10000),
        paidAt: formData.status === 'paid' ? formData.paidAt : null,
        note: formData.note.trim() || null
      });

      await loadData();
      setFormData({
        studentId: '',
        amount: 500000,
        month: 'October 2024',
        status: 'pending',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        penaltyPerDay: 10000,
        paidAt: new Date().toISOString().split('T')[0],
        note: ''
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Payment save error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save payment';
      alert(message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'overdue': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-orange-100 text-orange-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(amount);
  };

  const togglePaymentStatus = async (id: string) => {
    try {
      const payment = payments.find(p => String(p.id) === String(id));
      if (payment) {
        const newStatus = payment.status === 'paid' ? 'pending' : 'paid';
        const paidAtInput = newStatus === 'paid'
          ? window.prompt('Paid date (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
          : null;

        if (newStatus === 'paid' && !paidAtInput) {
          return;
        }

        await fetch('/api/payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(payment.id),
            status: newStatus,
            paidAt: newStatus === 'paid' ? paidAtInput : null
          })
        });
        await loadData();
      }
    } catch (error) {
      console.error('Payment status update error:', error);
      setPayments([]);
    }
  };

  const getStudentDisplayName = (payment: Payment) => {
    return payment.studentName || (students || []).find((student) => String(student.id) === String(payment.studentId))?.fullName || 'Unknown student';
  };

  const getStudentGroup = (payment: Payment) => {
    return (students || []).find((student) => String(student.id) === String(payment.studentId))?.group || 'Not Assigned';
  };

  const groupOptions = Array.from(new Set((students || []).map((student) => student.group || 'Not Assigned'))).sort((a, b) => a.localeCompare(b));

  const filteredPayments = (payments || []).filter((payment) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || getStudentDisplayName(payment).toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || getStudentGroup(payment) === selectedGroup;
    return matchesSearch && matchesGroup;
  }).sort((a, b) => {
    const groupA = getStudentGroup(a);
    const groupB = getStudentGroup(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

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
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            placeholder="Search by student name"
          />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
          >
            <option value="">All groups</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Group</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Base Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Penalty</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Total Due</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Month</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Payment Window</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Paid At</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment, index) => (
                  <motion.tr key={payment.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50">
                    {(() => {
                      const displayStatus = payment.isOverdue ? 'overdue' : String(payment.status || 'pending');
                      return (
                        <>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{getStudentDisplayName(payment)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{getStudentGroup(payment)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className={`px-6 py-4 font-semibold ${Number(payment.penaltyAmount || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatCurrency(Number(payment.penaltyAmount || 0))}
                    </td>
                    <td className={`px-6 py-4 font-semibold ${(payment.isOverdue || (payment.status === 'overdue')) ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(Number(payment.totalDue || payment.amount || 0))}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{payment.month || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {payment.startDate ? new Date(payment.startDate).toLocaleDateString() : '-'}
                      {' - '}
                      {payment.endDate ? new Date(payment.endDate).toLocaleDateString() : (payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '-')}
                      {(payment.warning || payment.isOverdue) && (
                        <span className="block mt-1 text-xs text-red-600 font-medium">{payment.warning || 'Deadline passed. Penalty is increasing daily.'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(displayStatus)}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button onClick={() => togglePaymentStatus(String(payment.id))} className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                          {payment.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/payments?id=${encodeURIComponent(String(payment.id))}`, {
                                method: 'DELETE'
                              });
                              await loadData();
                            } catch (error) {
                              console.error('Payment delete error:', error);
                              setPayments([]);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                        </>
                      );
                    })()}
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
                  {formatCurrency(filteredPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.totalDue || p.amount || 0), 0))}
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
                  {formatCurrency(filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.totalDue || p.amount || 0), 0))}
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
                  {formatCurrency(filteredPayments.filter(p => p.status === 'overdue' || p.isOverdue).reduce((sum, p) => sum + Number(p.totalDue || p.amount || 0), 0))}
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
                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">Select student</option>
                  {(students || []).map((student) => (
                    <option key={student.id} value={student.id}>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Start Date *</label>
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment End Date *</label>
                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value, dueDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Penalty Per Day (UZS) *</label>
                <input type="number" min="0" value={formData.penaltyPerDay} onChange={(e) => setFormData({ ...formData, penaltyPerDay: parseInt(e.target.value || '0', 10) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({
                    ...formData,
                    status: e.target.value as any,
                    paidAt: e.target.value === 'paid' ? formData.paidAt || new Date().toISOString().split('T')[0] : formData.paidAt
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              {formData.status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paid At *</label>
                  <input type="date" value={formData.paidAt} onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Payment reminder or comment"
                  rows={3}
                />
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
