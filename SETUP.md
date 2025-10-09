# 🚀 Kevin's Academy - Setup Guide

## Step-by-Step Installation

### 1. Install MongoDB

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Check if MongoDB is running:**
```bash
mongosh
# If connected successfully, type: exit
```

### 2. Create Environment File

Create a file named `.env.local` in the project root:

```bash
cd /Users/javohirmahmudov/CascadeProjects/kevins-academy
touch .env.local
```

Add this content to `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/kevins-academy
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Seed the Database

Create demo users (admin, student, parent):

```bash
npm run seed
```

**Demo Credentials Created:**
- Admin: `admin` / `admin123`
- Student: `student` / `student123`
- Parent: `parent` / `parent123`

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎯 Quick Test

1. **Login as Admin:**
   - Username: `admin`
   - Password: `admin123`
   - You'll see the Admin Dashboard

2. **Login as Student:**
   - Username: `student`
   - Password: `student123`
   - You'll see the Student Portal

3. **Login as Parent:**
   - Username: `parent`
   - Password: `parent123`
   - You'll see the Parent Portal

## 🔧 Troubleshooting

### MongoDB Connection Error

**Error:** `MongoServerError: connect ECONNREFUSED`

**Solution:**
```bash
# Start MongoDB
brew services start mongodb-community

# Or run manually
mongod --dbpath /usr/local/var/mongodb
```

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript Errors

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

## 📱 Access from Mobile

1. **Find your computer's IP:**
```bash
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

2. **Make sure your phone and computer are on the same WiFi**

3. **Open on mobile:**
```
http://192.168.1.100:3000
```

## 🌐 Deploy to Production

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Option 2: MongoDB Atlas (Cloud Database)

1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Get connection string
4. Update `.env.local`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kevins-academy
```

## 📚 Next Steps

- [ ] Customize the design
- [ ] Add more features
- [ ] Setup email notifications
- [ ] Add file upload functionality
- [ ] Create mobile app

## 🆘 Need Help?

Check the main [README.md](./README.md) for full documentation.

---

**Happy Coding! 🎉**
