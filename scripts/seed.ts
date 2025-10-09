import mongoose from 'mongoose';
import { hashPassword } from '../lib/utils/auth';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kevins-academy';

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  fullName: String,
  email: String,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    
    const admin = await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      fullName: 'Admin User',
      email: 'admin@kevinsacademy.com'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');

    // Create demo student
    const studentPassword = await hashPassword('student123');
    const student = await User.create({
      username: 'student',
      password: studentPassword,
      role: 'student',
      fullName: 'John Doe',
      email: 'student@kevinsacademy.com'
    });

    console.log('✅ Demo student created!');
    console.log('Username: student');
    console.log('Password: student123');

    // Create demo parent
    const parentPassword = await hashPassword('parent123');
    const parent = await User.create({
      username: 'parent',
      password: parentPassword,
      role: 'parent',
      fullName: 'Jane Doe',
      email: 'parent@kevinsacademy.com'
    });

    console.log('✅ Demo parent created!');
    console.log('Username: parent');
    console.log('Password: parent123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
