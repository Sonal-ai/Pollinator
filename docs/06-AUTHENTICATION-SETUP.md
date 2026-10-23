# Secure account setup and rollout

This implements the first audit work package: password authentication, server-managed roles, revocable sessions, and account/owner checks. It does not complete the remaining blockchain/evidence fixes.

## Behavior

- Email and phone sign-in both require a password checked against a salted scrypt hash.
- Accounts and roles are provisioned only through a trusted operator CLI; there is no public admin signup, role picker, persona password, or automatic phone login.
- Phone formatting is normalized; local ten-digit numbers use India. Foreign international numbers never match an Indian number merely by suffix.
- Beekeeper accounts explicitly link to one existing beekeeper record. The linked wallet must match.
- Cookies identify an account and session version, last eight hours, and require issuer/audience/version checks. The server reloads the active account and current role on every authenticated access.
- Sign-out uses POST with same-origin validation, and authentication redirects use the configured application origin rather than untrusted forwarded-host headers.
- Password reset increments the session version; disabling an account blocks its existing sessions. Previous prototype cookies are rejected.
- Missing JWT secrets, unavailable account storage, and unavailable production Redis fail closed.
- Sign-in attempts are limited to ten per normalized identifier per fifteen minutes. Existing proxy IP throttling is an additional layer; production requires a trusted proxy boundary.
- Full batch/custody APIs, telemetry and label exports are private and owner-scoped. Public consumer information remains at the existing /verify page, whose separate evidence defects still need repair.
- WhatsApp sender resolution uses only its exact canonical/legacy phone variants. Unknown or ambiguous users cannot fall back to another farmer. Health/hive/harvest actions re-resolve the sender. Existing devices cannot be reassigned just by entering their identifier.

This release uses administrator-provisioned passwords rather than SMS/WhatsApp OTP. Operators must verify the intended recipient before providing access. An existing WhatsApp enrollment does not automatically create a dashboard password.

## Validation and current local status

- `npm run test:auth`: **30 tests passed**. They exercise password/login/token behavior, the real session/page-role helper, private API handlers, and WhatsApp sender/device boundaries with database, cookies, Redis and external-service I/O isolated or mocked as appropriate. No real messages or paid inference calls were sent.
- `npx tsc --noEmit`: passed after the implementation changes.
- `npx prisma generate` and `npx prisma validate`: passed.
- ESLint across changed/new code: no errors; existing warnings remain in touched dashboard files. This is not a claim that the full repository's pre-existing lint problems are fixed.
- `npm run build`: still blocked by failed Google Fonts downloads for Geist/Geist Mono. No successful production build or deployment is claimed.
- The configured local PostgreSQL service could not be reached. The additive account table change has **not** been applied, and no account was created. Database-backed end-to-end behavior and the production Redis integration remain unverified.
- A new random signing secret was added to the ignored local `.env` because it had no JWT secret. Its value is not in this documentation or the source diff. Configure a separate secret in the deployment environment.

The code is ready for schema/account activation once PostgreSQL and Redis are available. Old persona credentials intentionally no longer grant access.

## 1. Configure secrets and database

Set a unique, random JWT_SECRET of at least 32 bytes in the runtime environment. Existing source-code/default/example secrets are rejected. Keep REDIS_URL configured and reachable; production sign-in is unavailable if its shared rate limiter is unavailable. Do not put secrets in browser variables or commit them.

Generate Prisma Client after installing dependencies:

    npx prisma generate

For an **existing database with the existing Pollinator tables**, review/backup it and apply the additive change once:

    npx prisma db execute --schema prisma/schema.prisma --file prisma/changes/20261020-dashboard-accounts.sql

The SQL creates DashboardAccount and its constraints. It does not reset or seed existing data. Do not apply it twice or use it to initialize an empty database. The repository had no full migration history; this script deliberately does not pretend to be one.

For a **new isolated development database**, create the complete schema using the normal development workflow:

    npx prisma db push

Never use --accept-data-loss for this change. Production deployment and database activation need the intended database/runtime configuration; this coding task does not implicitly deploy to an AWS account.

## 2. Provision an account

Run from the project root in a trusted terminal. The CLI prompts twice with masked password input; use a unique password of at least 12 characters. It never prints the password or private keys.

    npm run account:provision -- --identifier YOUR_EMAIL --role admin --wallet YOUR_ACTOR_ADDRESS

Replace the uppercase values with the intended account email and existing actor wallet address; do not use the public demo password. The wallet is an account identity reference and does not imply the user independently signs chain transactions.

For a farmer:

    npm run account:provision -- --identifier +91YOUR_NUMBER --role beekeeper --wallet EXISTING_BEEKEEPER_WALLET --beekeeper-id EXISTING_BEEKEEPER_ID

The phone and wallet must match that linked record. Use an authorized operator/database tool to identify the actual record; do not attach an arbitrary demo farmer. One wallet can belong to one dashboard account; multiple login aliases per wallet are not implemented.

Repeat the provision command for an existing identifier to reset its password/change its role and revoke prior sessions. Disabling needs only:

    npm run account:provision -- --identifier YOUR_EMAIL --disable

For controlled automation, the CLI can read POLLINATOR_ACCOUNT_PASSWORD from a protected environment. Do not supply passwords as command arguments, commit them, or paste them into chat. The provisioning CLI uses the project's ts-node development dependency and should run from an operator checkout.

## 3. Verify rollout

1. Configure the database change, Redis and JWT secret, then provision an actual account.
2. Sign in with correct/incorrect passwords; confirm invalid passwords and unprovisioned phones fail.
3. Try a submitted role=admin with a non-admin account; the stored role must win.
4. With two independent beekeeper records/accounts, test batch/hive/health views, custody and harvest creation across both IDs.
5. Reset or disable an account and refresh an existing logged-in browser; it must lose access.
6. Verify direct admin/lab/processor URLs enforce their role even when navigation is bypassed.
7. Confirm public QR label export is denied and the public verification page still loads its public data.
8. Run npm run test:auth and npx tsc --noEmit. See the tests for the exact checks exercised.

## Boundaries

This records the first authentication package. Later evidence, UI and registry repairs are tracked in [document 08](08-PROTOTYPE-IMPLEMENTATION-STATUS.md).

Organisation/tenant membership, MFA/OTP, self-service password recovery, password breach screening, and independent actor-held blockchain keys remain later work. This change scopes ownership by the account's linked beekeeper and current custodian, rather than inventing an organisation model. Existing full admin API keys remain trusted machine credentials for the WhatsApp/internal workflow; never expose them to the client.

Remaining audit items include fail-open IPFS/consumer evidence, lifecycle/packaging invariants, durable transaction recovery, device enrollment proof/replay protection, and production release hardening. This first package does not certify the full application.
