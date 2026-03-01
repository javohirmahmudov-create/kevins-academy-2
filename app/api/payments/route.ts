import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

const DAY_MS = 24 * 60 * 60 * 1000

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
      displayStatus: status
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
