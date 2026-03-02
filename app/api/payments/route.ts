import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { formatTelegramDate, notifyParentsByStudentId, queueTelegramTask } from '@/lib/telegram'
import { notifyParentsByStudentIdSms, queueSmsTask } from '@/lib/sms'

const DAY_MS = 24 * 60 * 60 * 1000
const overdueReminderSentCache = new Map<string, number>()
const DEFAULT_CARD_NUMBER = '9860 3501 4447 3575'
const DEFAULT_CARD_EXPIRES = '08/30'

function startOfLocalDay(date: Date) {
  const local = new Date(date)
  local.setHours(0, 0, 0, 0)
  return local
}

function daysBetweenLocalDates(laterDate: Date, earlierDate: Date) {
  const later = startOfLocalDay(laterDate)
  const earlier = startOfLocalDay(earlierDate)
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS)
}

function buildCardPaymentUrl() {
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

async function sendPaymentNotice(input: {
  adminId?: number | null
  studentId?: number | null
  text: string
  smsText: string
}) {
  if (!input.studentId) return
  const buttonUrl = buildCardPaymentUrl()
  queueTelegramTask(async () => {
    await notifyParentsByStudentId({
      adminId: input.adminId,
      studentId: input.studentId,
      text: input.text,
      buttonText: "💳 Karta orqali to'lash",
      buttonUrl,
      modeButtons: false,
    })
  })
  queueSmsTask(async () => {
    await notifyParentsByStudentIdSms({
      adminId: input.adminId,
      studentId: input.studentId,
      text: input.smsText,
    })
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

  if (status === 'paid' || !endDate) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
      displayStatus: status
    }
  }

  const overdueDays = Math.max(0, daysBetweenLocalDates(now, endDate))
  if (overdueDays <= 0) {
    return {
      overdueDays: 0,
      penaltyAmount: 0,
      totalDue: amount,
      isOverdue: false,
      displayStatus: status
    }
  }

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

async function resolveStudentId(input: { studentId?: string | number; studentName?: string }) {
  if (input.studentId !== undefined && input.studentId !== null && String(input.studentId).trim() !== '') {
    const parsed = Number(input.studentId)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (input.studentName) {
    const student = await prisma.student.findFirst({ where: { fullName: input.studentName } })
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
  if (!dueDate) return false
  if (status === 'paid') return false
  return daysBetweenLocalDates(new Date(), dueDate) > 0
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
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

      const overdueText = `🚨 <b>To'lov muddati o'tgan</b>\n\n📅 To'lov muddati: <b>${formatTelegramDate(item.endDate || item.dueDate)}</b>\n⏳ Kechikish: <b>${Number(item.overdueDays || 0)} kun</b>\n💸 Jami to'lov: <b>${Number(item.totalDue || item.amount || 0).toLocaleString('uz-UZ')} so'm</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`
      const overdueSms = `Kevin's Academy: To'lov muddati o'tgan. Kechikish ${Number(item.overdueDays || 0)} kun. Jami: ${Number(item.totalDue || item.amount || 0).toLocaleString('uz-UZ')} so'm. Karta: ${getCardInfoText()}.`

      await sendPaymentNotice({
        adminId,
        studentId: item.studentId,
        text: overdueText,
        smsText: overdueSms,
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
    const studentId = await resolveStudentId(body)
    const status = body.status || 'pending'
    const dueDate = body.dueDate ? new Date(body.dueDate) : null
    const startDate = body.startDate ? new Date(body.startDate) : null
    const endDate = body.endDate ? new Date(body.endDate) : dueDate
    const penaltyPerDay = Number(body.penaltyPerDay || 10000)
    const paidAt = body.paidAt
      ? new Date(body.paidAt)
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
        const text = `💳 <b>To'lov holati</b>\n\nTo'lov muvaffaqiyatli qabul qilindi.\n📅 Keyingi to'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov qabul qilindi. Keyingi to'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText })
      } else if (isAlreadyOverdue(status, effectiveDueDate)) {
        const text = `🚨 <b>To'lov muddati o'tgan</b>\n\n📅 To'lov muddati: <b>${nextDueText}</b>\n⏳ Kechikish: <b>${Number(penalty.overdueDays || 0)} kun</b>\n💸 Jami to'lov: <b>${Number(penalty.totalDue || body.amount || 0).toLocaleString('uz-UZ')} so'm</b>\n💳 Karta: <b>${getCardInfoText()}</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`
        const smsText = `Kevin's Academy: To'lov muddati o'tgan. Kechikish ${Number(penalty.overdueDays || 0)} kun. Jami: ${Number(penalty.totalDue || body.amount || 0).toLocaleString('uz-UZ')} so'm. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText })
      } else if (startDate || endDate || dueDate) {
        const text = `🧾 <b>To'lov davri belgilandi</b>\n\n📅 Boshlanish sanasi: <b>${startText}</b>\n📌 Tugash (to'lov) sanasi: <b>${nextDueText}</b>\n💳 Karta: <b>${getCardInfoText()}</b>\n\nEslatma shu muddat asosida yuboriladi.`
        const smsText = `Kevin's Academy: To'lov davri belgilandi. Boshlanish: ${startText}. Tugash: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText })
      } else if (isDueSoon(status, endDate || dueDate)) {
        const text = `⏰ <b>To'lov eslatmasi</b>\n\nTo'lov muddati yaqinlashmoqda.\n📅 To'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov muddati yaqin. To'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId, text, smsText })
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
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.payment.findFirst({ where: { id, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const studentId = await resolveStudentId(body)
    const status = body.status || undefined
    const dueDate = body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined
    const endDate = body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : dueDate

    const resolvedStudentName = body.studentName !== undefined
      ? (body.studentName || null)
      : (studentId
        ? (await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true } }))?.fullName || null
        : undefined)

    const paidAt = body.paidAt
      ? new Date(body.paidAt)
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
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
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
      const penalty = calculatePenalty({
        status: payment.status,
        amount: payment.amount,
        endDate: nextDueDate,
        dueDate: payment.dueDate,
        penaltyPerDay: payment.penaltyPerDay,
      })

      if (payment.status === 'paid') {
        const text = `✅ <b>To'lov qabul qilindi</b>\n\nTo'lov muvaffaqiyatli qabul qilindi.\n📅 Keyingi to'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov qabul qilindi. Keyingi to'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText })
      } else if (isAlreadyOverdue(payment.status, nextDueDate)) {
        const text = `🚨 <b>To'lov muddati o'tgan</b>\n\n📅 To'lov muddati: <b>${nextDueText}</b>\n⏳ Kechikish: <b>${Number(penalty.overdueDays || 0)} kun</b>\n💸 Jami to'lov: <b>${Number(penalty.totalDue || payment.amount || 0).toLocaleString('uz-UZ')} so'm</b>\n💳 Karta: <b>${getCardInfoText()}</b>\n\nIltimos, to'lovni imkon qadar tezroq amalga oshiring.`
        const smsText = `Kevin's Academy: To'lov muddati o'tgan. Kechikish ${Number(penalty.overdueDays || 0)} kun. Jami: ${Number(penalty.totalDue || payment.amount || 0).toLocaleString('uz-UZ')} so'm. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText })
      } else if (payment.startDate || payment.endDate || payment.dueDate) {
        const text = `🧾 <b>To'lov davri yangilandi</b>\n\n📅 Boshlanish sanasi: <b>${startText}</b>\n📌 Tugash (to'lov) sanasi: <b>${nextDueText}</b>\n💳 Karta: <b>${getCardInfoText()}</b>.`
        const smsText = `Kevin's Academy: To'lov davri yangilandi. Boshlanish: ${startText}. Tugash: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText })
      } else if (isDueSoon(payment.status, nextDueDate)) {
        const text = `🔔 <b>To'lov muddati yaqin</b>\n\nTo'lov muddati yaqinlashmoqda.\n📅 To'lov sanasi: <b>${nextDueText}</b>.`
        const smsText = `Kevin's Academy: To'lov muddati yaqin. To'lov sanasi: ${nextDueText}. Karta: ${getCardInfoText()}.`
        await sendPaymentNotice({ adminId, studentId: payment.studentId, text, smsText })
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
