import { z } from 'zod';

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // WhatsApp / Meta
  WHATSAPP_PHONE_ID: z.string().min(1, 'WHATSAPP_PHONE_ID is required'),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, 'WHATSAPP_ACCESS_TOKEN is required'),
  WHATSAPP_APP_SECRET: z.string().min(1, 'WHATSAPP_APP_SECRET is required'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, 'WHATSAPP_VERIFY_TOKEN is required'),
  WHATSAPP_GRAPH_VERSION: z.string().regex(/^v\d{2}\.\d$/).default('v26.0'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Blockchain Network Selection: 'local' (Hardhat node) or 'amoy' (Polygon Amoy)
  BLOCKCHAIN_NETWORK: z.enum(['local', 'amoy', 'localhost', 'polygonAmoy', 'global']).default('local'),

  // Local Blockchain (Hardhat Node)
  LOCAL_RPC_URL: z.string().default('http://127.0.0.1:8545'),
  LOCAL_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'LOCAL_CONTRACT_ADDRESS must be a valid EVM address').optional(),
  LOCAL_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'LOCAL_PRIVATE_KEY must be a 32-byte hex string').optional(),

  // Polygon Amoy (Global / Testnet)
  POLYGON_RPC_URL: z.string().url().default('https://polygon-amoy.drpc.org'),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'CONTRACT_ADDRESS must be a valid EVM address').optional(),
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'PRIVATE_KEY must be a 32-byte hex string').optional(),
  RELAYER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  NEXT_PUBLIC_BLOCKCHAIN_NETWORK: z.string().optional(),

  // IPFS / Pinata
  AMB_ENDPOINT: z.string().url().optional(),
  IPFS_GATEWAY: z.string().min(1, 'IPFS_GATEWAY is required'),
  PINATA_JWT: z.string().min(1, 'PINATA_JWT is required'),

  // QR Anti-Clone
  QR_HMAC_SECRET: z.string().min(32, 'QR_HMAC_SECRET must be at least 32 characters'),

  // Public App URL (used for QR code generation)
  NEXT_PUBLIC_APP_URL: z.string().min(1).default('http://localhost:3000'),

  // WhatsApp bot display number for public wa.me links
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),

  // Optional: Admin API key for recall endpoint
  ADMIN_API_KEY: z.string().optional(),

  // Required for signed dashboard sessions. Never fall back to a source-code secret.
  JWT_SECRET: z.string().min(32),
});

/** Optional eager validation for operators who want to validate every integration. */
function validateEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n[Pollinator] Environment validation failed. Fix your .env file:\n${missing}\n`
    );
  }
  return result.data;
}

// Validate once at module load. Cache the result.
let _env: z.infer<typeof EnvSchema> | null = null;

export function getEnv() {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

// Validate settings on first use, so an offline worker or disabled WhatsApp/AI
// integration does not require unrelated cloud credentials just to start.
const values = new Map<string, unknown>();
export const env = new Proxy({} as z.infer<typeof EnvSchema>, {
  get(_target, key: string) {
    if (typeof key !== 'string' || !Object.hasOwn(EnvSchema.shape, key)) return undefined;
    if (!values.has(key)) {
      const result = EnvSchema.shape[key as keyof typeof EnvSchema.shape].safeParse(process.env[key]);
      if (!result.success) throw new Error(`[Pollinator] ${key} is missing or invalid. Configure this integration before using it.`);
      values.set(key, result.data);
    }
    return values.get(key);
  },
});
