import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(admins)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const admin = await prisma.admin.create({ data: body })
    return NextResponse.json(admin)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
