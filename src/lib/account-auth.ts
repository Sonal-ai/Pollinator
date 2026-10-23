import { z } from 'zod';
import { normalizeLoginIdentifier } from './identity';
import { verifyPassword } from './password';
import { isRole, type SessionPayload } from './access-policy';
export interface AccountRecord {
  id: string;
  identifier: string;
  passwordHash: string;
  walletAddress: string;
  role: string;
  beekeeperId: string | null;
  active: boolean;
  sessionVersion: number;
}
export const LoginSchema = z.object({
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(1024),
});
export function accountSession(account: AccountRecord): SessionPayload | null {
  if (!account.active || !isRole(account.role) || !/^0x[a-fA-F0-9]{40}$/.test(account.walletAddress)) return null;
  if (account.role === 'beekeeper' && !account.beekeeperId) return null;
  if (account.role !== 'beekeeper' && account.beekeeperId) return null;
  return { accountId: account.id, role: account.role, walletAddress: account.walletAddress, beekeeperId: account.beekeeperId };
}
export async function authenticatePassword(
  input: unknown, findAccount: (identifier: string) => Promise<AccountRecord | null>,
): Promise<AccountRecord | null> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return null;
  const identifier = normalizeLoginIdentifier(parsed.data.identifier);
  if (!identifier) return null;
  const account = await findAccount(identifier);
  const verified = await verifyPassword(parsed.data.password, account?.passwordHash);
  return verified && account && accountSession(account) ? account : null;
}
export async function resolveAccountSession(
  token: { accountId: string; sessionVersion: number },
  findAccount: (id: string) => Promise<AccountRecord | null>,
): Promise<SessionPayload | null> {
  const account = await findAccount(token.accountId);
  if (!account || account.sessionVersion !== token.sessionVersion) return null;
  return accountSession(account);
}
