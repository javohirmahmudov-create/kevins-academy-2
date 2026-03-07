'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, DollarSign, CheckCircle, XCircle, Clock, User, Search, Filter, Edit } from 'lucide-react';
import { getPayments, addPayment, getStudents, Payment } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function PaymentsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [studentPickerGroup, setStudentPickerGroup] = useState('');

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
    status: 'pending' as const,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    penaltyPerDay: 10000,
    paidAt: new Date().toISOString().split('T')[0],
    note: ''
  });

  const handleAddPayment = async () => {
    if (!formData.studentId) {
      alert(t('please_select_student'));
      return;
    }

    if (formData.status === 'paid' && !formData.paidAt) {
      alert(t('please_set_paid_date'));
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert(t('please_set_payment_window'));
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert(t('start_date_after_end'));
      return;
    }

    const selectedStudent = (students || []).find((student) => String(student.id) === String(formData.studentId));

    try {
      await addPayment({
        studentId: Number(formData.studentId),
        studentName: selectedStudent?.fullName,
        amount: formData.amount,
        month: null,
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
        status: 'pending',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        penaltyPerDay: 10000,
        paidAt: new Date().toISOString().split('T')[0],
        note: ''
      });
      setStudentPickerSearch('');
      setStudentPickerGroup('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Payment save error:', error);
      const message = error instanceof Error ? error.message : t('failed_save_payment');
      alert(message);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      studentId: String(payment.studentId || ''),
      amount: Number(payment.amount || 0),
      status: (String(payment.status || 'pending') as any),
      startDate: payment.startDate ? String(payment.startDate).split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: payment.endDate
        ? String(payment.endDate).split('T')[0]
        : (payment.dueDate ? String(payment.dueDate).split('T')[0] : new Date().toISOString().split('T')[0]),
      penaltyPerDay: Number(payment.penaltyPerDay || 10000),
      paidAt: payment.paidAt ? String(payment.paidAt).split('T')[0] : new Date().toISOString().split('T')[0],
      note: String(payment.note || ''),
    });
    setStudentPickerSearch('');
    setStudentPickerGroup('');
    setShowEditModal(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    if (!formData.studentId) {
      alert(t('please_select_student'));
      return;
    }

    if (formData.status === 'paid' && !formData.paidAt) {
      alert(t('please_set_paid_date'));
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      alert(t('please_set_payment_window'));
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      alert(t('start_date_after_end'));
      return;
    }

    const selectedStudent = (students || []).find((student) => String(student.id) === String(formData.studentId));

    try {
      const response = await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(editingPayment.id),
          studentId: Number(formData.studentId),
          studentName: selectedStudent?.fullName,
          amount: Number(formData.amount || 0),
          status: formData.status,
          startDate: formData.startDate,
          endDate: formData.endDate,
          dueDate: formData.endDate,
          penaltyPerDay: Number(formData.penaltyPerDay || 10000),
          paidAt: formData.status === 'paid' ? formData.paidAt : null,
          note: formData.note.trim() || null,
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t('failed_update_parent'));
      }

      await loadData();
      setFormData({
        studentId: '',
        amount: 500000,
        status: 'pending',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        penaltyPerDay: 10000,
        paidAt: new Date().toISOString().split('T')[0],
        note: ''
      });
      setEditingPayment(null);
      setStudentPickerSearch('');
      setStudentPickerGroup('');
      setShowEditModal(false);
    } catch (error) {
      console.error('Payment update error:', error);
      alert(error instanceof Error ? error.message : t('failed_save_payment'));
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
      case 'overdue': return 'bg-rose-50 text-rose-700 border border-rose-200';
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
          ? window.prompt(t('paid_date_prompt'), new Date().toISOString().split('T')[0])
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
    return payment.studentName || (students || []).find((student) => String(student.id) === String(payment.studentId))?.fullName || t('unknown_student');
  };

  const getStudentGroup = (payment: Payment) => {
    return (students || []).find((student) => String(student.id) === String(payment.studentId))?.group || 'Not Assigned';
  };

  const groupOptions = Array.from(new Set((students || []).map((student) => student.group || 'Not Assigned'))).sort((a, b) => a.localeCompare(b));

  const studentPickerGroupOptions = useMemo(() => {
    return Array.from(new Set((students || []).map((student) => String(student.group || 'Not Assigned'))))
      .sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudentsForPicker = useMemo(() => {
    const query = studentPickerSearch.trim().toLowerCase();
    return (students || []).filter((student) => {
      const group = String(student.group || 'Not Assigned');
      const fullName = String(student.fullName || '').toLowerCase();
      const username = String(student.username || '').toLowerCase();

      const matchesGroup = !studentPickerGroup || group === studentPickerGroup;
      const matchesSearch = !query || fullName.includes(query) || username.includes(query);

      return matchesGroup && matchesSearch;
    });
  }, [students, studentPickerGroup, studentPickerSearch]);

  const filteredPayments = (payments || []).filter((payment) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || getStudentDisplayName(payment).toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || getStudentGroup(payment) === selectedGroup;
    const displayStatus = payment.isOverdue ? 'overdue' : String(payment.status || 'pending');
    const matchesStatus = selectedStatus === 'all' || displayStatus === selectedStatus;
    return matchesSearch && matchesGroup && matchesStatus;
  }).sort((a, b) => {
    const groupA = getStudentGroup(a);
    const groupB = getStudentGroup(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const monthlyPaidStats = useMemo(() => {
    const [year, month] = String(selectedMonth || '').split('-').map((value) => Number(value));
    if (!year || !month) {
      return {
        totalPaidAmount: 0,
        paidCount: 0,
        groupBreakdown: [] as Array<{ group: string; amount: number; count: number }>
      };
    }

    const paidPaymentsInMonth = (payments || []).filter((payment) => {
      const status = String(payment.status || '').toLowerCase();
      if (status !== 'paid') return false;

      const paidDateRaw = payment.paidAt || payment.createdAt;
      if (!paidDateRaw) return false;

      const paidDate = new Date(String(paidDateRaw));
      if (Number.isNaN(paidDate.getTime())) return false;

      const paidYear = paidDate.getFullYear();
      const paidMonth = paidDate.getMonth() + 1;
      return paidYear === year && paidMonth === month;
    });

    const totalPaidAmount = paidPaymentsInMonth.reduce((sum, payment) => sum + Number(payment.totalDue || payment.amount || 0), 0);
    const groupMap = new Map<string, { amount: number; count: number }>();

    paidPaymentsInMonth.forEach((payment) => {
      const group = getStudentGroup(payment) || 'Not Assigned';
      const item = groupMap.get(group) || { amount: 0, count: 0 };
      item.amount += Number(payment.totalDue || payment.amount || 0);
      item.count += 1;
      groupMap.set(group, item);
    });

    const groupBreakdown = Array.from(groupMap.entries())
      .map(([group, value]) => ({ group, amount: value.amount, count: value.count }))
      .sort((a, b) => b.amount - a.amount || a.group.localeCompare(b.group));

    return {
      totalPaidAmount,
      paidCount: paidPaymentsInMonth.length,
      groupBreakdown,
    };
  }, [payments, students, selectedMonth]);

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
                <h1 className="text-2xl font-bold text-gray-900">{t('payment_management')}</h1>
                <p className="text-sm text-gray-500">{t('track_student_payments')}</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <DollarSign className="w-5 h-5" />
              <span>{t('add_payment')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Barchasi ({payments.length})
            </button>
            <button
              onClick={() => setSelectedStatus('paid')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              To'langan ({payments.filter((payment) => (payment.isOverdue ? 'overdue' : String(payment.status || 'pending')) === 'paid').length})
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
            >
              Kutilmoqda ({payments.filter((payment) => (payment.isOverdue ? 'overdue' : String(payment.status || 'pending')) === 'pending').length})
            </button>
            <button
              onClick={() => setSelectedStatus('overdue')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedStatus === 'overdue' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'}`}
            >
              Muddati o'tgan ({payments.filter((payment) => (payment.isOverdue ? 'overdue' : String(payment.status || 'pending')) === 'overdue').length})
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder={t('search_by_student_name')}
              />
            </div>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">{t('all_groups')}</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('student')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('group')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('base_amount')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('penalty')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('total_due')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('payment_window')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('paid_at')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('status')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment, index) => (
                  <motion.tr key={payment.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-slate-50 transition-colors">
                    {(() => {
                      const displayStatus = payment.isOverdue ? 'overdue' : String(payment.status || 'pending');
                      return (
                        <>
                    <td className="px-6 py-4 min-w-[240px]">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{getStudentDisplayName(payment)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{getStudentGroup(payment) === 'Not Assigned' ? t('not_assigned') : getStudentGroup(payment)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className={`px-6 py-4 font-semibold ${Number(payment.penaltyAmount || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatCurrency(Number(payment.penaltyAmount || 0))}
                    </td>
                    <td className={`px-6 py-4 font-semibold ${(payment.isOverdue || (payment.status === 'overdue')) ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(Number(payment.totalDue || payment.amount || 0))}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {payment.startDate ? new Date(payment.startDate).toLocaleDateString() : '-'}
                      {' - '}
                      {payment.endDate ? new Date(payment.endDate).toLocaleDateString() : (payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '-')}
                      {(payment.warning || payment.isOverdue) && (
                        <span className="block mt-1 text-xs text-red-600 font-medium">{payment.warning || t('deadline_passed_warning')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(displayStatus)}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(displayStatus)}`}>
                          {t(displayStatus)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditPayment(payment)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium inline-flex items-center gap-1">
                          <Edit className="w-3.5 h-3.5" />
                          <span>{t('edit')}</span>
                        </button>
                        <button onClick={() => togglePaymentStatus(String(payment.id))} className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-sm font-medium">
                          {payment.status === 'paid' ? t('mark_unpaid') : t('mark_paid')}
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
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"
                        >
                          {t('delete')}
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

        <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Oylik sarhisob</h3>
              <p className="text-sm text-gray-500">To'langan status bo'yicha oy kesimidagi tushum</p>
            </div>
            <div className="w-full md:w-[220px]">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-700">Jami tushum (oylik)</p>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(monthlyPaidStats.totalPaidAmount)}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-700">To'lov qilganlar soni</p>
              <p className="text-2xl font-bold text-blue-800">{monthlyPaidStats.paidCount}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Guruhlar kesimida tushum</h4>
            {monthlyPaidStats.groupBreakdown.length > 0 ? (
              <div className="space-y-2">
                {monthlyPaidStats.groupBreakdown.map((item) => (
                  <div key={item.group} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                    <div>
                      <p className="font-medium text-gray-900">{item.group === 'Not Assigned' ? t('not_assigned') : item.group}</p>
                      <p className="text-xs text-gray-500">To'lovlar soni: {item.count}</p>
                    </div>
                    <p className="font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Bu oyda to'langan to'lovlar topilmadi</div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('total_paid')}</p>
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
                <p className="text-sm text-gray-600 mb-1">{t('pending')}</p>
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
                <p className="text-sm text-gray-600 mb-1">{t('overdue')}</p>
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
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('add_payment_record')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('student')} *</label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentPickerSearch}
                      onChange={(e) => setStudentPickerSearch(e.target.value)}
                      placeholder="O'quvchi qidirish..."
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <select
                    value={studentPickerGroup}
                    onChange={(e) => setStudentPickerGroup(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="">Barcha guruhlar</option>
                    {studentPickerGroupOptions.map((group) => (
                      <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
                    ))}
                  </select>
                </div>

                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">{t('select_student')}</option>
                  {filteredStudentsForPicker.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} {student.group ? `— ${student.group}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Topildi: {filteredStudentsForPicker.length} ta o'quvchi</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('amount_uzs')} *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value || 0) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment_start_date')} *</label>
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment_end_date')} *</label>
                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('penalty_per_day_uzs')} *</label>
                <input type="number" min="0" value={formData.penaltyPerDay} onChange={(e) => setFormData({ ...formData, penaltyPerDay: parseInt(e.target.value || '0', 10) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('status')} *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({
                    ...formData,
                    status: e.target.value as any,
                    paidAt: e.target.value === 'paid' ? formData.paidAt || new Date().toISOString().split('T')[0] : formData.paidAt
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="pending">{t('pending')}</option>
                  <option value="paid">{t('paid')}</option>
                  <option value="overdue">{t('overdue')}</option>
                </select>
              </div>
              {formData.status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('paid_at')} *</label>
                  <input type="date" value={formData.paidAt} onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('note_optional')}</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder={t('payment_reminder_or_comment')}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setStudentPickerSearch(''); setStudentPickerGroup(''); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleAddPayment} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:shadow-lg">{t('add_payment')}</button>
            </div>
          </motion.div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">To'lovni tahrirlash</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('student')} *</label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentPickerSearch}
                      onChange={(e) => setStudentPickerSearch(e.target.value)}
                      placeholder="O'quvchi qidirish..."
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <select
                    value={studentPickerGroup}
                    onChange={(e) => setStudentPickerGroup(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="">Barcha guruhlar</option>
                    {studentPickerGroupOptions.map((group) => (
                      <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
                    ))}
                  </select>
                </div>

                <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">{t('select_student')}</option>
                  {filteredStudentsForPicker.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} {student.group ? `— ${student.group}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Topildi: {filteredStudentsForPicker.length} ta o'quvchi</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('amount_uzs')} *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value || 0) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment_start_date')} *</label>
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment_end_date')} *</label>
                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('penalty_per_day_uzs')} *</label>
                <input type="number" min="0" value={formData.penaltyPerDay} onChange={(e) => setFormData({ ...formData, penaltyPerDay: parseInt(e.target.value || '0', 10) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('status')} *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({
                    ...formData,
                    status: e.target.value as any,
                    paidAt: e.target.value === 'paid' ? formData.paidAt || new Date().toISOString().split('T')[0] : formData.paidAt
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="pending">{t('pending')}</option>
                  <option value="paid">{t('paid')}</option>
                  <option value="overdue">{t('overdue')}</option>
                </select>
              </div>
              {formData.status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('paid_at')} *</label>
                  <input type="date" value={formData.paidAt} onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('note_optional')}</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder={t('payment_reminder_or_comment')}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingPayment(null); setStudentPickerSearch(''); setStudentPickerGroup(''); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleUpdatePayment} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:shadow-lg">Saqlash</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
