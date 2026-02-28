import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const scores = await prisma.score.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(scores)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const score = await prisma.score.create({ data: body })
    return NextResponse.json(score)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
