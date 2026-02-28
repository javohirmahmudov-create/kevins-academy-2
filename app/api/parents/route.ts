import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(parents)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parent = await prisma.parent.create({ data: body })
    return NextResponse.json(parent)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
