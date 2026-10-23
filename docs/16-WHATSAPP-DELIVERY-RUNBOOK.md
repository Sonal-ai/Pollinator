# WhatsApp delivery and recovery

Updated 21 October 2026. This implementation is locally tested; live callback activation and phone acceptance remain open. The authorized template send to the recipient ending 1014 is UNKNOWN. The user cannot check it yet. Do not resend it automatically.

## Read-only Meta inspection

On 21 October 2026 the real token inspection returned HTTP 200 and `is_valid: true`, with business-management, WhatsApp-management and WhatsApp-messaging permissions. The Meta app's subscription inspection also returned HTTP 200: its `whatsapp_business_account` subscription is active and includes `messages`. This is app-level evidence. The token inspection did not return WABA target IDs, so WABA-level subscription remains unverified.

The registered callback is `https://100.24.80.15.sslip.io/api/webhook/whatsapp`. Its path matches the current handler, but its origin differs from the main environment's configured Cloudflare origin. Do not assume either address serves the currently tested build. Confirm the intended user-controlled public deployment before changing subscriptions or claiming a live round trip. See `qa/meta-subscription-check.json`.

Automatic approval review rejected a proposed challenge GET because it would send the configured verification token in a URL to an external endpoint, where it could be logged. That command did not execute. A safer Meta-metadata-only request completed; it makes no callback request and sends no verification token to the callback. The challenge requires destination-specific authorization. No workaround, callback setting change or message resend was attempted.

`node scripts/inspect-whatsapp-subscriptions.cjs` repeats only the read-only Meta metadata inspection and writes sanitized evidence. It does not probe the callback with credentials. The app-level subscription endpoint is distinct from the WABA subscription described in [Meta's API collection](https://www.postman.com/meta/whatsapp-business-platform/request/un84tul/override-callback-url).

## Processing contract

The webhook verifies an exact-byte SHA-256 signature, bounds the request to 256 KiB, validates the configured phone identity and supported message/status schema, and commits receipts before HTTP 200. A database failure returns HTTP 503 for provider retry. Repeated message IDs with the same content are deduplicated; conflicting content returns HTTP 409. Unsupported message types are counted as ignored. Supported inputs are text, buttons, lists, images and audio.

The WhatsApp worker processes each sender in database arrival order, while other senders can progress independently. Conversation state, business writes made through its database context, staged replies and completion commit together. The batch API is a separate transaction: the saved draft's stable idempotency key prevents a second chain intent after recovery. Registration alone never enrolls a signing wallet.

Incoming claims expire after three minutes; processing transactions are limited to 150 seconds. Five unsuccessful claims require operator review. Outgoing claims expire after 60 seconds; provider POSTs have a 20-second deadline. A stale claim is checked again before sending. A process pause can still happen after that check, so an expired send remains uncertain rather than safe to retry automatically.

Each outbound request has its own send-attempt history. ACCEPTED means Meta returned a message ID; only a matching receipt establishes DELIVERED or READ. Receipts arriving before the send-response commit are stored and reconciled later. Older statuses cannot downgrade READ. Timeouts, proxy/server failures, malformed rejection bodies, crashes or persistent receipt-storage failures become UNKNOWN and hold later replies for that recipient. The worker retries receipt storage without repeating the provider POST.

## Activation

1. Back up the intended database and retain the existing environment/binding. Apply the three `20261021000000`–`20261021000002` WhatsApp migrations using the deployment migration account. They have already been applied only to the dedicated local integration database. Confirm the runtime account can read/write all six new WhatsApp tables and their sequences.
2. Build the web app and workers from the same source. `npm run build:workers` compiles the worker; `npm run start:whatsapp` launches it. Local rehearsal uses `npm run whatsapp:worker:local`. Do not launch a real sender against synthetic pending test records.
3. Configure the web service with `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and a generated `ADMIN_API_KEY`. Configure the WhatsApp worker with the same phone/service key, `DATABASE_URL`, `WHATSAPP_ACCESS_TOKEN` and `APP_ORIGIN`. `WHATSAPP_GRAPH_VERSION` defaults to `v26.0`. Keep credentials in private mounted secret files. Both services must use the same database and application origin.
4. For isolated clusters, `infrastructure/cluster/whatsapp.override.yml` supplements the base Compose file. Include `infrastructure/cluster/evidence.override.yml` and the private `pinata_jwt` file for real harvest/report/packaging writes. Supply the real Meta secret files and validate the intended merged configuration before launch. The worker also validates the cluster's chain, registry, forwarder and genesis binding. Its heartbeat health threshold is 180 seconds. The owned QA configuration, database grants and release-worker startup now pass; see [document 18](18-RELEASE-CONTAINER-CHECKPOINT.md).
5. Deploy the HTTPS callback at `/api/webhook/whatsapp`, verify the configured challenge and subscribe the intended phone to message/status events. Public callback changes require review of the actual deployment and account settings first. Local handler tests do not establish those settings.
6. Confirm readiness and worker heartbeat, then perform an authorized real incoming harvest and open its approval link. Check the actual provider message ID and delivery receipt. Keep public testnet acceptance separate from local-chain evidence.

## Operator review

An authenticated administrator can inspect `GET /api/whatsapp/operations`. It returns failed inbound work, uncertain/failed outbound work and state counts; recipient identities are reduced to their final four digits. A queue dashboard has not been added.

`POST /api/whatsapp/operations` requires the same-origin authenticated admin session and JSON fields `target` (`inbox` or `outbox`), `id`, `action` (`RETRY` or `DISCARD`) and a reason of 10–500 characters. An outbound RETRY also requires `acknowledgeDuplicateRisk: true`. Inspect provider/recipient evidence before setting it. Already confirmed delivery prevents retry. Never interpret UNKNOWN as rejected. DISCARD deliberately abandons that work and allows later work to progress.

Every review records the authenticated administrator, reason and prior state. Retrying outbound work creates a new attempt without deleting prior attempts or receipts. Retrying failed inbound work resets its claim budget; inspect the underlying failure first. The API does not make ambiguous delivery safe to retry.

## Verification and limits

- `npm run test:whatsapp`: conversation/client, signed webhook and administrator API checks.
- `npm run test:whatsapp:durable`: real dedicated PostgreSQL durability checks with mocked provider sends and synthetic recipients.
- `npm run test:whatsapp:integration`: actual handler, batch route code, PostgreSQL and local EVM; includes interrupted harvest recovery and actor approval. HTTP transport, IPFS and Meta remain mocked.

Local tests do not prove current public callback routing, live media retrieval, actual phone delivery, a working Amoy registry, production permissions, or browser/external-wallet behavior. Store message payloads and conversation records as private operational data; production retention and deletion policies still need to be set.


Checkpoint, 22 October: the real client now treats gateway/server failures and unstructured error bodies as UNKNOWN. Only a structured Graph rejection with a numeric provider error code and HTTP 4xx is classified REJECTED. Twelve conversation/webhook/review checks and thirteen PostgreSQL durability checks pass, including the real-client gateway-failure path into a durable send attempt with no second send. The transport in that new case is synthetic; live Meta acceptance is still pending.
