/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function POST(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const body = await request.json()

    const studentId = Number(body?.studentId || 0)
    const partnerId = Number(body?.partnerId || 0)
    const scoreValue = Math.max(0, Math.min(100, Number(body?.score || 0)))
    const note = String(body?.note || '').trim()
    const recordingUrl = String(body?.recordingUrl || '').trim()

    if (!Number.isFinite(studentId) || studentId <= 0 || !Number.isFinite(partnerId) || partnerId <= 0) {
      return NextResponse.json({ error: 'studentId and partnerId required' }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, adminId: true, group: true },
    })
    const partner = await prisma.student.findUnique({
      where: { id: partnerId },
      select: { id: true, fullName: true, adminId: true, group: true },
    })

    if (!student || !partner) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    if ((student.adminId || null) !== (partner.adminId || null) || (student.group || '') !== (partner.group || '')) {
      return NextResponse.json({ error: 'Pair mismatch' }, { status: 400 })
    }
    if (scopedAdminId && student.adminId && scopedAdminId !== student.adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const duelId = Number(body?.duelId || 0)
    const nowIso = new Date().toISOString()

    const score = await prisma.score.create({
      data: {
        adminId: student.adminId || undefined,
        studentId: student.id,
        scoreType: 'weekly',
        category: 'peer_check',
        subject: 'Peer Vocabulary Check',
        value: scoreValue,
        maxScore: 100,
        overallPercent: scoreValue,
        comment: note || `Peer check by ${partner.fullName}`,
        breakdown: {
          peerChecking: {
            studentId: student.id,
            studentName: student.fullName,
            partnerId: partner.id,
            partnerName: partner.fullName,
            score: scoreValue,
            note,
            duelId: Number.isFinite(duelId) && duelId > 0 ? duelId : null,
            recordingUrl: recordingUrl || null,
            status: 'pending_confirmation',
            submittedAt: nowIso,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        value: true,
        breakdown: true,
        comment: true,
      },
    })

    const reciprocalRows = await prisma.score.findMany({
      where: {
        adminId: student.adminId || undefined,
        category: 'peer_check',
        studentId: partner.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        value: true,
        breakdown: true,
        comment: true,
      },
    })

    const reciprocal = reciprocalRows.find((row) => {
      const peer = row.breakdown && typeof row.breakdown === 'object'
        ? (row.breakdown as any).peerChecking
        : null
      return Number(peer?.partnerId || 0) === student.id
        && Number(peer?.studentId || 0) === partner.id
        && String(peer?.status || 'pending_confirmation') === 'pending_confirmation'
    })

    if (!reciprocal) {
      return NextResponse.json({
        ok: true,
        scoreId: score.id,
        createdAt: score.createdAt,
        status: 'pending_confirmation',
        requiresAdminReview: false,
      })
    }

    const reciprocalValue = Math.max(0, Math.min(100, Number(reciprocal.value || 0)))
    const difference = Math.abs(scoreValue - reciprocalValue)
    const suspicious = difference > 15 || scoreValue <= 0 || reciprocalValue <= 0
    const finalStatus = suspicious ? 'needs_review' : 'auto_approved'

    const scoreBreakdown = score.breakdown && typeof score.breakdown === 'object'
      ? { ...(score.breakdown as Record<string, any>) }
      : {}
    const reciprocalBreakdown = reciprocal.breakdown && typeof reciprocal.breakdown === 'object'
      ? { ...(reciprocal.breakdown as Record<string, any>) }
      : {}

    const leftPeer = scoreBreakdown.peerChecking && typeof scoreBreakdown.peerChecking === 'object'
      ? { ...(scoreBreakdown.peerChecking as Record<string, any>) }
      : {}
    const rightPeer = reciprocalBreakdown.peerChecking && typeof reciprocalBreakdown.peerChecking === 'object'
      ? { ...(reciprocalBreakdown.peerChecking as Record<string, any>) }
      : {}

    const autoMeta = {
      checkedAt: nowIso,
      difference,
      pairScores: [scoreValue, reciprocalValue],
    }

    leftPeer.status = finalStatus
    leftPeer.autoValidation = autoMeta
    rightPeer.status = finalStatus
    rightPeer.autoValidation = autoMeta

    if (!suspicious) {
      leftPeer.reviewedAt = nowIso
      leftPeer.reviewNote = `Auto approved (difference ${difference})`
      rightPeer.reviewedAt = nowIso
      rightPeer.reviewNote = `Auto approved (difference ${difference})`
    }

    scoreBreakdown.peerChecking = leftPeer
    reciprocalBreakdown.peerChecking = rightPeer

    await prisma.$transaction([
      prisma.score.update({
        where: { id: score.id },
        data: {
          breakdown: scoreBreakdown,
          comment: suspicious
            ? `${score.comment || ''}${score.comment ? ' | ' : ''}Needs admin review (difference ${difference})`
            : `${score.comment || ''}${score.comment ? ' | ' : ''}Auto approved`,
        },
      }),
      prisma.score.update({
        where: { id: reciprocal.id },
        data: {
          breakdown: reciprocalBreakdown,
          comment: suspicious
            ? `${reciprocal.comment || ''}${reciprocal.comment ? ' | ' : ''}Needs admin review (difference ${difference})`
            : `${reciprocal.comment || ''}${reciprocal.comment ? ' | ' : ''}Auto approved`,
        },
      }),
    ])

    await prisma.vocabularyDuel.updateMany({
      where: {
        ...(student.adminId ? { adminId: student.adminId } : {}),
        status: 'active',
        OR: [
          { challengerId: student.id, opponentId: partner.id },
          { challengerId: partner.id, opponentId: student.id },
        ],
      },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      createdAt: score.createdAt,
      status: finalStatus,
      requiresAdminReview: suspicious,
      autoValidation: {
        difference,
        reciprocalScore: reciprocalValue,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
