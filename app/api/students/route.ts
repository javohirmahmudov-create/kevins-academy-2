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
