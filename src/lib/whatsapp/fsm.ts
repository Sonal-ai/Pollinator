import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export enum ConversationState {
  IDLE = 'IDLE',
  ONBOARDING = 'ONBOARDING',
  REGISTRATION_NAME = 'REGISTRATION_NAME',
  MAIN_MENU = 'MAIN_MENU',
  MENU_HEALTH = 'MENU_HEALTH',
  MENU_MARKET = 'MENU_MARKET',
  TRANSFER_BATCH_ID = 'TRANSFER_BATCH_ID',
}

export class RedisService {
  async getSession(waId: string) {
    const data = await redis.get(`session:${waId}`);
    return data ? JSON.parse(data) : { state: ConversationState.IDLE, data: {} };
  }

  async setSession(waId: string, state: ConversationState, data: any = {}) {
    await redis.set(`session:${waId}`, JSON.stringify({ state, data }), 'EX', 86400); // 24 hr expiry
  }

  async isDuplicateMessage(msgId: string) {
    const exists = await redis.exists(`msg:${msgId}`);
    if (exists) return true;
    await redis.set(`msg:${msgId}`, '1', 'EX', 3600);
    return false;
  }
}

export const fsm = new RedisService();
