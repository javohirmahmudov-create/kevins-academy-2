# 🎓 Kevin's Academy - Advanced English Education System

A comprehensive, modern education management platform built with Next.js, TypeScript, and MongoDB.

## ✨ Features

### 👨‍💼 Admin Panel
- **User Management**: Create, edit, delete students and parents
- **Group Management**: Organize students into learning groups (Beginner → Advanced)
- **Material Upload**: Upload PDFs, videos, images, and text materials
- **Scoring System**: Track student progress across multiple skills
- **Attendance Tracking**: Monitor student attendance with visual charts
- **Payment Management**: Track monthly payments and send reminders

### 🎓 Student Panel
- **View Lessons**: Access learning materials for your group
- **Submit Homework**: Upload assignments directly to teachers
- **Track Progress**: View scores and performance metrics
- **Attendance Report**: See your attendance history
- **Feedback**: Receive teacher comments and feedback

### 👨‍👩‍👧 Parent Panel
- **Monitor Progress**: View child's scores and performance
- **Attendance Overview**: Track child's attendance
- **Payment Status**: View payment history and due dates
- **Notifications**: Receive alerts about performance and payments

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB installed and running

### Installation

1. **Clone the repository**
```bash
cd /Users/javohirmahmudov/CascadeProjects/kevins-academy
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup MongoDB**

Make sure MongoDB is running on your system:
```bash
# Start MongoDB (macOS)
brew services start mongodb-community

# Or run manually
mongod --dbpath /usr/local/var/mongodb
```

4. **Create environment file**

Create a file named `.env.local` in the root directory:
```bash
MONGODB_URI=mongodb://localhost:27017/kevins-academy
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

5. **Seed the database**

Create demo users:
```bash
npx ts-node scripts/seed.ts
```

This will create:
- **Admin**: username: `admin`, password: `admin123`
- **Student**: username: `student`, password: `student123`
- **Parent**: username: `parent`, password: `parent123`

6. **Run the development server**
```bash
npm run dev
```

7. **Open the app**

Visit [http://localhost:3000](http://localhost:3000)

## 🔐 Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Student | student | student123 |
| Parent | parent | parent123 |

## 📁 Project Structure

```
kevins-academy/
├── app/
│   ├── admin/          # Admin dashboard
│   ├── student/        # Student portal
│   ├── parent/         # Parent portal
│   ├── api/            # API routes
│   └── page.tsx        # Login page
├── components/
│   ├── admin/          # Admin components
│   ├── student/        # Student components
│   ├── parent/         # Parent components
│   └── ui/             # Shared UI components
├── lib/
│   ├── models/         # MongoDB models
│   └── utils/          # Utility functions
└── scripts/
    └── seed.ts         # Database seeding
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: TailwindCSS, Framer Motion
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB, Mongoose
- **Authentication**: JWT, bcryptjs
- **Charts**: Recharts
- **Icons**: Lucide React

## 📊 Database Models

- **User**: Admin, Student, Parent accounts
- **Group**: Learning groups/classes
- **Material**: Learning resources (PDF, video, etc.)
- **Score**: Student performance tracking
- **Attendance**: Daily attendance records
- **Payment**: Monthly payment tracking
- **Homework**: Student submissions

## 🎨 Design Features

- Modern gradient UI (Blue & Purple theme)
- Smooth animations with Framer Motion
- Fully responsive design
- Clean and intuitive interface
- Professional dashboard layouts

## 🔧 Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📝 TODO / Future Features

- [ ] File upload to AWS S3 / Firebase Storage
- [ ] Email notifications
- [ ] SMS reminders for payments
- [ ] Downloadable certificates (PDF)
- [ ] Multi-language support (English/Uzbek)
- [ ] Advanced analytics dashboard
- [ ] Video conferencing integration
- [ ] Mobile app (React Native)

## 🤝 Contributing

This is a private project for Kevin's Academy. For any questions or support, contact the development team.

## 📄 License

© 2024 Kevin's Academy. All rights reserved.

---

**Built with ❤️ by Cascade AI**
