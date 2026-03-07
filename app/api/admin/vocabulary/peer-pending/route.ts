/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope required' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = String(url.searchParams.get('status') || 'pending').trim().toLowerCase()

    const rows = await prisma.score.findMany({
      where: {
        adminId,
        category: 'peer_check',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        studentId: true,
        value: true,
        comment: true,
        breakdown: true,
        createdAt: true,
      },
    })

    const filtered = rows.filter((row) => {
      const peer = row.breakdown && typeof row.breakdown === 'object'
        ? (row.breakdown as any).peerChecking
        : null
      const peerStatus = String(peer?.status || 'pending_confirmation').toLowerCase()
      if (status === 'all') return true
      if (status === 'approved') return peerStatus === 'approved'
      if (status === 'rejected') return peerStatus === 'rejected'
      return peerStatus === 'pending_confirmation'
    })

    return NextResponse.json(filtered)
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
