import { getAdmins, createAdmin, updateAdmin } from '../lib/storage';

const createDemoAdmin = () => {
  try {
    // 🛡️ XAVFSIZLIK: Turbopack metodni yuklab ulgurmagan bo'lsa, kutib turamiz
    if (typeof getAdmins !== 'function') {
      console.warn('⚠️ storage helpers hali yuklanmadi, 500ms dan keyin qayta uriniladi...');
      setTimeout(createDemoAdmin, 500);
      return null;
    }

    const existingAdmins = getAdmins() || [];

    // Adminlarni qidirish
    let demoAdmin = existingAdmins.find(admin => admin.username === 'admin');
    let kevinAdmin = existingAdmins.find(admin => admin.username === 'kevin_teacher');

    // 1. Demo Admin yaratish/yangilash
    if (!demoAdmin) {
      createAdmin({
        username: 'admin',
        password: 'admin123',
        fullName: 'Demo Administrator',
        email: 'admin@kevinsacademy.com'
      });
    }

    // 2. Kevin Teacher yaratish/yangilash
    if (!kevinAdmin) {
      createAdmin({
        username: 'kevin_teacher',
        password: 'kevin_0209',
        fullName: 'Kevin Teacher',
        email: 'kevin@kevinsacademy.com'
      });
    } else if (kevinAdmin.password !== 'kevin_0209') {
      // Agar parol eski bo'lsa yangilab qo'yamiz
      updateAdmin(kevinAdmin.id, { password: 'kevin_0209' });
    }

    console.log('✅ Demo admins ready!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error setting up demo admins:', error);
    return null;
  }
};

// Faqat brauzerda va xavfsiz kechikish bilan ishga tushiramiz
if (typeof window !== 'undefined') {
  // Sahifa to'liq yuklangandan keyin ishga tushishi uchun
  if (document.readyState === 'complete') {
    createDemoAdmin();
  } else {
    window.addEventListener('load', createDemoAdmin);
  }
}

export { createDemoAdmin };