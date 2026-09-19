import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Create a response that redirects back to the login page
  const url = new URL('/dashboard/login', request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  
  // Clear the session cookie
  response.cookies.delete('pollinator_session');
  
  return response;
}
