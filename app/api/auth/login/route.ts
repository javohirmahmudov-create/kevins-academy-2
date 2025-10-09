import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/demo-data';
import { generateToken } from '@/lib/utils/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Authenticate user (demo mode - no MongoDB needed)
    let user = authenticateUser(username, password);
    
    // If not found in demo users, check students from request body
    if (!user) {
      const studentsHeader = request.headers.get('x-students-data');
      if (studentsHeader) {
        try {
          const students = JSON.parse(studentsHeader);
          const student = students.find(
            (s: any) => s.username === username && s.password === password
          );
          
          if (student) {
            user = {
              id: student.id,
              username: student.username,
              fullName: student.fullName,
              role: 'student',
              email: student.email
            };
          }
        } catch (e) {
          console.error('Error parsing students data:', e);
        }
      }
    }

    // Check parents from request headers
    if (!user) {
      const parentsHeader = request.headers.get('x-parents-data');
      if (parentsHeader) {
        try {
          const parents = JSON.parse(parentsHeader);
          const parent = parents.find(
            (p: any) => p.username === username && p.password === password
          );
          
          if (parent) {
            user = {
              id: parent.id,
              username: parent.username,
              fullName: parent.fullName,
              role: 'parent',
              email: parent.email
            };
          }
        } catch (e) {
          console.error('Error parsing parents data:', e);
        }
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    return NextResponse.json({
      token,
      user
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
