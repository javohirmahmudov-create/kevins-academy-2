/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function escapeXml(input: string) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const weekKey = String(url.searchParams.get('weekKey') || '').trim()
    const rank = Number(url.searchParams.get('rank') || 1)

    if (!weekKey) {
      return NextResponse.json({ error: 'weekKey required' }, { status: 400 })
    }

    const row = await prisma.weeklyHero.findFirst({
      where: {
        weekKey,
        rank: Number.isFinite(rank) && rank > 0 ? rank : 1,
      },
      select: {
        weekKey: true,
        rank: true,
        studentName: true,
        duelWins: true,
        proctorBest: true,
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Hero not found' }, { status: 404 })
    }

    const title = row.rank === 1 ? 'HAFTA QAHRAMONI' : `TOP-${row.rank} QAHRAMON`
    const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Weekly Hero Card">
  <defs>
    <linearGradient id="goldBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1B1300" />
      <stop offset="45%" stop-color="#4D3600" />
      <stop offset="100%" stop-color="#1A1100" />
    </linearGradient>
    <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#A97000"/>
      <stop offset="50%" stop-color="#FFD86B"/>
      <stop offset="100%" stop-color="#A97000"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#goldBg)"/>
  <rect x="28" y="28" width="1144" height="574" rx="28" fill="none" stroke="url(#goldLine)" stroke-width="4"/>

  <text x="80" y="110" fill="#FFD86B" font-size="42" font-family="Arial, sans-serif" font-weight="700">Kevin's Academy</text>
  <text x="80" y="165" fill="#FFF3C6" font-size="30" font-family="Arial, sans-serif">${escapeXml(title)}</text>

  <text x="80" y="280" fill="#FFFFFF" font-size="70" font-family="Georgia, 'Times New Roman', serif" font-weight="700" filter="url(#shadow)">${escapeXml(row.studentName)}</text>

  <text x="80" y="355" fill="#FFE9A8" font-size="34" font-family="Arial, sans-serif">${medal} Duel wins: ${row.duelWins}</text>
  <text x="80" y="405" fill="#FFE9A8" font-size="34" font-family="Arial, sans-serif">🧠 AI Proctor Best: ${Number(row.proctorBest || 0).toFixed(1)}%</text>

  <rect x="80" y="462" width="1040" height="2" fill="url(#goldLine)"/>

  <text x="80" y="520" fill="#FFF2BE" font-size="28" font-family="Arial, sans-serif">Week: ${escapeXml(row.weekKey)}</text>
  <text x="1120" y="520" fill="#FFF2BE" font-size="28" text-anchor="end" font-family="Arial, sans-serif">Luxury Gold Edition</text>

  <text x="1120" y="585" fill="#DDBA5A" font-size="22" text-anchor="end" font-family="Arial, sans-serif">Knowledge • Discipline • Victory</text>
</svg>`.trim()

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
