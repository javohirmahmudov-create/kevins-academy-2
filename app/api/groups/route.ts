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
        level: body.level,
        description: body.description,
        teacher: body.teacher,
        schedule: body.schedule,
        maxStudents: body.maxStudents
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

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const updated = await prisma.group.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Update error' }, { status: 500 });
  }
}