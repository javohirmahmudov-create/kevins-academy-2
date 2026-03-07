import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { formatTelegramDate } from '@/lib/telegram'
import { sendHybridNotification } from '@/lib/notifications'

const DAY_MS = 24 * 60 * 60 * 1000
const dailyCache = new Map<string, number>()
const DEFAULT_CARD_NUMBER = '9860 3501 4447 3575'
const DEFAULT_CARD_EXPIRES = '08/30'
const DEFAULT_BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Tashkent'

function getDatePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0)
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0)
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0)
  return { year, month, day }
}

function daysBetweenLocalDates(laterDate: Date, earlierDate: Date) {
  const later = getDatePartsInTimezone(laterDate, DEFAULT_BUSINESS_TIMEZONE)
  const earlier = getDatePartsInTimezone(earlierDate, DEFAULT_BUSINESS_TIMEZONE)
  const laterUtcDay = Date.UTC(later.year, later.month - 1, later.day)
  const earlierUtcDay = Date.UTC(earlier.year, earlier.month - 1, earlier.day)
  return Math.round((laterUtcDay - earlierUtcDay) / DAY_MS)
}

function buildCardPaymentUrl(origin?: string) {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  const appBase = origin || process.env.NEXT_PUBLIC_APP_URL || process.env.PARENT_PORTAL_URL || vercelUrl || ''
  if (appBase) {
    return `${appBase.replace(/\/$/, '')}/pay`
  }
  return process.env.PAYMENT_CARD_URL || process.env.NEXT_PUBLIC_PAYMENT_CARD_URL || 'https://payme.uz/home/main'
}

function getCardInfoText() {
  const cardNumber = process.env.PAYMENT_CARD_NUMBER || DEFAULT_CARD_NUMBER
  const cardExpires = process.env.PAYMENT_CARD_EXPIRES || DEFAULT_CARD_EXPIRES
  return `${cardNumber} (${cardExpires})`
}

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

  if (status === 'paid' || !endDate) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
    }
  }

  const overdueDayDiff = Math.max(0, daysBetweenLocalDates(now, endDate))
  if (overdueDayDiff <= 0) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
    }
  }

  const overdueDays = overdueDayDiff + 1

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
    const requestOrigin = new URL(request.url).origin

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
      const buttonUrl = buildCardPaymentUrl(requestOrigin)
      const dueText = formatTelegramDate(payment.endDate || payment.dueDate)
      const text = `🚨 <b>Kunlik to'lov eslatmasi</b>\n\n📅 To'lov muddati: <b>${dueText}</b>\n⏳ Kechikish: <b>${calc.overdueDays} kun</b>\n💸 Jami to'lov: <b>${Number(calc.totalDue).toLocaleString('uz-UZ')} so'm</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`
      const smsText = `Kevin's Academy: Kunlik eslatma. To'lov muddati o'tgan (${calc.overdueDays} kun). Jami: ${Number(calc.totalDue).toLocaleString('uz-UZ')} so'm. Karta: ${getCardInfoText()}.`

      await sendHybridNotification({
        adminId: payment.adminId,
        studentId: payment.studentId,
        type: 'payment',
        telegramText: text,
        smsText,
        telegramOptions: {
          buttonText: "💳 Karta orqali to'lash",
          buttonUrl,
          copyCardButtonText: '📋 Kartani nusxalash',
          copyCardCallbackData: 'copy_card_details',
          modeButtons: false,
        }
      })

      sent += 1
    }

    return NextResponse.json({ ok: true, scanned: overduePayments.length, sent })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}
