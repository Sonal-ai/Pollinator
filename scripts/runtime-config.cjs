const fs = require('node:fs');
const SECRET_KEYS = ['DATABASE_URL','REDIS_URL','JWT_SECRET','QR_HMAC_SECRET','IOT_CREDENTIAL_KEY','RELAYER_PRIVATE_KEY','PINATA_JWT',
  'WHATSAPP_PHONE_ID','WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','ADMIN_API_KEY','GEMINI_API_KEY',
  'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','IOT_MQTT_PASSWORD'];
function loadRuntimeSecrets(environment = process.env) {
  for (const key of SECRET_KEYS) {
    const file = environment[key + '_FILE'];
    if (!file) continue;
    if (environment[key]) throw new Error('Configure exactly one source for ' + key);
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 65536) throw new Error('Invalid secret file for ' + key);
    const value = fs.readFileSync(file, 'utf8').replace(/\r?\n$/, '');
    if (!value || value.includes('\0')) throw new Error('Invalid secret value for ' + key);
    environment[key] = value;
    delete environment[key + '_FILE'];
  }
}
function validateRuntimeService(service, environment = process.env) {
  const required = service === 'web' ? ['DATABASE_URL','REDIS_URL','JWT_SECRET','QR_HMAC_SECRET']
    : service === 'chain' ? ['DATABASE_URL','RELAYER_PRIVATE_KEY']
    : service === 'mqtt' ? ['DATABASE_URL','IOT_CREDENTIAL_KEY','IOT_MQTT_URL','IOT_MQTT_CLIENT_ID']
    : service === 'whatsapp' ? ['DATABASE_URL','WHATSAPP_PHONE_ID','WHATSAPP_ACCESS_TOKEN','ADMIN_API_KEY','APP_ORIGIN'] : ['DATABASE_URL'];
  for (const key of required) if (!environment[key]) throw new Error('Missing runtime configuration for ' + key);
  for (const key of ['JWT_SECRET','QR_HMAC_SECRET','ADMIN_API_KEY']) if (required.includes(key) && (environment[key].length < 32 || /^(change_me|your_|dev_password)/i.test(environment[key]))) throw new Error('A generated secret is required for ' + key);
  for (const key of ['RELAYER_PRIVATE_KEY','IOT_CREDENTIAL_KEY']) if (required.includes(key) && !new RegExp(key === 'RELAYER_PRIVATE_KEY' ? '^0x[a-fA-F0-9]{64}$' : '^[a-fA-F0-9]{64}$').test(environment[key])) throw new Error('Invalid runtime key for ' + key);
}
module.exports = { loadRuntimeSecrets, validateRuntimeService };
