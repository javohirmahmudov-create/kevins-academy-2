// Demo admin yaratish scripti
// Bu script bir marta ishga tushiriladi va demo adminlarni yaratadi

import { getAdmins, createAdmin, getAdminByUsername, updateAdmin } from '../lib/storage';

// Demo admin yaratish
const createDemoAdmin = () => {
  try {
    // Avval adminlar ro'yxatini tekshirish
    const existingAdmins = getAdmins() || [];

    // Agar admin yo'q bo'lsa yoki eski parol bilan bo'lsa, yaratish/yangilash
    let demoAdmin = existingAdmins.find(admin => admin.username === 'admin');
    let kevinAdmin = existingAdmins.find(admin => admin.username === 'kevin_teacher');

    // Admin parollarini tekshirish va yangilash
    if (demoAdmin && demoAdmin.password !== 'admin123') {
      updateAdmin(demoAdmin.id, { password: 'admin123' });
      demoAdmin = getAdminByUsername('admin') || demoAdmin;
    }

    if (kevinAdmin && kevinAdmin.password !== 'kevin_0209') {
      updateAdmin(kevinAdmin.id, { password: 'kevin_0209' });
      kevinAdmin = getAdminByUsername('kevin_teacher') || kevinAdmin;
    }

    // Agar adminlar umuman yo'q bo'lsa, yaratish
    if (!demoAdmin) {
      demoAdmin = createAdmin({
        username: 'admin',
        password: 'admin123',
        fullName: 'Demo Administrator',
        email: 'admin@kevinsacademy.com'
      });
    }

    if (!kevinAdmin) {
      kevinAdmin = createAdmin({
        username: 'kevin_teacher',
        password: 'kevin_0209',
        fullName: 'Kevin Teacher',
        email: 'kevin@kevinsacademy.com'
      });
    }

    console.log('Demo admins ready!');
    console.log('Current Kevin admin password:', kevinAdmin?.password);

    return { demoAdmin, kevinAdmin };
  } catch (error) {
    console.error('Error setting up demo admins:', error);
    return null;
  }
};

// Export for manual execution if needed (useEffect now handles creation in page.tsx)
export { createDemoAdmin };
