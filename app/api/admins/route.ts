import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(admins)
  } catch (error) {
    console.error('GET /api/admins error:', error)
    return NextResponse.json({ error: String(error), details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const createData: any = {
      ...body,
      contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
      telegramUsername: typeof body.telegramUsername === 'string' ? body.telegramUsername.trim() || null : null,
      notifyTelegram: body.notifyTelegram !== undefined ? Boolean(body.notifyTelegram) : true,
      notifySms: body.notifySms !== undefined ? Boolean(body.notifySms) : true,
    }
    const admin = await prisma.admin.create({
      data: createData
    })
    return NextResponse.json(admin)
  } catch (error) {
    console.error('POST /api/admins error:', error)
    return NextResponse.json({ error: String(error), details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const normalizedData: any = {
      ...data,
      contactPhone: typeof data.contactPhone === 'string' ? data.contactPhone.trim() || null : data.contactPhone,
      telegramUsername: typeof data.telegramUsername === 'string' ? data.telegramUsername.trim() || null : data.telegramUsername,
      notifyTelegram: data.notifyTelegram !== undefined ? Boolean(data.notifyTelegram) : undefined,
      notifySms: data.notifySms !== undefined ? Boolean(data.notifySms) : undefined,
    }
    const updated = await prisma.admin.update({
      where: { id: parseInt(id) },
      data: normalizedData,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/admins error:', error);
    return NextResponse.json({ error: String(error), details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID missing' }, { status: 400 });
    await prisma.admin.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('DELETE /api/admins error:', error);
    return NextResponse.json({ error: String(error), details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}