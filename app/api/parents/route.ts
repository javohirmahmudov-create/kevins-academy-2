import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(Array.isArray(parents) ? parents : [])
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parent = await prisma.parent.create({
      data: {
        fullName: body.fullName || 'Parent',
        email: body.email || null,
        phone: body.phone || null
      }
    })
    return NextResponse.json(parent)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const data = {
      fullName: body.fullName || undefined,
      email: body.email || undefined,
      phone: body.phone || undefined
    }

    const parent = await prisma.parent.update({ where: { id }, data })
    return NextResponse.json(parent)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await prisma.parent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
