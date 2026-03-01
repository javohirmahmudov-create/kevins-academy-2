import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const students = await prisma.student.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(students)
  } catch (error) {
    console.error('GET /api/students error:', error)
    return NextResponse.json({ error: 'Database error', details: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const adminId = getAdminIdFromRequest(req)
    const student = await prisma.student.create({
      data: {
        adminId,
        fullName: body.fullName || body.name || '',
        email: body.email || `${Date.now()}@test.com`,
        phone: body.phone || '',
        username: body.username || `user_${Date.now()}`,
        password: body.password || '123456',
        status: body.status || 'active',
        group: body.group || null
      }
    })
    return NextResponse.json(student)
  } catch (error) {
    console.error('POST /api/students error:', error)
    return NextResponse.json({ error: 'Save error', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// app/api/students/route.ts ichiga qo'shimcha:

// O'CHIRISH (DELETE)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const adminId = getAdminIdFromRequest(req)
    if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 });

    const studentId = parseInt(id)
    if (adminId) {
      const owned = await prisma.student.findFirst({ where: { id: studentId, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.student.delete({
      where: { id: studentId }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'O\'chirishda xatolik' }, { status: 500 });
  }
}

// TAHRIRLASH (PUT)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    const adminId = getAdminIdFromRequest(req)
    const studentId = parseInt(id)

    if (adminId) {
      const owned = await prisma.student.findFirst({ where: { id: studentId, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        fullName: updateData.fullName || updateData.name,
        email: updateData.email,
        phone: updateData.phone || '',
        username: updateData.username,
        status: updateData.status,
        // Faqat parol yuborilsa yangilaymiz
        ...(updateData.password && { password: updateData.password })
      }
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Yangilashda xatolik' }, { status: 500 });
  }
}
