import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const materials = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(materials)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const material = await prisma.material.create({ data: body })
    return NextResponse.json(material)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}