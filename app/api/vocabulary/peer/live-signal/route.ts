/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function parseRoomMembers(roomKey: string) {
  const match = /^pair:(\d+)-(\d+)$/.exec(String(roomKey || '').trim())
  if (!match) return null
  const a = Number(match[1] || 0)
  const b = Number(match[2] || 0)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || a === b) return null
  return [Math.min(a, b), Math.max(a, b)]
}

function isRoomMember(roomKey: string, studentId: number) {
  const members = parseRoomMembers(roomKey)
  if (!members) return false
  return members.includes(Number(studentId))
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const roomKey = String(url.searchParams.get('roomKey') || '').trim()
    const studentId = Number(url.searchParams.get('studentId') || 0)
    const sinceId = Number(url.searchParams.get('sinceId') || 0)

    if (!roomKey || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'roomKey and studentId required' }, { status: 400 })
    }

    if (!isRoomMember(roomKey, studentId)) {
      return NextResponse.json({ error: 'Forbidden room member' }, { status: 403 })
    }

    const lowerBoundId = Math.max(0, sinceId)

    const rows = await prisma.vocabularyLiveSignal.findMany({
      where: {
        roomKey,
        fromStudentId: { not: studentId },
        id: { gt: lowerBoundId },
      },
      orderBy: { id: 'asc' },
      take: 200,
      select: {
        id: true,
        type: true,
        payload: true,
      },
    })

    const latestRoom = await prisma.vocabularyLiveSignal.findFirst({
      where: { roomKey },
      orderBy: { id: 'desc' },
      select: { id: true },
    })

    const signals = rows.map((row) => ({
      id: Number(row.id),
      type: String(row.type || ''),
      payload: row.payload,
    }))

    const latestSignalId = Math.max(lowerBoundId, Number(latestRoom?.id || 0))

    return NextResponse.json({ ok: true, latestSignalId, signals })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const roomKey = String(body?.roomKey || '').trim()
    const studentId = Number(body?.studentId || 0)
    const type = String(body?.type || '').trim().toLowerCase()
    const payload = body?.payload

    if (!roomKey || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'roomKey and studentId required' }, { status: 400 })
    }

    if (!['offer', 'answer', 'candidate', 'hangup', 'reset'].includes(type)) {
      return NextResponse.json({ error: 'type must be offer, answer, candidate, hangup, or reset' }, { status: 400 })
    }

    if (!isRoomMember(roomKey, studentId)) {
      return NextResponse.json({ error: 'Forbidden room member' }, { status: 403 })
    }

    const created = await prisma.vocabularyLiveSignal.create({
      data: {
        roomKey,
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
