import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { sendTaskToTelegramGroups } from '@/lib/telegram'

type TaskPayload = {
  title: string
  group: string
  contentHtml: string
  contentText: string
  deadlineAt?: string | null
  sentAt: string
  studentPanelLink?: string
  attachmentUrl?: string | null
  attachmentType?: string | null
  attachmentComment?: string | null
  delivery?: {
    targetedStudents: number
    telegramTargetedChats: number
    telegramDeliveredChats: number
    telegramFailedChats: number
  }
}

function normalizeGroup(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseTaskPayload(message?: string): TaskPayload | null {
  if (!message) return null
  try {
    const raw = JSON.parse(message)
    const title = String(raw?.title || '').trim()
    const group = String(raw?.group || '').trim()
    const contentHtml = String(raw?.contentHtml || '').trim()
    const contentText = String(raw?.contentText || '').trim()
    const sentAt = String(raw?.sentAt || '').trim()
    if (!title || !group || !sentAt) return null

    return {
      title,
      group,
      contentHtml,
      contentText,
      deadlineAt: raw?.deadlineAt ? String(raw.deadlineAt) : null,
      sentAt,
      studentPanelLink: raw?.studentPanelLink ? String(raw.studentPanelLink) : undefined,
      attachmentUrl: raw?.attachmentUrl ? String(raw.attachmentUrl) : null,
      attachmentType: raw?.attachmentType ? String(raw.attachmentType) : null,
      attachmentComment: raw?.attachmentComment ? String(raw.attachmentComment) : null,
      delivery: raw?.delivery
        ? {
            targetedStudents: Number(raw.delivery.targetedStudents || 0),
            telegramTargetedChats: Number(raw.delivery.telegramTargetedChats || 0),
            telegramDeliveredChats: Number(raw.delivery.telegramDeliveredChats || 0),
            telegramFailedChats: Number(raw.delivery.telegramFailedChats || 0),
          }
        : undefined,
    }
  } catch {
    return null
  }
}

function getTaskStatus(deadlineAt?: string | null) {
  if (!deadlineAt) return 'active'
  const ts = new Date(deadlineAt).getTime()
  if (!Number.isFinite(ts)) return 'active'
  return ts < Date.now() ? 'expired' : 'active'
}

function toSafeIso(value?: string | null) {
  if (!value) return null
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

function groupMatchesTask(taskGroup: string, studentGroup: string) {
  return normalizeGroup(taskGroup) === normalizeGroup(studentGroup)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = String(searchParams.get('mode') || 'admin').trim().toLowerCase()
    const requestedStudentId = Number(searchParams.get('studentId'))

    let adminId = getAdminIdFromRequest(request)
    let resolvedStudent: { id: number; group: string | null } | null = null

    if (!adminId && mode === 'student' && Number.isFinite(requestedStudentId) && requestedStudentId > 0) {
      const studentScope = await prisma.student.findUnique({
        where: { id: requestedStudentId },
        select: { id: true, group: true, adminId: true },
      })

      if (!studentScope?.adminId) {
        return NextResponse.json([])
      }

      adminId = Number(studentScope.adminId)
      resolvedStudent = {
        id: Number(studentScope.id),
        group: studentScope.group || null,
      }
    }

    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.findMany) {
      return NextResponse.json([])
    }

    const taskLogs = await notificationLogDelegate.findMany({
      where: {
        adminId,
        type: 'admin_task',
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const readLogs = await notificationLogDelegate.findMany({
      where: {
        adminId,
        type: 'task_read',
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const readByTask = new Map<number, Set<string>>()
    for (const row of readLogs as any[]) {
      try {
        const payload = JSON.parse(String(row.message || '{}'))
        const taskId = Number(payload?.taskId)
        const studentId = String(payload?.studentId || '').trim()
        if (!Number.isFinite(taskId) || !studentId) continue
        if (!readByTask.has(taskId)) readByTask.set(taskId, new Set())
        readByTask.get(taskId)?.add(studentId)
      } catch {
        continue
      }
    }

    if (mode === 'student') {
      const studentId = requestedStudentId
      if (!Number.isFinite(studentId) || studentId <= 0) {
        return NextResponse.json({ error: 'studentId required' }, { status: 400 })
      }

      const student =
        resolvedStudent ||
        (await prisma.student.findFirst({
          where: { id: studentId, adminId },
          select: { id: true, group: true },
        }))

      if (!student) {
        return NextResponse.json([])
      }

      const studentGroup = String(student.group || '').trim()
      const tasks = (taskLogs as any[])
        .map((row) => {
          const payload = parseTaskPayload(String(row.message || ''))
          if (!payload) return null
          if (!groupMatchesTask(payload.group, studentGroup)) return null
          const reads = readByTask.get(Number(row.id)) || new Set<string>()
          return {
            id: Number(row.id),
            title: payload.title,
            group: payload.group,
            contentHtml: payload.contentHtml,
            contentText: payload.contentText,
            deadlineAt: payload.deadlineAt || null,
            sentAt: payload.sentAt,
            status: getTaskStatus(payload.deadlineAt || null),
            attachmentUrl: payload.attachmentUrl || null,
            attachmentType: payload.attachmentType || null,
            studentPanelLink: payload.studentPanelLink || null,
            isRead: reads.has(String(student.id)),
          }
        })
        .filter(Boolean)

      return NextResponse.json(tasks)
    }

    const adminTasks = (taskLogs as any[])
      .map((row) => {
        const payload = parseTaskPayload(String(row.message || ''))
        if (!payload) return null
        const reads = readByTask.get(Number(row.id)) || new Set<string>()
        const targetedStudents = Math.max(0, Number(payload.delivery?.targetedStudents || 0))
        const telegramDeliveredChats = Math.max(0, Number(payload.delivery?.telegramDeliveredChats || 0))
        const deliveryCount = targetedStudents + telegramDeliveredChats
        const readCount = reads.size
        const openRate = deliveryCount > 0 ? Math.round((readCount / deliveryCount) * 100) : 0

        return {
          id: Number(row.id),
          title: payload.title,
          group: payload.group,
          contentHtml: payload.contentHtml,
          contentText: payload.contentText,
          deadlineAt: payload.deadlineAt || null,
          sentAt: payload.sentAt,
          status: getTaskStatus(payload.deadlineAt || null),
          attachmentUrl: payload.attachmentUrl || null,
          attachmentType: payload.attachmentType || null,
          deliveryCount,
          readCount,
          openRate,
          analytics: {
            targetedStudents,
            telegramTargetedChats: Math.max(0, Number(payload.delivery?.telegramTargetedChats || 0)),
            telegramDeliveredChats,
            telegramFailedChats: Math.max(0, Number(payload.delivery?.telegramFailedChats || 0)),
          },
        }
      })
      .filter(Boolean)

    return NextResponse.json(adminTasks)
  } catch (error) {
    console.error('tasks GET error:', error)
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.create || !notificationLogDelegate?.update) {
      return NextResponse.json({ error: 'Notification log unavailable' }, { status: 503 })
    }

    const body = await request.json()
    const title = String(body?.title || '').trim()
    const group = String(body?.group || '').trim()
    const contentHtml = String(body?.contentHtml || '').trim()
    const contentText = String(body?.contentText || '').trim()
    const attachmentUrl = String(body?.attachmentUrl || '').trim()
    const attachmentType = String(body?.attachmentType || '').trim()
    const attachmentComment = String(body?.attachmentComment || '').trim()
    const deadlineAt = toSafeIso(String(body?.deadlineAt || '').trim())

    if (!title || !group || (!contentHtml && !contentText)) {
      return NextResponse.json({ error: 'title, group, content required' }, { status: 400 })
    }

    const sentAt = new Date().toISOString()
    const appBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://kevins-academy.com'
    const studentPanelLink = `${String(appBase).replace(/\/$/, '')}/student/homework`
    const targetedStudents = await prisma.student.count({ where: { adminId, group } })

    const linkedGroup = await prisma.group.findFirst({
      where: {
        adminId,
        name: group,
      },
      select: {
        id: true,
        telegramChatId: true,
      },
    })

    const resolvedTelegramChatId = String(linkedGroup?.telegramChatId || '').trim()
    if (!resolvedTelegramChatId) {
      return NextResponse.json(
        {
          error: 'Ushbu guruhga Telegram ID ulanmagan. Iltimos, sozlamalardan ID qo\'shing',
        },
        { status: 400 }
      )
    }

    const created = await notificationLogDelegate.create({
      data: {
        channel: 'system',
        type: 'admin_task',
        status: 'queued',
        recipient: group,
        adminId,
        message: JSON.stringify({
          title,
          group,
          contentHtml,
          contentText,
          deadlineAt,
          sentAt,
          studentPanelLink,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentComment: attachmentComment || null,
          delivery: {
            targetedStudents,
            telegramTargetedChats: 0,
            telegramDeliveredChats: 0,
            telegramFailedChats: 0,
          },
        }),
      },
    })

    const telegramResult = await sendTaskToTelegramGroups({
      groupName: group,
      title,
      contentText: contentText || contentHtml,
      deadlineAt,
      studentPanelUrl: studentPanelLink,
      chatIds: [resolvedTelegramChatId],
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentComment: attachmentComment || null,
    })

    await notificationLogDelegate.update({
      where: { id: Number(created.id) },
      data: {
        status:
          telegramResult.deliveredChats === 0
            ? 'failed'
            : telegramResult.failedChats > 0
              ? 'partial'
              : 'sent',
        message: JSON.stringify({
          title,
          group,
          contentHtml,
          contentText,
          deadlineAt,
          sentAt,
          studentPanelLink,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentComment: attachmentComment || null,
          delivery: {
            targetedStudents,
            telegramTargetedChats: telegramResult.targetedChats,
            telegramDeliveredChats: telegramResult.deliveredChats,
            telegramFailedChats: telegramResult.failedChats,
          },
        }),
      },
    })

    if (telegramResult.targetedChats > 0 && telegramResult.deliveredChats === 0) {
      return NextResponse.json(
        {
          error: `Telegram guruhga yuborilmadi (0/${telegramResult.targetedChats}). Bot guruhda admin ekanini va token to‘g‘riligini tekshiring.`,
          delivery: {
            targetedStudents,
            telegramTargetedChats: telegramResult.targetedChats,
            telegramDeliveredChats: telegramResult.deliveredChats,
            telegramFailedChats: telegramResult.failedChats,
          },
        },
        { status: 502 }
      )
    }

    const warning =
      telegramResult.failedChats > 0
        ? `Telegram qisman yuborildi (${telegramResult.deliveredChats}/${telegramResult.targetedChats}).`
        : undefined

    return NextResponse.json({
      id: Number(created.id),
      title,
      group,
      sentAt,
      deadlineAt,
      warning,
      delivery: {
        targetedStudents,
        telegramTargetedChats: telegramResult.targetedChats,
        telegramDeliveredChats: telegramResult.deliveredChats,
        telegramFailedChats: telegramResult.failedChats,
      },
    })
  } catch (error) {
    console.error('tasks POST error:', error)
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}