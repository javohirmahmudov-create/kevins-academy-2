import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildParentPortalUrl, formatTelegramDate, notifyParentsByStudentId, queueTelegramTask } from '@/lib/telegram'
import { notifyParentsByStudentIdSms, queueSmsTask } from '@/lib/sms'

const DAY_MS = 24 * 60 * 60 * 1000
const dailyCache = new Map<string, number>()

function canRun(request: Request) {
  const secret = process.env.PAYMENT_REMINDER_CRON_SECRET || process.env.CRON_SECRET || ''
  if (!secret) return true

  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

function calculatePenalty(input: {
  status?: string | null
  amount?: number | null
  endDate?: Date | null
  dueDate?: Date | null
  penaltyPerDay?: number | null
}) {
  const status = input.status || 'pending'
  const amount = Number(input.amount || 0)
  const endDate = input.endDate || input.dueDate || null
  const penaltyPerDay = Number(input.penaltyPerDay || 10000)
  const now = new Date()

  if (status === 'paid' || !endDate || now <= endDate) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
    }
  }

  const overdueDays = Math.max(1, Math.floor((now.getTime() - endDate.getTime()) / DAY_MS))
  const penaltyAmount = overdueDays * penaltyPerDay
  const totalDue = amount + penaltyAmount

  return {
    overdueDays,
    penaltyAmount,
    totalDue,
    isOverdue: true,
  }
}

function getDayKey(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(request: Request) {
  try {
    if (!canRun(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const todayKey = getDayKey(now)

    const overduePayments = await prisma.payment.findMany({
      where: {
        studentId: { not: null },
        status: { not: 'paid' },
        OR: [
          { endDate: { lt: now } },
          { dueDate: { lt: now } },
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        adminId: true,
        studentId: true,
        amount: true,
        dueDate: true,
        endDate: true,
        penaltyPerDay: true,
        status: true,
      }
    })

    let sent = 0

    for (const payment of overduePayments) {
      if (!payment.studentId) continue

      const cacheKey = `${payment.id}:${todayKey}`
      if (dailyCache.has(cacheKey)) continue

      const calc = calculatePenalty({
        status: payment.status,
        amount: payment.amount,
        endDate: payment.endDate,
        dueDate: payment.dueDate,
        penaltyPerDay: payment.penaltyPerDay,
      })

      if (!calc.isOverdue) continue

      dailyCache.set(cacheKey, Date.now())
      const buttonUrl = buildParentPortalUrl()
      const dueText = formatTelegramDate(payment.endDate || payment.dueDate)
      const text = `🚨 <b>Kunlik to'lov eslatmasi</b>\n\n📅 To'lov muddati: <b>${dueText}</b>\n⏳ Kechikish: <b>${calc.overdueDays} kun</b>\n💸 Jami to'lov: <b>${Number(calc.totalDue).toLocaleString('uz-UZ')} so'm</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`
      const smsText = `Kevin's Academy: Kunlik eslatma. To'lov muddati o'tgan (${calc.overdueDays} kun). Jami: ${Number(calc.totalDue).toLocaleString('uz-UZ')} so'm.`

      queueTelegramTask(async () => {
        await notifyParentsByStudentId({
          adminId: payment.adminId,
          studentId: payment.studentId,
          text,
          buttonText: "Batafsil ko'rish",
          buttonUrl,
        })
      })

      queueSmsTask(async () => {
        await notifyParentsByStudentIdSms({
          adminId: payment.adminId,
          studentId: payment.studentId,
          text: smsText,
        })
      })

      sent += 1
    }

    return NextResponse.json({ ok: true, scanned: overduePayments.length, sent })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}
