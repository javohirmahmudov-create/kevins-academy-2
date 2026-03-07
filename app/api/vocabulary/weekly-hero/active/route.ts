/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const studentId = Number(url.searchParams.get('studentId') || 0)

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const now = new Date()
    const row = await prisma.weeklyHero.findFirst({
      where: {
        studentId,
        badgeStartAt: { lte: now },
        badgeEndAt: { gte: now },
      },
      orderBy: [
        { badgeEndAt: 'desc' },
        { rank: 'asc' },
      ],
      select: {
        weekKey: true,
        rank: true,
        studentName: true,
        duelWins: true,
        proctorBest: true,
        badgeStartAt: true,
        badgeEndAt: true,
      },
    })

    if (!row) {
      return NextResponse.json({ hasBadge: false })
    }

    return NextResponse.json({
      hasBadge: true,
      badge: {
        title: 'Hafta Qahramoni',
        weekKey: row.weekKey,
        rank: row.rank,
        studentName: row.studentName,
        duelWins: row.duelWins,
        proctorBest: row.proctorBest,
        badgeStartAt: row.badgeStartAt,
        badgeEndAt: row.badgeEndAt,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
