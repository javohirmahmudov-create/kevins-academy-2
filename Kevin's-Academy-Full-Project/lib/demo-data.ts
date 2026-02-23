// Demo data for testing without MongoDB

export const demoUsers = {
  admin: {
    id: '1',
    username: 'admin',
    password: '$2a$10$YourHashedPasswordHere', // admin123
    fullName: 'Admin User',
    role: 'admin',
    email: 'admin@kevinsacademy.com'
  },
  student: {
    id: '2',
    username: 'student',
    password: '$2a$10$YourHashedPasswordHere', // student123
    fullName: 'John Doe',
    role: 'student',
    email: 'student@kevinsacademy.com'
  },
  parent: {
    id: '3',
    username: 'parent',
    password: '$2a$10$YourHashedPasswordHere', // parent123
    fullName: 'Jane Doe',
    role: 'parent',
  }
};

// Simple passwords for demo (in production, use hashed passwords)
const validPasswords: any = {
  'admin': 'admin123',
  'student': 'student123',
  'parent': 'parent123'
};

// Simple in-memory authentication for demo
export function authenticateUser(username: string, password: string) {
  // Check demo users (admin, parent)
  const userKey = Object.keys(demoUsers).find(key => 
    (demoUsers as any)[key].username === username
  );
  
  if (userKey && validPasswords[username] === password) {
    const user = (demoUsers as any)[userKey];
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  // Check students from localStorage
  if (typeof window !== 'undefined') {
    const studentsData = localStorage.getItem('kevins_academy_students');
    if (studentsData) {
      const students = JSON.parse(studentsData);
      const student = students.find(
        (s: any) => s.username === username && s.password === password
      );
      
      if (student) {
        return {
          id: student.id,
          username: student.username,
          fullName: student.fullName,
          role: 'student',
          email: student.email
        };
      }
    }

    // Check parents from localStorage
    const parentsData = localStorage.getItem('kevins_academy_parents');
    if (parentsData) {
      const parents = JSON.parse(parentsData);
      const parent = parents.find(
        (p: any) => p.username === username && p.password === password
      );
      
      if (parent) {
        return {
          id: parent.id,
          username: parent.username,
          fullName: parent.fullName,
          role: 'parent',
          email: parent.email
        };
      }
    }
  }
  
  return null;
}
