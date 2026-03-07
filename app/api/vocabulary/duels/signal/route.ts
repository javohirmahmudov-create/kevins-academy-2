/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

async function getValidatedDuel(duelId: number, studentId: number, request: Request) {
  const scopedAdminId = getAdminIdFromRequest(request)
  const duel = await prisma.vocabularyDuel.findUnique({
    where: { id: duelId },
    select: {
      id: true,
      adminId: true,
      challengerId: true,
      opponentId: true,
      status: true,
    },
  })

  if (!duel) {
    return { error: NextResponse.json({ error: 'Duel not found' }, { status: 404 }) }
  }

  if (scopedAdminId && duel.adminId && scopedAdminId !== duel.adminId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const isParticipant = Number(duel.challengerId) === studentId || Number(duel.opponentId) === studentId
  if (!isParticipant) {
    return { error: NextResponse.json({ error: 'Only duel participants allowed' }, { status: 403 }) }
  }

  return { duel }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const duelId = Number(url.searchParams.get('duelId') || 0)
    const studentId = Number(url.searchParams.get('studentId') || 0)
    const sinceId = Number(url.searchParams.get('sinceId') || 0)

    if (!Number.isFinite(duelId) || duelId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'duelId and studentId required' }, { status: 400 })
    }

    const validated = await getValidatedDuel(duelId, studentId, request)
    if (validated.error) return validated.error

    const duel = validated.duel
    const rows = await prisma.vocabularyDuelSignal.findMany({
      where: {
        duelId,
        fromStudentId: { not: studentId },
        id: { gt: Math.max(0, sinceId) },
      },
      orderBy: { id: 'asc' },
      take: 200,
      select: {
        id: true,
        type: true,
        payload: true,
      },
    })

    const signals = rows.map((row) => ({
      id: Number(row.id),
      type: String(row.type || ''),
      payload: row.payload,
    }))
    const latestSignalId = signals.length ? Number(signals[signals.length - 1]?.id || sinceId) : Math.max(0, sinceId)

    return NextResponse.json({
      ok: true,
      duelStatus: duel?.status || 'pending',
      latestSignalId,
      signals,
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const duelId = Number(body?.duelId || 0)
    const studentId = Number(body?.studentId || 0)
    const type = String(body?.type || '').trim().toLowerCase()
    const payload = body?.payload

    if (!Number.isFinite(duelId) || duelId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'duelId and studentId required' }, { status: 400 })
    }

    if (!['offer', 'answer', 'candidate', 'hangup'].includes(type)) {
      return NextResponse.json({ error: 'type must be offer, answer, candidate, or hangup' }, { status: 400 })
    }

    const validated = await getValidatedDuel(duelId, studentId, request)
    if (validated.error) return validated.error

    const duel = validated.duel
    if (!['pending', 'active'].includes(String(duel?.status || ''))) {
      return NextResponse.json({ error: 'Duel already closed' }, { status: 400 })
    }

    const created = await prisma.vocabularyDuelSignal.create({
      data: {
        duelId,
        fromStudentId: studentId,
        type,
        payload: payload || {},
      },
      select: {
        id: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, id: Number(created.id), at: created.createdAt })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
