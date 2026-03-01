import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const groups = await prisma.group.findMany({
      where: adminId ? { adminId } : undefined,
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
    const adminId = getAdminIdFromRequest(req)
    const group = await prisma.group.create({
      data: {
        adminId,
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
    const adminId = getAdminIdFromRequest(req)
    if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })
    const groupId = parseInt(id)

    if (adminId) {
      const owned = await prisma.group.findFirst({ where: { id: groupId, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }
    
    await prisma.group.delete({ where: { id: groupId } })
    return NextResponse.json({ message: 'Oʻchirildi' })
  } catch (error) {
    return NextResponse.json({ error: 'Oʻchirishda xatolik' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const adminId = getAdminIdFromRequest(req)
    const groupId = parseInt(id)

    if (adminId) {
      const owned = await prisma.group.findFirst({ where: { id: groupId, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const updated = await prisma.group.update({ where: { id: groupId }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Update error' }, { status: 500 });
  }
}