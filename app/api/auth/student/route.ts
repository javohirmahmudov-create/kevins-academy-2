import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { detectDeviceType, getClientIp, logUserActivity } from '@/lib/activity'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const student = await prisma.student.findUnique({ where: { username } });
    if (!student || student.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const userAgent = req.headers.get('user-agent') || ''
    const sessionId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    await logUserActivity({
      version: 1,
      event: 'login',
      role: 'student',
      userId: String(student.id),
      fullName: String(student.fullName || 'Student'),
      adminId: Number.isFinite(Number(student.adminId)) ? Number(student.adminId) : null,
      group: student.group || null,
      sessionId,
      loginAt: nowIso,
      lastSeenAt: nowIso,
      deviceType: detectDeviceType(userAgent),
      userAgent,
      ipAddress: getClientIp(req),
    })

    return NextResponse.json({
      ...student,
      activitySessionId: sessionId,
      activityLoginAt: nowIso,
    });
  } catch (e) {
    console.error('student login error', e);
    return NextResponse.json({ error: 'Login error' }, { status: 500 });
  }
}
