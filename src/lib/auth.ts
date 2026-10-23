import { verifySessionToken } from './session-token';
import { resolveAccountSession } from './account-auth';
import {dashboardLoginPath,DASHBOARD_RETURN_HEADER} from './login-return';
import type { Role, SessionPayload } from './access-policy';
export { createSessionToken, verifySessionToken } from './session-token';
export type { SessionPayload } from './access-policy';
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const { cookies } = await import('next/headers');
    const token = (await cookies()).get('pollinator_session')?.value;
    if (!token) return null;
    const identity = await verifySessionToken(token);
    if (!identity) return null;
    const { prisma } = await import('./db');
    return await resolveAccountSession(identity, (id) => prisma.dashboardAccount.findUnique({ where: { id } }));
  } catch {
    // Invalid/revoked cookies, unavailable DB, or missing account schema fail closed.
    return null;
  }
}
export async function requireSession(roles?: readonly Role[]): Promise<SessionPayload> {
  const session = await getSession();
  const { redirect } = await import('next/navigation');
  if (!session) {
    let destination:string|null=null;
    try { const {headers}=await import('next/headers');destination=(await headers()).get(DASHBOARD_RETURN_HEADER); } catch {}
    return redirect(dashboardLoginPath(destination));
  }
  if (roles && !roles.includes(session.role)) redirect('/dashboard');
  return session;
}
