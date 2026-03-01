import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'audio/mpeg',
            'audio/wav',
            'application/zip',
            'application/x-rar-compressed'
          ],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ source: 'admin-materials-upload' })
        }
      },
      onUploadCompleted: async () => {
      }
    })

    return NextResponse.json(jsonResponse)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Upload token generation failed' }, { status: 400 })
  }
}
