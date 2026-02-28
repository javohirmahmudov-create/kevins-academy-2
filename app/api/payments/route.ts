import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(payments)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payment = await prisma.payment.create({ data: body })
    return NextResponse.json(payment)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
