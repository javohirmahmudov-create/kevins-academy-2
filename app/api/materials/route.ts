import { NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'
import prisma from '@/lib/prisma'

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }
  return token
}


export async function GET() {
  try {
    const materials = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(materials)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('multipart/form-data')) {
      // parse formData
      const form = await request.formData();
      data.title = form.get('title') as string;
      data.group = form.get('group') as string;
      data.fileType = form.get('type') as string;
      data.uploadedAt = new Date();
      data.uploadedBy = 'admin';
      const file = form.get('file') as File;
      if (file) {
        const token = getBlobToken();
        const safeName = file.name.replace(/\s+/g, '-');
        const blob = await put(`materials/${Date.now()}-${safeName}`, file, {
          access: 'public',
          token
        });
        data.fileUrl = blob.url;
      }
      data.content = form.get('content') as string | null;
      const due = form.get('dueDate') as string;
      if (due) {
        data.dueDate = new Date(due);
      }
    } else {
      // assume JSON body (used by saveMaterials helper)
      data = await request.json();
      if (data.dueDate) {
        // ensure Date object
        data.dueDate = new Date(data.dueDate);
      }
    }

    const material = await prisma.material.create({ data });
    return NextResponse.json(material);
  } catch (error: any) {
    // return the actual message as well as full error object
    console.error('materials POST error', error);
    return NextResponse.json(
      { error: error.message || 'Xatolik', details: String(error) },
      { status: 500 }
    );
  }
}

// update an existing material (used by saveMaterials helper or manual edits)
export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await request.json();
    if (body.dueDate) body.dueDate = new Date(body.dueDate);
    const idNum = parseInt(id, 10);
    // if fileUrl is being removed, consider deleting file on disk? not needed here
    const updated = await prisma.material.update({ where: { id: idNum }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('materials PUT error', err);
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 });
  }
}

// delete a material and its file
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // fetch record first to know file path
    const idNum = parseInt(id, 10);
    const existing = await prisma.material.findUnique({ where: { id: idNum } });
    if (existing && existing.fileUrl) {
      // attempt to delete file from Vercel Blob
      try {
        if (existing.fileUrl.startsWith('http')) {
          const token = getBlobToken();
          await del(existing.fileUrl, { token });
        }
      } catch (e) {
        console.warn('could not delete file', e);
      }
    }
    await prisma.material.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('materials DELETE error', err);
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 });
  }
}