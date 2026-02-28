import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin || admin.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    return NextResponse.json(admin);
  } catch (e) {
    return NextResponse.json({ error: 'Login error' }, { status: 500 });
  }
}