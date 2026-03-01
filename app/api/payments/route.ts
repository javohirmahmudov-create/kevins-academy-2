import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(Array.isArray(payments) ? payments : [])
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const studentId = await resolveStudentId(body)
    const payment = await prisma.payment.create({
      data: {
        studentId,
        amount: Number(body.amount) || 0,
        status: body.status || 'pending'
      }
    })
    return NextResponse.json(payment)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const studentId = await resolveStudentId(body)
    const data = {
      studentId,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      status: body.status || undefined
    }

    const payment = await prisma.payment.update({ where: { id }, data })
    return NextResponse.json(payment)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await prisma.payment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
