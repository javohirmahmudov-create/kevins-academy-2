import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(students)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik yuz berdi' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const student = await prisma.student.create({
      data: {
        name: body.name,
        email: body.email || `${Date.now()}@test.com`,
        phone: body.phone,
        group: body.group,
        username: body.username || `user_${Date.now()}`,
        password: body.password || '123456'
      }
    })
    return NextResponse.json(student)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Saqlashda xatolik' }, { status: 500 })
  }
}

// app/api/students/route.ts ichiga qo'shimcha:

// O'CHIRISH (DELETE)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 });

  await prisma.student.delete({
    where: { id: parseInt(id) }
  });
  return NextResponse.json({ success: true });
}

// TAHRIRLASH (PUT)
export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...updateData } = body;

  const updated = await prisma.student.update({
    where: { id: parseInt(id) },
    data: {
      name: updateData.fullName,
      email: updateData.email,
      phone: updateData.phone,
      groupName: updateData.group,
      username: updateData.username,
      // Faqat parol yuborilsa yangilaymiz
      ...(updateData.password && { password: updateData.password })
    }
  });
  return NextResponse.json(updated);
}
