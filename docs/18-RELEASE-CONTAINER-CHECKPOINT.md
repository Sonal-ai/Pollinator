# Release container checkpoint

Updated 21 October 2026. These checks supplement the actual localhost HTTP rehearsal in [document 17](17-HTTP-REHEARSAL-AND-AMOY-HANDOFF.md). They do not activate a public deployment or establish a live Meta callback.

## Completed

Fresh worker, migrator and web images built successfully under the local `main-flow-review` tags. Their exact image IDs are recorded in `qa/main-flow-checkpoint-4.json`. All use runtime UID/GID 1001. Offline inspection of the web image confirmed the standalone server is present and the main/private environment files, local data, AWS credentials, SSH directory and npm configuration are absent.

The installed `podman-compose` provider parsed the base Compose file with both WhatsApp and evidence overrides. The merged configuration retained all base web secret mounts. The WhatsApp worker receives only its database, phone identity, access token and service key; it does not receive the relayer key or evidence-storage credential. See `qa/main-flow-compose-acceptance.json`.

An owned, previously stopped QA PostgreSQL container was started and privately backed up before migration. The fresh migrator applied the three WhatsApp migrations successfully. A container using the restricted `honeychain_app` role then exercised inbox receipt/deduplication, sequences, conversation/outbox transactions, individual send attempts, UNKNOWN handling, review-audit writes and delivery reconciliation. The role is not a superuser and cannot create schema objects, mutate the deployment binding or read migration history. The permission harness used an injected handler and provider; the actual administrator API authorization is covered by the earlier unit/HTTP checks. See `qa/whatsapp-container-permissions.json`.

The actual release entry point started the WhatsApp worker against that QA database and accepted its existing deployment binding. Its polling heartbeat became ready and the declared container health command passed. SIGTERM produced exit code 0 and a final `ready: false`, `detail: stopped` heartbeat. The container had only the internal data network and synthetic Meta credentials. No real provider request or message was made. The preserved QA EVM was never restarted. This proves release wiring and polling, not public-chain connectivity.

The first permission harness mistakenly imported an API-only module that is intentionally absent from the worker bundle; its corrected scope tests database permissions directly. A heartbeat assertion was also corrected from `worker` to the actual `service` field before the final passing checks. These were harness corrections, not hidden application failures.

## Deployment correction

The base cluster previously had no evidence-storage secret mount. Harvest creation, lab reports and packaging require actual IPFS evidence writes, so the complete workflow must include `infrastructure/cluster/evidence.override.yml` and a private `${SECRET_DIR}/pinata_jwt` file. The token is mounted only into the web service and loaded through the existing runtime secret loader. No credential is embedded in the override or image.

For the full web/WhatsApp flow, merge these files in order:

1. `infrastructure/cluster/compose.yml`
2. `infrastructure/cluster/whatsapp.override.yml`
3. `infrastructure/cluster/evidence.override.yml`

Supply real Meta secret files and the generated shared service key as described in [document 16](16-WHATSAPP-DELIVERY-RUNBOOK.md). Supply the real evidence token privately. Existing private cluster drafts created before the service-key addition need a generated `whatsapp_service_key` file; do not overwrite their other credentials or rerun the draft generator against them.

The locally tested images are review artifacts, not a release authorization. Select the intended production image references, verify the cluster manifest and live Amoy binding, apply migrations with the migration role, and activate only after the concrete deployment/callback plan is reviewed. Do not copy synthetic smoke credentials or publicly known local fixture keys to a live service.

## Remaining

Public signer/actor addresses and funding are still missing. The currently configured Amoy contract does not establish the v2 interface. The authorized WhatsApp send remains UNKNOWN, and the recipient cannot check yet. Live HTTPS callback/subscription and two-way phone acceptance remain open. Browser access remains blocked by the browser security URL policy; no visual/mobile/theme or external-wallet acceptance is claimed. The presentation flow is documented, while the actual screens still need rehearsal through permitted access. Team and field evidence remain pending; IoT is deferred.


Follow-up, 22 October: fresh patched `wallet-flow-review` web/worker/migrator images and the wallet-deployment migration now pass the additional local release checks in [document 19](19-METAMASK-DEPLOYMENT-AND-NEXT-STEPS.md). Exact image IDs and scopes are in `qa/wallet-release-checkpoint.json`. This supersedes the old image references for review of the new deployment page; public activation is still pending.
