import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const students = await prisma.student.findMany({
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
    const student = await prisma.student.create({
      data: {
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
    if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 });

    await prisma.student.delete({
      where: { id: parseInt(id) }
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

    const updated = await prisma.student.update({
      where: { id: parseInt(id) },
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
