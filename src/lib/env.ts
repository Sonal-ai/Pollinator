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
  LOCAL_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'LOCAL_PRIVATE_KEY must be a 32-byte hex string').default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),

  // Polygon Amoy (Global / Testnet)
  POLYGON_RPC_URL: z.string().default('https://rpc-amoy.polygon.technology'),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'CONTRACT_ADDRESS must be a valid EVM address').optional(),
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'PRIVATE_KEY must be a 32-byte hex string').optional(),
  NEXT_PUBLIC_BLOCKCHAIN_NETWORK: z.string().optional(),

  // IPFS / Pinata
  AMB_ENDPOINT: z.string().url().optional(),
  IPFS_GATEWAY: z.string().min(1, 'IPFS_GATEWAY is required'),
  PINATA_JWT: z.string().min(1, 'PINATA_JWT is required'),

  // QR Anti-Clone
  QR_HMAC_SECRET: z.string().min(32, 'QR_HMAC_SECRET must be at least 32 characters'),

  // Public App URL (used for QR code generation)
  NEXT_PUBLIC_APP_URL: z.string().min(1).default('http://localhost:3000'),

  // Optional: IoT device shared secret
  IOT_DEVICE_SECRET: z.string().optional(),

  // Optional: Admin API key for recall endpoint
  ADMIN_API_KEY: z.string().optional(),

  // Optional: JWT secret for dashboard auth
  JWT_SECRET: z.string().min(32).optional(),
});

/**
 * Parse and validate all environment variables at module load time.
 * The app will throw a clear error at startup if any required var is missing
 * rather than failing silently at runtime.
 */
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

// Named export for convenience — use this everywhere instead of process.env
export const env = new Proxy({} as z.infer<typeof EnvSchema>, {
  get(_target, key: string) {
    return getEnv()[key as keyof z.infer<typeof EnvSchema>];
  },
});
