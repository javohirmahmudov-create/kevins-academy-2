/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

export async function GET(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const url = new URL(request.url)
    const group = String(url.searchParams.get('group') || '').trim()
    const studentId = Number(url.searchParams.get('studentId') || 0)

    if (!group) {
      return NextResponse.json({ error: 'group required' }, { status: 400 })
    }

    let adminId = scopedAdminId
    if (!adminId && Number.isFinite(studentId) && studentId > 0) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { adminId: true } })
      adminId = student?.adminId || null
    }

    const students = await prisma.student.findMany({
      where: {
        group,
        ...(adminId ? { adminId } : {}),
      },
      select: { id: true, fullName: true, group: true },
      orderBy: { fullName: 'asc' },
    })

    const candidates = Number.isFinite(studentId) && studentId > 0
      ? students.filter((item) => Number(item.id) !== studentId)
      : students

    if (students.length < 2 || candidates.length < 1) {
      return NextResponse.json({ pairs: [], myPartner: null, students: candidates, message: 'Juftlik uchun kamida 2 o‘quvchi kerak' })
    }

    const randomized = shuffle(students)
    const pairs: Array<{ left: any; right: any }> = []

    for (let index = 0; index < randomized.length; index += 2) {
      const left = randomized[index]
      const right = randomized[index + 1] || randomized[0]
      if (!left || !right || left.id === right.id) continue
      pairs.push({ left, right })
    }

    const myPartner = Number.isFinite(studentId) && studentId > 0
      ? pairs.find((pair) => pair.left.id === studentId || pair.right.id === studentId)
      : null

    const partner = myPartner
      ? (myPartner.left.id === studentId ? myPartner.right : myPartner.left)
      : null

    const randomPartner = Number.isFinite(studentId) && studentId > 0
      ? shuffle(candidates)[0] || null
      : null

    return NextResponse.json({ pairs, myPartner: partner || randomPartner, students: candidates })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
