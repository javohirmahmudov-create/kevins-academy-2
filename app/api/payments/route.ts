import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { formatTelegramDate } from '@/lib/telegram'
import { sendHybridNotification, sendPaymentNotification } from '@/lib/notifications'

const DAY_MS = 24 * 60 * 60 * 1000
const overdueReminderSentCache = new Map<string, number>()
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

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function parseValidDate(value: unknown): Date | null {
  if (!value) return null
  const parsed = new Date(String(value))
  return isValidDate(parsed) ? parsed : null
}

function daysBetweenLocalDates(laterDate: Date, earlierDate: Date) {
  if (!isValidDate(laterDate) || !isValidDate(earlierDate)) return 0
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

function getDayKey(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatUzCurrency(value: number) {
  return `${Number(value || 0).toLocaleString('uz-UZ')} so'm`
}

function formatUzDateTime(value?: Date | null) {
  if (!value || !isValidDate(value)) return '-'
  return new Intl.DateTimeFormat('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function buildOverduePaymentTexts(input: {
  dueDate?: Date | null
  overdueDays: number
  penaltyAmount: number
  totalDue: number
  penaltyPerDay: number
}) {
  const dueText = formatTelegramDate(input.dueDate)
  const overdueDays = Number(input.overdueDays || 0)
  const penaltyPerDay = Number(input.penaltyPerDay || 0)

  const telegramText = `🚨 <b>To'lov muddati o'tgan</b>\n\n📅 To'lov muddati: <b>${dueText}</b>\n⏳ Kechikish: <b>${overdueDays} kun</b>\n🧮 Jarima: <b>${formatUzCurrency(input.penaltyAmount)} (${overdueDays} × ${formatUzCurrency(penaltyPerDay)})</b>\n💸 Jami to'lov: <b>${formatUzCurrency(input.totalDue)}</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`

  const smsText = `Kevin's Academy: To'lov muddati o'tgan. Muddat: ${dueText}. Kechikish ${overdueDays} kun. Jarima: ${formatUzCurrency(input.penaltyAmount)}. Jami: ${formatUzCurrency(input.totalDue)}. Karta: ${getCardInfoText()}.`

  return { telegramText, smsText }
}

async function sendPaymentNotice(input: {
  adminId?: number | null
  studentId?: number | null
  text: string
  smsText: string
  origin?: string
}) {
  if (!input.studentId) return
  const buttonUrl = buildCardPaymentUrl(input.origin)
  await sendHybridNotification({
    adminId: input.adminId,
    studentId: input.studentId,
    type: 'payment',
    telegramText: input.text,
    smsText: input.smsText,
    telegramOptions: {
      buttonText: "💳 Karta orqali to'lash",
      buttonUrl,
      copyCardButtonText: '📋 Kartani nusxalash',
      copyCardCallbackData: 'copy_card_details',
      modeButtons: false,
    }
  })
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

  if (status === 'paid' || !endDate || !isValidDate(endDate)) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
      displayStatus: status
    }
  }

  const overdueDayDiff = Math.max(0, daysBetweenLocalDates(now, endDate))
  if (overdueDayDiff <= 0) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
      displayStatus: status
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
    displayStatus: 'overdue'
  }
}

async function resolveStudentId(input: { studentId?: string | number; studentName?: string; adminId?: number | null }) {
  if (input.studentId !== undefined && input.studentId !== null && String(input.studentId).trim() !== '') {
    const parsed = Number(input.studentId)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (input.studentName) {
    const student = await prisma.student.findFirst({
      where: {
        fullName: input.studentName,
        ...(input.adminId ? { adminId: Number(input.adminId) } : {}),
      }
    })
    return student?.id ?? null
  }

  return null
}

function isDueSoon(status?: string | null, dueDate?: Date | null) {
  if (!dueDate) return false
  if (status === 'paid') return false

  const diffDays = daysBetweenLocalDates(dueDate, new Date())
  return diffDays >= 0 && diffDays <= 3
}

function isAlreadyOverdue(status?: string | null, dueDate?: Date | null) {
  if (status === 'overdue') return true
  if (!dueDate) return false
  if (status === 'paid') return false
  return daysBetweenLocalDates(new Date(), dueDate) > 0
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const requestOrigin = new URL(request.url).origin
    const payments = await prisma.payment.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            fullName: true
          }
        }
      }
    })

    const normalized = (Array.isArray(payments) ? payments : []).map((item) => {
      const penalty = calculatePenalty({
        status: item.status,
        amount: item.amount,
        endDate: item.endDate,
        dueDate: item.dueDate,
        penaltyPerDay: item.penaltyPerDay
      })

      return {
        ...item,
        studentName: item.student?.fullName || item.studentName || undefined,
        ...penalty,
        warning: penalty.isOverdue
          ? `Muddat o'tgan: ${penalty.overdueDays} kun. Har kunlik penya ${Number(item.penaltyPerDay || 10000).toLocaleString('uz-UZ')} so'm.`
          : null
      }
    })

    const todayKey = getDayKey()
    for (const item of normalized) {
      if (!item?.isOverdue || !item?.studentId || item?.status === 'paid') continue

      const cacheKey = `${item.id}:${todayKey}`
      if (overdueReminderSentCache.has(cacheKey)) continue

      overdueReminderSentCache.set(cacheKey, Date.now())

      const overdueNotice = buildOverduePaymentTexts({
        dueDate: item.endDate || item.dueDate,
        overdueDays: Number(item.overdueDays || 0),
        penaltyAmount: Number(item.penaltyAmount || 0),
        totalDue: Number(item.totalDue || item.amount || 0),
        penaltyPerDay: Number(item.penaltyPerDay || 0),
      })

      await sendPaymentNotice({
        adminId,
        studentId: item.studentId,
        text: overdueNotice.telegramText,
        smsText: overdueNotice.smsText,
        origin: requestOrigin,
      })
    }

    return NextResponse.json(normalized)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const requestOrigin = new URL(request.url).origin
    const studentId = await resolveStudentId({ ...body, adminId })
    const status = body.status || 'pending'
    const dueDate = parseValidDate(body.dueDate)
    const startDate = parseValidDate(body.startDate)
    const endDate = parseValidDate(body.endDate) || dueDate
    const penaltyPerDay = Number(body.penaltyPerDay || 10000)
    const paidAt = parseValidDate(body.paidAt)
      ? parseValidDate(body.paidAt)
      : status === 'paid'
        ? new Date()
        : null

    const resolvedStudentName = body.studentName
      || (studentId
        ? (await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true } }))?.fullName
        : null)

    const payment = await prisma.payment.create({
      data: {
        adminId,
        studentId,
        studentName: resolvedStudentName || null,
        amount: Number(body.amount) || 0,
        status,
        month: body.month || null,
        dueDate,
        startDate,
        endDate,
        penaltyPerDay,
        paidAt,
        note: body.note || null
      }
    })

    if (studentId) {
      const nextDueText = formatTelegramDate(endDate || dueDate)
      const startText = formatTelegramDate(startDate)
      const effectiveDueDate = endDate || dueDate
      const penalty = calculatePenalty({
        status,
        amount: Number(body.amount) || 0,
        endDate: effectiveDueDate,
        dueDate,
        penaltyPerDay,
      })

      if (status === 'paid') {
        await sendPaymentNotification({
          adminId,
          studentId,
          balanceAmount: Number(body.amount) || 0,
          paymentUrl: buildCardPaymentUrl(requestOrigin),
        })
      } else if (isAlreadyOverdue(status, effectiveDueDate)) {
        const overdueNotice = buildOverduePaymentTexts({
          dueDate: effectiveDueDate,
          overdueDays: Number(penalty.overdueDays || 0),
          penaltyAmount: Number(penalty.penaltyAmount || 0),
          totalDue: Number(penalty.totalDue || body.amount || 0),
          penaltyPerDay,
        })
        await sendPaymentNotice({ adminId, studentId, text: overdueNotice.telegramText, smsText: overdueNotice.smsText, origin: requestOrigin })
      } else if (startDate || endDate || dueDate) {
        const text = `🧾 <b>To'lov davri belgilandi</b>\n\n📅 Boshlanish sanasi: <b>${startText}</b>\n📌 Tugash (to'lov) sanasi: <b>${nextDueText}</b>\n\nEslatma shu muddat asosida yuboriladi.`
        const smsText = `Kevin's Academy: To'lov davri belgilandi. Boshlanish: ${startText}. Tugash: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText, origin: requestOrigin })
      } else if (isDueSoon(status, endDate || dueDate)) {
        const text = `⏰ <b>To'lov eslatmasi</b>\n\nTo'lov muddati yaqinlashmoqda.\n📅 To'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov muddati yaqin. To'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText, origin: requestOrigin })
      }
    }

    return NextResponse.json(payment)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const requestOrigin = new URL(request.url).origin
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const beforePayment = adminId
      ? await prisma.payment.findFirst({ where: { id, adminId } })
      : await prisma.payment.findUnique({ where: { id } })

    if (!beforePayment) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const studentId = await resolveStudentId({ ...body, adminId })
    const status = body.status || undefined
    const dueDate = body.dueDate !== undefined ? parseValidDate(body.dueDate) : undefined
    const endDate = body.endDate !== undefined ? parseValidDate(body.endDate) : dueDate

    const resolvedStudentName = body.studentName !== undefined
      ? (body.studentName || null)
      : (studentId
        ? (await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true } }))?.fullName || null
        : undefined)

    const parsedPaidAt = parseValidDate(body.paidAt)
    const paidAt = parsedPaidAt
      ? parsedPaidAt
      : status === 'paid'
        ? new Date()
        : status === 'pending' || status === 'overdue'
          ? null
          : undefined

    const data = {
      studentId,
      studentName: resolvedStudentName,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      status,
      month: body.month !== undefined ? body.month || null : undefined,
      dueDate,
      startDate: body.startDate !== undefined ? parseValidDate(body.startDate) : undefined,
      endDate,
      penaltyPerDay: body.penaltyPerDay !== undefined ? Number(body.penaltyPerDay || 10000) : undefined,
      paidAt,
      note: body.note !== undefined ? body.note || null : undefined
    }

    const payment = await prisma.payment.update({ where: { id }, data })

    if (payment.studentId) {
      const nextDueDate = payment.endDate || payment.dueDate
      const nextDueText = formatTelegramDate(nextDueDate)
      const startText = formatTelegramDate(payment.startDate)
      const previousStatus = String(beforePayment.status || 'pending')
      const currentStatus = String(payment.status || 'pending')
      const statusChanged = previousStatus !== currentStatus
      const amountChanged = Number(beforePayment.amount || 0) !== Number(payment.amount || 0)
      const paidAtChanged = String(beforePayment.paidAt || '') !== String(payment.paidAt || '')
      const penalty = calculatePenalty({
        status: payment.status,
        amount: payment.amount,
        endDate: nextDueDate,
        dueDate: payment.dueDate,
        penaltyPerDay: payment.penaltyPerDay,
      })

      let handledStatusNotification = false

      if (currentStatus === 'paid' && (statusChanged || amountChanged || paidAtChanged)) {
        const paidAtText = formatUzDateTime(payment.paidAt ? new Date(payment.paidAt) : new Date())
        const totalPaid = Number(payment.totalDue || payment.amount || 0)
        const paidText = [
          `✅ <b>To'lov qabul qilindi</b>`,
          `💸 Summa: <b>${formatUzCurrency(totalPaid)}</b>`,
          `🕒 To'langan vaqt: <b>${paidAtText}</b>`,
          nextDueDate ? `📅 To'lov oralig'i tugashi: <b>${formatTelegramDate(nextDueDate)}</b>` : '',
        ].filter(Boolean).join('\n')

        const paidSmsText = `Kevin's Academy: To'lov qabul qilindi. Summa: ${formatUzCurrency(totalPaid)}. To'langan vaqt: ${paidAtText}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text: paidText, smsText: paidSmsText, origin: requestOrigin })
        handledStatusNotification = true
      }

      if (!handledStatusNotification && previousStatus === 'paid' && currentStatus !== 'paid' && statusChanged) {
        const dueText = formatTelegramDate(nextDueDate)
        const unpaidText = [
          `⚠️ <b>To'lov holati yangilandi</b>`,
          `📌 Hozirgi holat: <b>Kutilmoqda</b>`,
          `💰 To'lov summasi: <b>${formatUzCurrency(Number(payment.amount || 0))}</b>`,
          `📅 To'lov sanasi: <b>${dueText}</b>`,
        ].join('\n')

        const unpaidSmsText = `Kevin's Academy: To'lov holati kutilmoqda. Summa: ${formatUzCurrency(Number(payment.amount || 0))}. To'lov sanasi: ${dueText}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text: unpaidText, smsText: unpaidSmsText, origin: requestOrigin })
        handledStatusNotification = true
      }

      if (!handledStatusNotification && isAlreadyOverdue(payment.status, nextDueDate)) {
        const overdueNotice = buildOverduePaymentTexts({
          dueDate: nextDueDate,
          overdueDays: Number(penalty.overdueDays || 0),
          penaltyAmount: Number(penalty.penaltyAmount || 0),
          totalDue: Number(penalty.totalDue || payment.amount || 0),
          penaltyPerDay: Number(payment.penaltyPerDay || 10000),
        })
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text: overdueNotice.telegramText, smsText: overdueNotice.smsText, origin: requestOrigin })
      } else if (!handledStatusNotification && (payment.startDate || payment.endDate || payment.dueDate)) {
        const text = `🧾 <b>To'lov davri yangilandi</b>\n\n📅 Boshlanish sanasi: <b>${startText}</b>\n📌 Tugash (to'lov) sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov davri yangilandi. Boshlanish: ${startText}. Tugash: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText, origin: requestOrigin })
      } else if (!handledStatusNotification && isDueSoon(payment.status, nextDueDate)) {
        const text = `🔔 <b>To'lov muddati yaqin</b>\n\nTo'lov muddati yaqinlashmoqda.\n📅 To'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov muddati yaqin. To'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText, origin: requestOrigin })
      }
    }

    return NextResponse.json(payment)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const adminId = getAdminIdFromRequest(request)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.payment.findFirst({ where: { id, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.payment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}
