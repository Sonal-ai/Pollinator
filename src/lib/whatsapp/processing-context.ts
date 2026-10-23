import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import type { RedisService } from './fsm';
import type { WhatsAppClient } from './client';

export interface WhatsAppProcessingContext {
  db: Prisma.TransactionClient;
  sessions: Pick<RedisService, 'getSession' | 'setSession' | 'updateSessionData' | 'isDuplicateMessage'>;
  messenger: WhatsAppClient;
}

// One worker transaction owns the session, database writes and staged replies.
export const whatsAppProcessing = new AsyncLocalStorage<WhatsAppProcessingContext>();
