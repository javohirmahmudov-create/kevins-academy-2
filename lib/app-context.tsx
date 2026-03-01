'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Turlar (Types)
export type AuthRole = 'admin' | 'student' | 'parent';

interface SessionState {
  role: AuthRole;
  viewedAs?: AuthRole;
}

interface AppContextType {
  currentAdmin: any | null;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  isAdminAuthenticated: boolean;

  currentStudent: any | null;
  loginStudent: (username: string, password: string, options?: { impersonate?: boolean }) => Promise<{ success: boolean; reason?: string }>;
  logoutStudent: () => void;
  isStudentAuthenticated: boolean;

  currentParent: any | null;
  loginParent: (username: string, password: string) => Promise<{ success: boolean; reason?: string }>;
  logoutParent: () => void;
  isParentAuthenticated: boolean;

  sessionState: SessionState | null;
  impersonating: boolean;
  impersonationWarning: boolean;
  clearImpersonationWarning: () => void;

  language: 'uz' | 'en';
  setLanguage: (lang: 'uz' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Tarjimalar (Translations)
const translations = {
  uz: {
    'welcome': 'Xush kelibsiz',
    'login': 'Kirish',
    'logout': 'Chiqish',
    'dashboard': 'Boshqaruv paneli',
    'students': 'O\'quvchilar',
    'parents': 'Ota-onalar',
    'groups': 'Guruhlar',
    'materials': 'Materiallar',
    'scores': 'Ballar',
    'attendance': 'Davomat',
    'payments': 'To\'lovlar',
    'add': 'Qo\'shish',
    'edit': 'Tahrirlash',
    'delete': 'O\'chirish',
    'save': 'Saqlash',
    'cancel': 'Bekor qilish',
    'search': 'Qidirish',
    'filter': 'Filtrlash',
    'export': 'Eksport',
    'import': 'Import',
    'my_lessons': 'Mening darslarim',
    'homework': 'Uy vazifasi',
    'paid': 'To\'langan',
    'unpaid': 'To\'lanmagan',
    'present': 'Hozir',
    'absent': 'Yo\'q',
    'late': 'Kechikdi',
    'pending': 'Kutilmoqda',
    'overdue': 'Muddati o\'tgan',
    'not_assigned': 'Biriktirilmagan',
    'unknown_student': 'Noma\'lum o\'quvchi',
    'all_groups': 'Barcha guruhlar',
    'student': 'O\'quvchi',
    'group': 'Guruh',
    'date': 'Sana',
    'status': 'Holat',
    'comment': 'Izoh',
    'actions': 'Amallar',
    'optional': 'ixtiyoriy',
    'mark': 'Belgilash',
    'search_by_student_name': 'O\'quvchi nomi bo\'yicha qidirish',
    'attendance_management': 'Davomat boshqaruvi',
    'track_student_attendance': 'O\'quvchilar davomatini kuzatish',
    'mark_attendance': 'Davomat belgilash',
    'select_student': 'O\'quvchini tanlang',
    'please_select_student': 'Iltimos, o\'quvchini tanlang',
    'please_add_late_comment': 'Iltimos, kechikish sababini yozing',
    'failed_mark_attendance': 'Davomatni belgilashda xatolik',
    'why_student_late': 'O\'quvchi nega kech qoldi?',
    'optional_note': 'Ixtiyoriy izoh',
    'track_student_payments': 'O\'quvchi to\'lovlarini kuzatish',
    'payment_management': 'To\'lov boshqaruvi',
    'add_payment': 'To\'lov qo\'shish',
    'please_set_paid_date': 'Iltimos, to\'langan sanani kiriting',
    'please_set_payment_window': 'Iltimos, to\'lov boshlanish va tugash sanasini kiriting',
    'start_date_after_end': 'Boshlanish sanasi tugash sanasidan keyin bo\'lishi mumkin emas',
    'failed_save_payment': 'To\'lovni saqlashda xatolik',
    'base_amount': 'Asosiy summa',
    'penalty': 'Jarima',
    'total_due': 'Jami to\'lov',
    'month': 'Oy',
    'payment_window': 'To\'lov oralig\'i',
    'paid_at': 'To\'langan sana',
    'mark_unpaid': 'To\'lanmagan deb belgilash',
    'mark_paid': 'To\'langan deb belgilash',
    'total_paid': 'Jami to\'langan',
    'add_payment_record': 'To\'lov yozuvini qo\'shish',
    'amount_uzs': 'Summa (UZS)',
    'payment_start_date': 'To\'lov boshlanish sanasi',
    'payment_end_date': 'To\'lov tugash sanasi',
    'penalty_per_day_uzs': 'Kunlik jarima (UZS)',
    'note_optional': 'Izoh (ixtiyoriy)',
    'payment_reminder_or_comment': 'To\'lov eslatmasi yoki izoh',
    'deadline_passed_warning': 'Muddat o\'tdi. Jarima har kuni oshib bormoqda.',
    'paid_date_prompt': 'To\'langan sana (YYYY-MM-DD)',
    'scores_management': 'Ballar boshqaruvi',
    'track_student_performance': 'O\'quvchi natijalarini kuzatish',
    'add_score': 'Ball qo\'shish',
    'failed_save_score': 'Ballni saqlashda xatolik',
    'delete_score_confirm': 'Bu ballni o\'chirishni xohlaysizmi?',
    'add_student_score': 'O\'quvchi ballini qo\'shish',
    'subject': 'Fan',
    'score_range': 'Ball (0-100)',
    'no_group': 'Guruh yo\'q',
    'group_management': 'Guruh boshqaruvi',
    'manage_all_groups': 'Barcha guruhlarni boshqarish',
    'please_enter_group_name': 'Iltimos, guruh nomini kiriting',
    'create_new_group': 'Yangi guruh yaratish',
    'group_name': 'Guruh nomi',
    'level': 'Daraja',
    'description': 'Tavsif',
    'brief_description': 'Qisqacha tavsif...',
    'update_group': 'Guruhni yangilash',
    'delete_group_confirm': 'Haqiqatan ham bu guruhni o\'chirmoqchimisiz?',
    'students_count': 'o\'quvchi',
    'students_management': 'O\'quvchilar boshqaruvi',
    'manage_all_students_db': 'Postgres bazasidagi barcha o\'quvchilarni boshqarish',
    'add_student': 'O\'quvchi qo\'shish',
    'search_students': 'O\'quvchilarni qidirish...',
    'select_group': 'Guruhni tanlang',
    'add_new_student': 'Yangi o\'quvchi qo\'shish',
    'full_name': 'To\'liq ism',
    'email': 'Email',
    'phone': 'Telefon',
    'username': 'Login',
    'password': 'Parol',
    'password_keep_current': 'Parol (o\'zgartirmasangiz bo\'sh qoldiring)',
    'update_student': 'O\'quvchini yangilash',
    'fill_required_fields': 'Iltimos, barcha majburiy maydonlarni to\'ldiring',
    'save_error': 'Saqlashda xato yuz berdi',
    'update_error': 'Yangilashda xato',
    'delete_error': 'O\'chirishda xato',
    'delete_student_confirm': 'O\'quvchini o\'chirishga aminmisiz?',
    'administrator': 'Administrator',
    'manage': 'Boshqarish',
    'create_student_account': 'O\'quvchi akkauntini yaratish',
    'setup_new_class_group': 'Yangi sinf guruhini sozlash',
    'add_learning_resources': 'Ta\'lim materiallarini qo\'shish',
    'manage_admins': 'Adminlarni boshqarish',
    'total_students': 'Jami o\'quvchilar',
    'active_groups': 'Faol guruhlar',
    'pending_payments': 'Kutilayotgan to\'lovlar',
    'today_attendance': 'Bugungi davomat',
    'quick_actions': 'Tezkor amallar',
    'create_group': 'Guruh yaratish',
    'upload_material': 'Material yuklash',
    'admin_management': 'Admin boshqaruvi',
    'admin_list': 'Adminlar ro\'yxati',
    'create_admin': 'Admin yaratish',
    'admin_username': 'Admin logini',
    'admin_password': 'Admin paroli',
    'active': 'Faol',
    'inactive': 'Nofaol',
    'update': 'Yangilash',
    'create': 'Yaratish',
    'please_fill_all_fields': 'Iltimos, barcha maydonlarni to\'ldiring',
    'admin_created_successfully': 'Admin muvaffaqiyatli yaratildi',
    'error_creating_admin': 'Admin yaratishda xato',
    'admin_updated_successfully': 'Admin muvaffaqiyatli yangilandi',
    'error_updating_admin': 'Admin yangilashda xato',
    'delete_admin_confirm': 'Haqiqatan ham bu adminni o\'chirmoqchimisiz?',
    'admin_deleted_successfully': 'Admin muvaffaqiyatli o\'chirildi',
    'error_deleting_admin': 'Admin o\'chirishda xato',
    'access_denied': 'Kirish taqiqlangan',
    'only_super_admin_access': 'Bu sahifaga faqat super administrator kira oladi',
    'super_admin': 'Super Admin',
    'no_administrators_found': 'Administratorlar topilmadi',
    'create_first_admin': 'Boshlash uchun birinchi admin akkauntini yarating',
    'parents_management': 'Ota-onalar boshqaruvi',
    'manage_parent_accounts': 'Ota-ona akkauntlarini boshqarish',
    'back_to_dashboard': 'Boshqaruv paneliga qaytish',
    'add_parent': 'Ota-ona qo\'shish',
    'edit_parent': 'Ota-onani tahrirlash',
    'delete_parent_confirm': 'Haqiqatan ham bu ota-onani o\'chirmoqchimisiz?',
    'failed_save_parent': 'Ota-onani saqlashda xatolik',
    'failed_update_parent': 'Ota-onani yangilashda xatolik',
    'failed_delete_parent': 'Ota-onani o\'chirishda xatolik',
    'child': 'Farzand',
    'login_username': 'Login (Username)',
    'phone_number': 'Telefon raqami',
    'child_student': 'Farzand (o\'quvchi)',
    'parent_full_name': 'Ota-ona to\'liq ismi',
    'parent_login_username': 'Ota-ona login nomi',
    'parent_login_password': 'Ota-ona login paroli',
    'leave_empty_keep_current': 'Joriy holatda qoldirish uchun bo\'sh qoldiring',
    'telegram_connected': 'Telegram ulangan',
    'telegram_not_connected': 'Telegram bog\'lanmagan',
    'send_bot_link': 'Ota-onaga bot linkini yuborish',
    'bot_link_copied': 'Bot link nusxalandi. Ota-onaga yuboring.',
    'bot_link_manual': 'Bot linkni qo\'lda yuboring',
    'bot_link_not_available': 'Bot linkni yaratib bo\'lmadi. Bot username sozlanmagan.',
    'start_command_copied': '/start buyrug\'i nusxalandi. Ota-onaga yuboring.',
    'send_start_command': 'Ota-onaga yuboring',
    'materials_management': 'Materiallar boshqaruvi',
    'upload_manage_materials': 'Ta\'lim materiallarini yuklash va boshqarish',
    'file': 'Fayl',
    'title': 'Sarlavha',
    'type': 'Turi',
    'due_date': 'Topshirish muddati',
    'deadline_for_students': 'O\'quvchilar uchun topshirish muddati',
    'comment_description': 'Izoh / Tavsif',
    'material_title': 'Material nomi',
    'click_upload_pdf': 'PDF yuklash uchun bosing',
    'click_upload_video': 'Video yuklash uchun bosing',
    'click_upload_image': 'Rasm yuklash uchun bosing',
    'click_upload_text': 'Matn yuklash uchun bosing',
    'pdf_document': 'PDF hujjat',
    'video': 'Video',
    'image': 'Rasm',
    'text': 'Matn',
    'pdf_documents': 'PDF hujjatlar',
    'any_size_supported': 'Istalgan hajm qo\'llab-quvvatlanadi',
    'download': 'Yuklab olish',
    'group_label': 'Guruh',
    'error_uploading_file': 'Fayl yuklashda xatolik',
    'please_select_file': 'Iltimos, yuklash uchun fayl tanlang',
    'uploading': 'Yuklanmoqda...',
    'upload': 'Yuklash',
    'admin_login': 'Admin kirishi',
    'child_name': 'Farzand ismi',
    'attendance_rate': 'Davomat foizi',
    'overall_score': 'Umumiy ball',
    'payment_status': 'To\'lov holati',
    'skills_progress': 'Ko\'nikmalar rivoji',
    'recent_activity': 'So\'nggi faollik',
    'group_ranking': 'Guruh reytingi',
    'weekly_rank': 'Haftalik o\'rin',
    'mock_exam_rank': 'Mock imtihon o\'rni',
    'group_size': 'Guruh soni',
    'next_due': 'Keyingi to\'lov muddati',
    'not_available': 'Mavjud emas',
    'parent_portal': 'Ota-ona portali',
    'parent_role': 'Ota-ona',
    'hello_parent': 'Salom',
    'child_progress_intro': 'Farzandingiz holati',
    'parent_account_connected': 'Ota-ona akkaunti ulangan',
    'child_data_not_linked': 'Farzand ma\'lumoti hali bog\'lanmagan. Iltimos, admin bilan bog\'laning.',
    'back_to_login': 'Kirishga qaytish',
    'child_record_not_found': 'Farzand yozuvi topilmadi. Iltimos, administrator bilan bog\'laning.',
    'failed_to_load_data': 'Ma\'lumotlarni yuklashda xatolik. Iltimos, qayta urinib ko\'ring.',
    'test_score_received': 'Yangi ball kiritildi',
    'attendance_marked': 'Davomat belgilandi',
    'criteria_trend': 'Mezonlar bo\'yicha dinamika',
    'not_enough_score_data': 'Ball ma\'lumotlari hali yetarli emas.',
    'attendance_history': 'Davomat bo\'limi',
    'attendance_empty': 'Davomat ma\'lumotlari hali yo\'q.',
    'group_leaderboard': 'Guruh reyting jadvali',
    'your_child_position': 'Farzandingiz o\'rni',
    'all_students_ranking': 'Barcha o\'quvchilar reytingi',
    'student_name': 'O\'quvchi',
    'weekly_score': 'Haftalik ball',
    'mock_score': 'Mock ball',
    'rank': 'O\'rin',
    'no_ranking_data': 'Reyting ma\'lumotlari hali yo\'q',
    'fullscreen': 'To\'liq ekran',
    'open_video': 'Videoni ochish',
    'score_comment_placeholder': 'Ball bo\'yicha izoh yozing',
  },
  en: {
    'welcome': 'Welcome',
    'login': 'Login',
    'logout': 'Logout',
    'dashboard': 'Dashboard',
    'students': 'Students',
    'parents': 'Parents',
    'groups': 'Groups',
    'materials': 'Materials',
    'scores': 'Scores',
    'attendance': 'Attendance',
    'payments': 'Payments',
    'add': 'Add',
    'edit': 'Edit',
    'delete': 'Delete',
    'save': 'Save',
    'cancel': 'Cancel',
    'search': 'Search',
    'filter': 'Filter',
    'export': 'Export',
    'import': 'Import',
    'my_lessons': 'My Lessons',
    'homework': 'Homework',
    'paid': 'Paid',
    'unpaid': 'Unpaid',
    'present': 'Present',
    'absent': 'Absent',
    'late': 'Late',
    'pending': 'Pending',
    'overdue': 'Overdue',
    'not_assigned': 'Not Assigned',
    'unknown_student': 'Unknown student',
    'all_groups': 'All groups',
    'student': 'Student',
    'group': 'Group',
    'date': 'Date',
    'status': 'Status',
    'comment': 'Comment',
    'actions': 'Actions',
    'optional': 'optional',
    'mark': 'Mark',
    'search_by_student_name': 'Search by student name',
    'attendance_management': 'Attendance Management',
    'track_student_attendance': 'Track student attendance',
    'mark_attendance': 'Mark Attendance',
    'select_student': 'Select student',
    'please_select_student': 'Please select a student',
    'please_add_late_comment': 'Please add a comment for why the student was late',
    'failed_mark_attendance': 'Failed to mark attendance',
    'why_student_late': 'Why was the student late?',
    'optional_note': 'Optional note',
    'track_student_payments': 'Track student payments',
    'payment_management': 'Payment Management',
    'add_payment': 'Add Payment',
    'please_set_paid_date': 'Please set paid date',
    'please_set_payment_window': 'Please set payment start and end dates',
    'start_date_after_end': 'Start date cannot be after end date',
    'failed_save_payment': 'Failed to save payment',
    'base_amount': 'Base Amount',
    'penalty': 'Penalty',
    'total_due': 'Total Due',
    'month': 'Month',
    'payment_window': 'Payment Window',
    'paid_at': 'Paid At',
    'mark_unpaid': 'Mark Unpaid',
    'mark_paid': 'Mark Paid',
    'total_paid': 'Total Paid',
    'add_payment_record': 'Add Payment Record',
    'amount_uzs': 'Amount (UZS)',
    'payment_start_date': 'Payment Start Date',
    'payment_end_date': 'Payment End Date',
    'penalty_per_day_uzs': 'Penalty Per Day (UZS)',
    'note_optional': 'Note (optional)',
    'payment_reminder_or_comment': 'Payment reminder or comment',
    'deadline_passed_warning': 'Deadline passed. Penalty is increasing daily.',
    'paid_date_prompt': 'Paid date (YYYY-MM-DD)',
    'scores_management': 'Scores Management',
    'track_student_performance': 'Track student performance',
    'add_score': 'Add Score',
    'failed_save_score': 'Failed to save score',
    'delete_score_confirm': 'Delete this score?',
    'add_student_score': 'Add Student Score',
    'subject': 'Subject',
    'score_range': 'Score (0-100)',
    'no_group': 'No group',
    'group_management': 'Group Management',
    'manage_all_groups': 'Manage all groups',
    'please_enter_group_name': 'Please enter group name',
    'create_new_group': 'Create New Group',
    'group_name': 'Group Name',
    'level': 'Level',
    'description': 'Description',
    'brief_description': 'Brief description...',
    'update_group': 'Update Group',
    'delete_group_confirm': 'Are you sure you want to delete this group?',
    'students_count': 'students',
    'students_management': 'Student Management',
    'manage_all_students_db': 'Manage all students in Postgres DB',
    'add_student': 'Add Student',
    'search_students': 'Search students...',
    'select_group': 'Select Group',
    'add_new_student': 'Add New Student',
    'full_name': 'Full Name',
    'email': 'Email',
    'phone': 'Phone',
    'username': 'Username',
    'password': 'Password',
    'password_keep_current': 'Password (leave empty to keep current)',
    'update_student': 'Update Student',
    'fill_required_fields': 'Please fill all required fields',
    'save_error': 'Error while saving',
    'update_error': 'Error while updating',
    'delete_error': 'Error while deleting',
    'delete_student_confirm': 'Are you sure you want to delete this student?',
    'administrator': 'Administrator',
    'manage': 'Manage',
    'create_student_account': 'Create student account',
    'setup_new_class_group': 'Setup new class group',
    'add_learning_resources': 'Add learning resources',
    'manage_admins': 'Manage Admins',
    'total_students': 'Total Students',
    'active_groups': 'Active Groups',
    'pending_payments': 'Pending Payments',
    'today_attendance': 'Today Attendance',
    'quick_actions': 'Quick Actions',
    'create_group': 'Create Group',
    'upload_material': 'Upload Material',
    'admin_management': 'Admin Management',
    'admin_list': 'Admin List',
    'create_admin': 'Create Admin',
    'admin_username': 'Admin Username',
    'admin_password': 'Admin Password',
    'active': 'Active',
    'inactive': 'Inactive',
    'update': 'Update',
    'create': 'Create',
    'please_fill_all_fields': 'Please fill all fields',
    'admin_created_successfully': 'Admin created successfully',
    'error_creating_admin': 'Error creating admin',
    'admin_updated_successfully': 'Admin updated successfully',
    'error_updating_admin': 'Error updating admin',
    'delete_admin_confirm': 'Are you sure you want to delete this admin?',
    'admin_deleted_successfully': 'Admin deleted successfully',
    'error_deleting_admin': 'Error deleting admin',
    'access_denied': 'Access Denied',
    'only_super_admin_access': 'Only super administrators can access this page.',
    'super_admin': 'Super Admin',
    'no_administrators_found': 'No administrators found',
    'create_first_admin': 'Create your first admin account to get started.',
    'parents_management': 'Parents Management',
    'manage_parent_accounts': 'Manage parent accounts',
    'back_to_dashboard': 'Back to Dashboard',
    'add_parent': 'Add Parent',
    'edit_parent': 'Edit Parent',
    'delete_parent_confirm': 'Are you sure you want to delete this parent?',
    'failed_save_parent': 'Failed to save parent',
    'failed_update_parent': 'Failed to update parent',
    'failed_delete_parent': 'Failed to delete parent',
    'child': 'Child',
    'login_username': 'Login (Username)',
    'phone_number': 'Phone Number',
    'child_student': 'Child (Student)',
    'parent_full_name': 'Parent full name',
    'parent_login_username': 'Parent login username',
    'parent_login_password': 'Parent login password',
    'leave_empty_keep_current': 'Leave empty to keep current',
    'telegram_connected': 'Telegram connected',
    'telegram_not_connected': 'Telegram not connected',
    'send_bot_link': 'Send bot link to parent',
    'bot_link_copied': 'Bot link copied. Send it to the parent.',
    'bot_link_manual': 'Send this bot link manually',
    'bot_link_not_available': 'Cannot build bot link. Bot username is not configured.',
    'start_command_copied': '/start command copied. Send it to the parent.',
    'send_start_command': 'Send this command to parent',
    'materials_management': 'Materials Management',
    'upload_manage_materials': 'Upload and manage learning materials',
    'file': 'File',
    'title': 'Title',
    'type': 'Type',
    'due_date': 'Due Date',
    'deadline_for_students': 'Deadline for students to complete this material',
    'comment_description': 'Comment / Description',
    'material_title': 'Material title',
    'click_upload_pdf': 'Click to upload PDF',
    'click_upload_video': 'Click to upload Video',
    'click_upload_image': 'Click to upload Image',
    'click_upload_text': 'Click to upload Text',
    'pdf_document': 'PDF Document',
    'video': 'Video',
    'image': 'Image',
    'text': 'Text',
    'pdf_documents': 'PDF Documents',
    'any_size_supported': 'Any size supported',
    'download': 'Download',
    'group_label': 'Group',
    'error_uploading_file': 'Error uploading file',
    'please_select_file': 'Please select a file to upload',
    'uploading': 'Uploading...',
    'upload': 'Upload',
    'admin_login': 'Admin Login',
    'child_name': 'Child Name',
    'attendance_rate': 'Attendance Rate',
    'overall_score': 'Overall Score',
    'payment_status': 'Payment Status',
    'skills_progress': 'Skills Progress',
    'recent_activity': 'Recent Activity',
    'group_ranking': 'Group Ranking',
    'weekly_rank': 'Weekly Rank',
    'mock_exam_rank': 'Mock Exam Rank',
    'group_size': 'Group Size',
    'next_due': 'Next due',
    'not_available': 'N/A',
    'parent_portal': 'Parent Portal',
    'parent_role': 'Parent',
    'hello_parent': 'Hello',
    'child_progress_intro': 'Your child progress',
    'parent_account_connected': 'Parent account connected',
    'child_data_not_linked': 'Child data is not linked yet. Please contact the administrator.',
    'back_to_login': 'Back to Login',
    'child_record_not_found': 'Child record not found. Please contact the administrator.',
    'failed_to_load_data': 'Failed to load data. Please try again later.',
    'test_score_received': 'New score added',
    'attendance_marked': 'Attendance updated',
    'criteria_trend': 'Criteria Trend',
    'not_enough_score_data': 'Not enough score data yet.',
    'attendance_history': 'Attendance History',
    'attendance_empty': 'No attendance records yet.',
    'group_leaderboard': 'Group Leaderboard',
    'your_child_position': 'Your Child Position',
    'all_students_ranking': 'All Students Ranking',
    'student_name': 'Student',
    'weekly_score': 'Weekly Score',
    'mock_score': 'Mock Score',
    'rank': 'Rank',
    'no_ranking_data': 'No ranking data yet',
    'fullscreen': 'Fullscreen',
    'open_video': 'Open Video',
    'score_comment_placeholder': 'Write a comment about this score',
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [currentAdmin, setCurrentAdmin] = useState<any | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<any | null>(null);
  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState(false);
  const [currentParent, setCurrentParent] = useState<any | null>(null);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);
  
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [impersonationWarning, setImpersonationWarning] = useState(false);

  useEffect(() => {
    // 1. Sozlamalarni tiklash
    const savedLanguage = localStorage.getItem('kevins_academy_language') as 'uz' | 'en' || 'uz';
    const savedTheme = localStorage.getItem('kevins_academy_theme') as 'light' | 'dark' || 'light';
    setLanguage(savedLanguage);
    setTheme(savedTheme);

    // 2. Admin sessiyasini tiklash
    const savedAdmin = localStorage.getItem('currentAdmin');
    if (savedAdmin) {
      const parsed = JSON.parse(savedAdmin);
      setCurrentAdmin(parsed);
      setIsAdminAuthenticated(true);
      setSessionState({ role: 'admin' });
    }

    // 3. Student sessiyasini tiklash
    const savedStudent = localStorage.getItem('currentStudent');
    if (savedStudent) {
      const parsed = JSON.parse(savedStudent);
      setCurrentStudent(parsed);
      setIsStudentAuthenticated(true);
      if (!savedAdmin) setSessionState({ role: 'student' });
    }

    // 4. Parent sessiyasini tiklash
    const savedParent = localStorage.getItem('currentParent');
    if (savedParent) {
      const parsed = JSON.parse(savedParent);
      setCurrentParent(parsed);
      setIsParentAuthenticated(true);
      if (!savedAdmin && !savedStudent) setSessionState({ role: 'parent' });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kevins_academy_language', language);
    localStorage.setItem('kevins_academy_theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [language, theme]);

  // --- AUTH LOGIKASI (API) ---

  const loginAdmin = async (username: string, password: string): Promise<boolean> => {
    // try API first; fall back to local storage if the endpoint is absent/404
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const admin = await res.json();
        setCurrentAdmin(admin);
        setIsAdminAuthenticated(true);
        setSessionState({ role: 'admin' });
        localStorage.setItem('currentAdmin', JSON.stringify(admin));
        return true;
      }
      // if API responded but not ok, fall through to local check below
    } catch (e) {
      // network error or endpoint missing, we'll try local storage
    }

    // local fallback using raw localStorage data (no API required)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('kevins_academy_admins');
        const admins: any[] = raw ? JSON.parse(raw) : [];
        const admin = admins.find(a => a.username === username);
        if (admin && admin.password === password) {
          setCurrentAdmin(admin);
          setIsAdminAuthenticated(true);
          setSessionState({ role: 'admin' });
          localStorage.setItem('currentAdmin', JSON.stringify(admin));
          return true;
        }
      } catch (err) {
        console.error('fallback login failed:', err);
      }
    }

    return false;
  };

  const logoutAdmin = () => {
    localStorage.removeItem('currentAdmin');
    setCurrentAdmin(null);
    setIsAdminAuthenticated(false);
    setSessionState(currentStudent ? { role: 'student' } : null);
  };

  const loginStudent = async (username: string, password: string, options?: { impersonate?: boolean }) => {
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await res.json();
      if (res.ok) {
        setCurrentStudent(result);
        setIsStudentAuthenticated(true);
        localStorage.setItem('currentStudent', JSON.stringify(result));
        if (options?.impersonate && isAdminAuthenticated) {
          setSessionState({ role: 'admin', viewedAs: 'student' });
          setImpersonationWarning(true);
        } else {
          setSessionState({ role: 'student' });
        }
        return { success: true };
      }
      return { success: false, reason: result.reason };
    } catch (e) { return { success: false, reason: 'error' }; }
  };

  const logoutStudent = () => {
    localStorage.removeItem('currentStudent');
    setCurrentStudent(null);
    setIsStudentAuthenticated(false);
    setSessionState(currentAdmin ? { role: 'admin' } : null);
  };

  const loginParent = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await res.json();
      if (res.ok) {
        setCurrentParent(result);
        setIsParentAuthenticated(true);
        localStorage.setItem('currentParent', JSON.stringify(result));
        setSessionState({ role: 'parent' });
        return { success: true };
      }
      return { success: false, reason: 'not_found' };
    } catch (e) { return { success: false, reason: 'error' }; }
  };

  const logoutParent = () => {
    localStorage.removeItem('currentParent');
    setCurrentParent(null);
    setIsParentAuthenticated(false);
    setSessionState(currentAdmin ? { role: 'admin' } : null);
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLanguage = () => setLanguage(prev => prev === 'uz' ? 'en' : 'uz');
  const t = (key: string) => (translations[language] as any)[key] || key;
  const clearImpersonationWarning = () => setImpersonationWarning(false);
  const impersonating = Boolean(sessionState?.role === 'admin' && sessionState.viewedAs === 'student');

  return (
    <AppContext.Provider value={{
      currentAdmin, loginAdmin, logoutAdmin, isAdminAuthenticated,
      currentStudent, loginStudent, logoutStudent, isStudentAuthenticated,
      currentParent, loginParent, logoutParent, isParentAuthenticated,
      sessionState, impersonating, impersonationWarning, clearImpersonationWarning,
      language, setLanguage, theme, setTheme, toggleTheme, toggleLanguage, t
    }}>
      {children}
    </AppContext.Provider>
  );
};