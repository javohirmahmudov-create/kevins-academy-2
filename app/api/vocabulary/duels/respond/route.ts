/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { findTelegramChatIdByPhone, sendTelegramMessage } from '@/lib/telegram'

async function logNotification(input: {
  adminId?: number | null
  studentId?: number | null
  channel: string
  type: string
  status: string
  recipient?: string | null
  message: string
  error?: string | null
}) {
  try {
    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.create) return
    await notificationLogDelegate.create({ data: input })
  } catch {
    // no-op
  }
}

function getAppBase(request: Request) {
  const envBase = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')
  try {
    return new URL(request.url).origin
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const body = await request.json()

    const duelId = Number(body?.duelId || 0)
    const studentId = Number(body?.studentId || 0)
    const action = String(body?.action || '').trim().toLowerCase()

    if (!Number.isFinite(duelId) || duelId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'duelId and studentId required' }, { status: 400 })
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
    }

    const duel = await prisma.vocabularyDuel.findUnique({
      where: { id: duelId },
      select: {
        id: true,
        adminId: true,
        challengerId: true,
        opponentId: true,
        status: true,
      },
    })

    if (!duel) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
    }

    if (scopedAdminId && duel.adminId && scopedAdminId !== duel.adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (Number(duel.opponentId) !== studentId) {
      return NextResponse.json({ error: 'Only invited opponent can respond' }, { status: 403 })
    }

    if (duel.status !== 'pending') {
      return NextResponse.json({ error: 'Duel already handled' }, { status: 400 })
    }

    const status = action === 'accept' ? 'active' : 'rejected'
    const now = new Date()

    const updated = await prisma.vocabularyDuel.update({
      where: { id: duel.id },
      data: {
        status,
        acceptedAt: action === 'accept' ? now : undefined,
      },
      select: {
        id: true,
        status: true,
        challengerId: true,
        opponentId: true,
        acceptedAt: true,
        updatedAt: true,
      },
    })

    if (action === 'accept') {
      const [challenger, opponent] = await Promise.all([
        prisma.student.findUnique({ where: { id: Number(duel.challengerId) }, select: { id: true, fullName: true, phone: true } }),
        prisma.student.findUnique({ where: { id: Number(duel.opponentId) }, select: { id: true, fullName: true } }),
      ])

      const base = getAppBase(request)
      const duelUrl = `${base}/student/vocabulary?tab=peer&duel=${duel.id}`
      let sendError = ''

      if (challenger?.phone) {
        try {
          const chatId = await findTelegramChatIdByPhone(challenger.phone)
          if (chatId) {
            const result = await sendTelegramMessage({
              chatId,
              text: `⚔️ Duel qabul qilindi! ${opponent?.fullName || 'Opponent'} tayyor.`,
              buttonUrl: duelUrl,
              buttonText: 'Hoziroq boshlash',
            })
            if (!result.ok) sendError = result.reason
          }
        } catch (error: any) {
          sendError = String(error?.message || 'telegram_send_failed')
        }
      }

      await logNotification({
        adminId: duel.adminId || null,
        studentId: Number(duel.challengerId),
        channel: sendError ? 'inapp' : 'telegram_direct',
        type: 'vocabulary_duel_accept',
        status: sendError ? 'failed' : 'sent',
        recipient: String(duel.challengerId),
        message: `Duel accepted by ${opponent?.fullName || duel.opponentId}`,
        error: sendError || null,
      })
    }

    return NextResponse.json({ ok: true, duel: updated })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
