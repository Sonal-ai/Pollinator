import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http');
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.url;

  const url = new URL('/dashboard/login', baseUrl);
  const response = NextResponse.redirect(url, { status: 303 });
  
  // Clear the session cookie
  response.cookies.delete('pollinator_session');
  
  return response;
}

export async function GET(request: Request) {
  return POST(request);
}
