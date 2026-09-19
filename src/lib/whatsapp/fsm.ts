import Redis from 'ioredis';
import { env } from '../env';

// ============================================================
// Conversation States — FSM
// ============================================================

export enum ConversationState {
  IDLE                    = 'IDLE',
  ONBOARDING              = 'ONBOARDING',
  REGISTRATION_NAME       = 'REGISTRATION_NAME',
  REGISTRATION_REGION     = 'REGISTRATION_REGION',
  REGISTRATION_HIVE_COUNT = 'REGISTRATION_HIVE_COUNT',
  REGISTRATION_PRACTICES  = 'REGISTRATION_PRACTICES',
  MAIN_MENU               = 'MAIN_MENU',
  MENU_HIVE_STATUS        = 'MENU_HIVE_STATUS',
  MENU_BEE_HEALTH         = 'MENU_BEE_HEALTH',
  MENU_HARVEST            = 'MENU_HARVEST',
  REGISTER_HIVE           = 'REGISTER_HIVE',
  HARVEST_TYPE            = 'HARVEST_TYPE',
  HARVEST_QUANTITY        = 'HARVEST_QUANTITY',
  HARVEST_CONFIRM         = 'HARVEST_CONFIRM',
  MENU_MARKET             = 'MENU_MARKET',
  ASK_QUESTION            = 'ASK_QUESTION',
  TRANSFER_BATCH_ID       = 'TRANSFER_BATCH_ID',
  TRANSFER_BUYER_ID       = 'TRANSFER_BUYER_ID',
  BATCH_STATUS_AWAITING_ID = 'BATCH_STATUS_AWAITING_ID',
}

// ============================================================
// Session Data Shape
// ============================================================

export interface RegistrationDraft {
  name?: string;
  region?: string;
  hivesCount?: number;
  practices?: string;
}

export interface HarvestDraft {
  honeyType?: string;
  quantityGrams?: number;
  hivesHarvested?: number;
}

export interface SessionData {
  wa_id?: string;
  beekeeper_id?: string;  // DB id of the Beekeeper record
  language?: string;      // Detected language code e.g. "hi", "en"
  registration?: RegistrationDraft;
  harvest_draft?: HarvestDraft;
}

export interface Session {
  state: ConversationState;
  data: SessionData;
}

// ============================================================
// Redis Service
// ============================================================

// ============================================================
// Redis Service with In-Memory Fallback
// ============================================================

let redisClient: Redis | null = null;
const memorySessions = new Map<string, Session>();
const seenMessages = new Set<string>();

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 100, 2000);
      },
    });

    redisClient.on('error', (err: Error) => {
      console.warn('[redis] Connection warning (using memory fallback):', err.message);
    });
  }
  return redisClient;
}

const SESSION_TTL_SECONDS = 86400; // 24 hours
const MSG_DEDUP_TTL_SECONDS = 3600; // 1 hour

export class RedisService {
  /**
   * Get the session for a WhatsApp user.
   * Returns a default IDLE session if none exists.
   */
  async getSession(waId: string): Promise<Session> {
    try {
      const data = await getRedis().get(`session:${waId}`);
      if (data) {
        return JSON.parse(data) as Session;
      }
    } catch (err) {
      console.warn('[fsm] Redis getSession fallback to memory:', err);
    }
    return memorySessions.get(waId) || { state: ConversationState.IDLE, data: {} };
  }

  /**
   * Persist session state for a user with 24-hour TTL.
   */
  async setSession(
    waId: string,
    state: ConversationState,
    data: SessionData = {}
  ): Promise<void> {
    const session: Session = { state, data };
    memorySessions.set(waId, session);

    try {
      await getRedis().set(
        `session:${waId}`,
        JSON.stringify(session),
        'EX',
        SESSION_TTL_SECONDS
      );
    } catch (err) {
      console.warn('[fsm] Redis setSession fallback to memory:', err);
    }
  }

  /**
   * Update only the session data, keeping the current state.
   */
  async updateSessionData(waId: string, update: Partial<SessionData>): Promise<void> {
    const current = await this.getSession(waId);
    await this.setSession(waId, current.state, { ...current.data, ...update });
  }

  /**
   * Check if a message has already been processed (deduplication).
   * Returns true if this is a duplicate (should be ignored).
   * Falls back to memory cache gracefully.
   */
  async isDuplicateMessage(msgId: string): Promise<boolean> {
    if (!msgId) return false;
    if (seenMessages.has(msgId)) return true;
    seenMessages.add(msgId);
    if (seenMessages.size > 5000) {
      const first = seenMessages.values().next().value;
      if (first) seenMessages.delete(first);
    }

    try {
      const key = `msg:${msgId}`;
      const result = await getRedis().set(key, '1', 'EX', MSG_DEDUP_TTL_SECONDS, 'NX');
      return result === null;
    } catch (err) {
      return false; // don't block messages if redis is unavailable
    }
  }

  /**
   * Clear the session (used when registration completes or user resets).
   */
  async clearSession(waId: string): Promise<void> {
    memorySessions.delete(waId);
    try {
      await getRedis().del(`session:${waId}`);
    } catch {
      // non-fatal
    }
  }
}

export const fsm = new RedisService();
