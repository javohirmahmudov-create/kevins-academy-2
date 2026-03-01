import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()

    if (!username || !password) {
      return NextResponse.json({ reason: 'missing_credentials' }, { status: 400 })
    }

    const parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })
    const expanded = Array.isArray(parents) ? parents.map(unpackParent) : []

    const matched = expanded.find((parent: any) => {
      const parentUsername = String(parent?.username || '').trim()
      const parentPassword = String(parent?.password || '').trim()
      const emailAsUsername = String(parent?.email || '').trim()
      const phoneAsPassword = String(parent?.phone || '').trim()

      const metadataMatch = parentUsername === username && parentPassword === password
      const legacyFallbackMatch = emailAsUsername === username && phoneAsPassword === password

      return metadataMatch || legacyFallbackMatch
    })

    if (!matched) {
      return NextResponse.json({ reason: 'not_found' }, { status: 401 })
    }

    return NextResponse.json({
      id: String(matched.id),
      fullName: matched.fullName,
      username: matched.username || matched.email || '',
      email: matched.email || '',
      phone: matched.phone || '',
      studentId: matched.studentId || '',
      adminId: 'system',
      role: 'parent'
    })
  } catch (error) {
    return NextResponse.json({ reason: 'error' }, { status: 500 })
  }
}
