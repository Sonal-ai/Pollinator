import { NextResponse } from 'next/server';
import { allowedRequestOrigin } from '@/lib/request-origin';
import { serverAppOrigin } from '@/lib/app-origin';

export async function POST(request: Request) {
  const baseUrl = new URL(process.env.NODE_ENV === 'development' ? request.url : serverAppOrigin(request.url));
  if (!allowedRequestOrigin(request)) {
    return Response.json({ error: 'Forbidden origin' }, { status: 403 });
  }
  const response = NextResponse.redirect(new URL('/dashboard/login', baseUrl), { status: 303 });
  response.cookies.delete('pollinator_session');
  return response;
}

export async function GET() {
  return Response.json({ error: 'Use POST to sign out.' }, { status: 405, headers: { Allow: 'POST' } });
}
