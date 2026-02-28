import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const attendance = await prisma.attendance.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(attendance)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const attendance = await prisma.attendance.create({ data: body })
    return NextResponse.json(attendance)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
