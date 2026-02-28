import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const student = await prisma.student.findUnique({ where: { username } });
    if (!student || student.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    // omit password before returning, or just return full object if acceptable
    return NextResponse.json(student);
  } catch (e) {
    console.error('student login error', e);
    return NextResponse.json({ error: 'Login error' }, { status: 500 });
  }
}
