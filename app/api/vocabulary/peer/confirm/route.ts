/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope required' }, { status: 401 })
    }

    const body = await request.json()
    const scoreId = Number(body?.scoreId || 0)
    const approved = body?.approved !== false
    const reviewNote = String(body?.reviewNote || '').trim()

    if (!Number.isFinite(scoreId) || scoreId <= 0) {
      return NextResponse.json({ error: 'scoreId required' }, { status: 400 })
    }

    const existing = await prisma.score.findFirst({
      where: {
        id: scoreId,
        adminId,
        category: 'peer_check',
      },
      select: {
        id: true,
        breakdown: true,
        comment: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Score not found' }, { status: 404 })
    }

    const breakdown = existing.breakdown && typeof existing.breakdown === 'object'
      ? { ...(existing.breakdown as Record<string, any>) }
      : {}

    const peer = breakdown.peerChecking && typeof breakdown.peerChecking === 'object'
      ? { ...(breakdown.peerChecking as Record<string, any>) }
      : {}

    peer.status = approved ? 'approved' : 'rejected'
    peer.reviewedAt = new Date().toISOString()
    peer.reviewNote = reviewNote || undefined
    breakdown.peerChecking = peer

    const suffix = approved ? 'Tasdiqlandi' : 'Rad etildi'
    const noteText = reviewNote ? `${suffix}: ${reviewNote}` : suffix

    const updated = await prisma.score.update({
      where: { id: scoreId },
      data: {
        comment: existing.comment ? `${existing.comment} | ${noteText}` : noteText,
        breakdown,
      },
      select: {
        id: true,
        comment: true,
      },
    })

    return NextResponse.json({ ok: true, score: updated })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
