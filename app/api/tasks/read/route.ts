import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.findFirst || !notificationLogDelegate?.create) {
      return NextResponse.json({ ok: false, error: 'Notification log unavailable' }, { status: 503 })
    }

    const body = await request.json()
    const taskId = Number(body?.taskId)
    const studentId = Number(body?.studentId)

    if (!Number.isFinite(taskId) || taskId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'taskId and studentId required' }, { status: 400 })
    }

    const dedupeRecipient = `${taskId}:${studentId}`
    const existing = await notificationLogDelegate.findFirst({
      where: {
        adminId,
        type: 'task_read',
        recipient: dedupeRecipient,
      },
      select: { id: true },
    })

    if (!existing) {
      await notificationLogDelegate.create({
        data: {
          channel: 'web',
          type: 'task_read',
          status: 'read',
          recipient: dedupeRecipient,
          adminId,
          studentId,
          message: JSON.stringify({
            taskId,
            studentId,
            readAt: new Date().toISOString(),
          }),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('tasks read POST error:', error)
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}