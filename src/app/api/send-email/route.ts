import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { sendIonosEmail } from '@/lib/ionosEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return verifyToken(token)?.userId ?? null;
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim();
    const message = String(body?.message || '').trim();
    const tableHtml = typeof body?.tableHtml === 'string' ? body.tableHtml : '';

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding:20px; color:#222;">
        <h2 style="margin:0 0 12px;">Message from Movesbook</h2>
        ${message ? `<p style="white-space:pre-wrap;">${message.replace(/</g, '&lt;')}</p>` : ''}
        ${
          tableHtml
            ? `<div style="margin-top:20px;">
                 <h3 style="margin:0 0 8px;">Table data</h3>
                 ${tableHtml}
               </div>`
            : ''
        }
        <p style="margin-top:20px; font-size:12px; color:#999;">
          Sent from Movesbook
        </p>
      </div>
    `;

    await sendIonosEmail({
      to: email,
      subject: 'Message from Movesbook',
      html: htmlContent,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('EMAIL ERROR:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 },
    );
  }
}
