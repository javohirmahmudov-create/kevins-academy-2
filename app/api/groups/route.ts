import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(groups)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const group = await prisma.group.create({
      data: {
        name: body.name,
        color: 'from-orange-500 to-red-500', // Rasmdagi kabi standart rang
        students: 0
      }
    })
    return NextResponse.json(group)
  } catch (error) {
    return NextResponse.json({ error: 'Yaratishda xatolik' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })
    
    await prisma.group.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ message: 'Oʻchirildi' })
  } catch (error) {
    return NextResponse.json({ error: 'Oʻchirishda xatolik' }, { status: 500 })
  }
}
