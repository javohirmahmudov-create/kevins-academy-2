/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

function parseTimestamp(value: unknown) {
  if (!value) return 0
  const date = new Date(String(value))
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : 0
}

function ensureObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) }
  }
  return {}
}

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
      meta: true,
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
    const since = Number(url.searchParams.get('since') || 0)

    if (!Number.isFinite(duelId) || duelId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'duelId and studentId required' }, { status: 400 })
    }

    const validated = await getValidatedDuel(duelId, studentId, request)
    if (validated.error) return validated.error

    const duel = validated.duel
    const meta = ensureObject(duel?.meta)
    const rtc = ensureObject(meta.rtc)

    const signals: Array<{ type: string; payload: any; at: number }> = []

    const offerAt = parseTimestamp(rtc.offerAt)
    if (rtc.offer && Number(rtc.offerFrom || 0) !== studentId && offerAt > since) {
      signals.push({ type: 'offer', payload: rtc.offer, at: offerAt })
    }

    const answerAt = parseTimestamp(rtc.answerAt)
    if (rtc.answer && Number(rtc.answerFrom || 0) !== studentId && answerAt > since) {
      signals.push({ type: 'answer', payload: rtc.answer, at: answerAt })
    }

    const candidateItems = Array.isArray(rtc.candidates) ? rtc.candidates : []
    for (const item of candidateItems) {
      const at = parseTimestamp(item?.createdAt)
      const from = Number(item?.from || 0)
      if (item?.candidate && from !== studentId && at > since) {
        signals.push({ type: 'candidate', payload: item.candidate, at })
      }
    }

    const hangupAt = parseTimestamp(rtc.hangupAt)
    if (rtc.hangupBy && Number(rtc.hangupBy || 0) !== studentId && hangupAt > since) {
      signals.push({ type: 'hangup', payload: { by: Number(rtc.hangupBy || 0) }, at: hangupAt })
    }

    signals.sort((a, b) => a.at - b.at)
    const latestAt = signals.length ? signals[signals.length - 1]?.at || since : since

    return NextResponse.json({
      ok: true,
      duelStatus: duel?.status || 'pending',
      latestAt,
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

    const meta = ensureObject(duel?.meta)
    const rtc = ensureObject(meta.rtc)
    const nowIso = new Date().toISOString()

    if (type === 'offer') {
      rtc.offer = payload
      rtc.offerFrom = studentId
      rtc.offerAt = nowIso
      rtc.answer = null
      rtc.answerFrom = null
      rtc.answerAt = null
      rtc.hangupBy = null
      rtc.hangupAt = null
      rtc.candidates = []
    } else if (type === 'answer') {
      rtc.answer = payload
      rtc.answerFrom = studentId
      rtc.answerAt = nowIso
    } else if (type === 'candidate') {
      const candidates = Array.isArray(rtc.candidates) ? rtc.candidates : []
      candidates.push({
        from: studentId,
        candidate: payload,
        createdAt: nowIso,
      })
      rtc.candidates = candidates.slice(-150)
    } else if (type === 'hangup') {
      rtc.hangupBy = studentId
      rtc.hangupAt = nowIso
    }

    meta.rtc = rtc

    await prisma.vocabularyDuel.update({
      where: { id: duelId },
      data: { meta },
    })

    return NextResponse.json({ ok: true, at: nowIso })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
