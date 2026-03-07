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
            recordingUrl: recordingUrl || null,
            status: 'pending_confirmation',
            submittedAt: new Date().toISOString(),
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      scoreId: score.id,
      createdAt: score.createdAt,
      status: 'pending_confirmation',
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
