# Honey Chain: hive firmware and physical bench plan

Updated 21 October 2026. This extends [the phone gateway](13-PHONE-GATEWAY-AND-OFFLINE-QUEUE.md) and [authenticated delivery receipts](12-OFFLINE-DELIVERY-RECEIPTS.md). The firmware source and host checks are implemented. Physical boards, radios, sensors, flash durability, clock drift, battery life and field operation have not been validated. Team, institution, pilot location, hardware and budget remain unconfirmed; fieldwork has not started.

## Implemented boundary

The reference ESP32 firmware samples available sensors every five minutes, signs the original packet bytes, saves them to its local journal, and exposes those signed envelopes over BLE. The phone durably queues the envelope before requesting the next entry. The existing authenticated gateway forwards it through TLS MQTT; a worker commits it to PostgreSQL. Firmware deletes a journal entry only after checking the server's HMAC receipt, device ID, epoch, sequence and exact packet SHA-256.

This firmware does not put telemetry on-chain or sign beekeeper wallet operations. A committed reading establishes receipt of data signed with an enrolled key. It does not establish that a sensor is calibrated, that it was in a hive, or that honey is pure.

### Journal and recovery rules

- NVS retains identity and a sequence high-water mark. Blocks of 64 sequence numbers are reserved and committed before a packet can be written or exposed. Reboot skips unused numbers in the reserved block. Gaps are deliberate; a lower number is never recovered by guessing from remaining files.
- LittleFS stores exact signed envelopes as `/journal/00000000.pkt` files. Writes use a temporary file, flush, readback, rename and committed-file readback. Only committed `.pkt` files enter the BLE stream. Boot validates the journal binding and each packet before collection resumes. Temporary packet files can be cleaned during recovery.
- Missing/corrupt identity, unexpected files, invalid packet signatures, an identity mismatch or an invalid high-water mark stop collection. `LittleFS.begin(false)` never automatically formats a failed mount. A checksum detects accidental NVS-state corruption; it is not encryption or protection against a physical attacker rewriting flash.
- A full journal or insufficient free space stops new samples rather than overwriting unacknowledged readings. The logical ceiling is 2,048 packets with a 16 KiB free-space reserve. Actual flash capacity and metadata overhead can reach the limit earlier. This is not a verified seven-day capacity claim. Uncommitted packets older than the server's seven-day intake window still fail intake; do not re-date them.
- Rewind and next only move a sequence-based cursor. Deleting an earlier entry cannot shift an array index past another entry. Duplicate valid acknowledgements are harmless. A reset before deletion permits the same original packet to be delivered again and deduplicated by the server.
- Reinstalling the same enrollment preserves the high-water mark. Rotation requires no pending readings and both a fresh epoch and fresh secret. Exhaustion at sequence 2,147,483,648 requires rotation; it never wraps. Coordinate server rotation after draining the old journal, because revocation blocks old-epoch receipt retrieval.

The host tests model interruptions before and after persistence, append and deletion. They are evidence about the shared state machine. They do not demonstrate ESP32 NVS/LittleFS behavior under a real brownout, torn flash write, wear or storage failure. Those are separate bench gates below.

## Proposed hardware interface

The source selects a classic ESP32 DevKit profile with `PartitionScheme=no_ota`. Proposed I²C pins are SDA 21 and SCL 22. A BME280 is probed at `0x76` then `0x77`; a DS3231 RTC uses `0x68`. The proposed HX711 data and clock pins are 32 and 33. These are source defaults for review, not verified wiring instructions for an unidentified board. Confirm the actual board, module schematics, supply/logic voltages, pull-ups, load-cell arrangement and outdoor enclosure before connecting anything.

The sensor build omits unavailable/out-of-range measurements and saturated scale ADC results. An uncalibrated scale contributes no weight. With no valid metric, capture reports `NO_VALID_MEASUREMENTS`; a disconnected sensor never becomes a zero-valued successful reading. Pressure is converted from Pa to hPa. No battery value, disease diagnosis or harvested-honey mass is fabricated.

The HX711 reader checks readiness without an unbounded wait, reads a signed 24-bit result and uses 25 clock pulses for channel A/gain 128. Pulses request one microsecond high/low in a critical section. The [manufacturer datasheet hosted by SparkFun](https://cdn.sparkfun.com/assets/0/2/7/d/1/HX711_datasheet.pdf) specifies a 0.2–50 µs high interval and power-down after a high interval above 60 µs. Verify actual GPIO pulse timing with an instrument; source delays alone are not measured timing evidence.

### Clock and calibration

1. Use a valid DS3231 clock with its lost-power flag cleared by an explicit time-setting operation. If absent/invalid, the operator can set a RAM clock over USB. Full power loss then requires setting time again. No 1970/default timestamp is emitted.
2. USB `set-time` uses the operator computer's current UTC seconds. Verify that computer's clock first. Check `clockReady` and compare a stored packet's timestamp against a trusted clock. There is no automatic network time synchronization or measured drift guarantee.
3. Record unloaded raw ADC samples and a known reference mass under stable mounting. Derive `tareOffset` from the unloaded reading and `countsPerKg = (loadedRaw - tareOffset) / knownMassKg`. Multiple samples, repeatability, return-to-zero and an independent second mass are physical checks, not software-generated calibration evidence.
4. `set-scale` stores the measured offset and finite nonzero factor in NVS with checksum/readback. A factor may be negative if the measured wiring polarity requires it. No default calibration is supplied. Weight means gross scale mass, including hive, bees and equipment.

USB serial ports may reset a DevKit when opened; this has not been tested on the eventual board. Without a valid RTC, run `set-time` after other USB setup commands and leave the board powered for phone collection. Do not assume a RAM clock survives opening another serial session or changing power source.

## BLE pairing and transport

The firmware uses the service/characteristic UUIDs and newline envelope contract in document 13. It sends notifications in 20-byte fragments and accepts write-with-response commands in bounded buffers. One authenticated connection, a 30-second authentication deadline, a fixed eight-command queue, connection-generation fencing and transmission deadlines bound work. The separate 4 KiB producer/consumer frame slots use static storage rather than the BLE host or loop stack. Storage mutation occurs in the main loop rather than a BLE callback.

The reference configuration requests encrypted, authenticated Secure Connections with bonding and passkey entry. The operator retrieves a six-digit device-specific code through an explicit USB `pairing-code` command. This code is derived from the enrolled device key and identity; it is not the key. The notification read and command characteristics require authenticated encryption. No clock setting, provisioning, formatting or secret retrieval is exposed as a BLE command.

Before advertising, a separate NVS bond binding is compared with the enrolled epoch. A missing or changed binding requires successful removal of old bonds followed by a committed/read-back epoch binding. Corrupt pairing state prevents advertising. Rotation therefore cannot intentionally carry a previously trusted phone bond into the new epoch. The USB status includes `bluetoothStatus`; physical bond removal and re-pairing still require bench verification. A phone may also need its old OS-side bond removed.

Actual OS pairing dialogs, Web Bluetooth compatibility, reconnection, bond removal and PIN rotation have not been exercised. A successful GATT write confirms transport only; firmware must still validate the receipt. Transport interruptions leave the journal eligible for replay.

## Reproducible compile and operator sequence

See [firmware/README.md](../firmware/README.md) and `sketch.yaml`. Pinned versions are Arduino CLI 1.5.1, ESP32 core 3.3.12, ArduinoJson 7.4.3, NimBLE-Arduino 2.5.1, BME280 library 2.3.0, RTClib 2.1.4, Adafruit BusIO 1.17.4 and Unified Sensor 1.1.15. The official [Arduino profile documentation](https://docs.arduino.cc/arduino-cli/sketch-project-file/) describes isolated platform/library resolution. The profile can extract another SDK copy even when a global or workspace core already exists.

`scripts/setup-firmware-tools.ps1` verifies the official CLI archive digest and keeps paths inside the repository's ignored tool folder. `scripts/build-firmware.ps1` compiles the sensor build; `-Simulation` compiles a separate fixed-value image. A simulation image refuses `DEVICE` enrollment. Neither script opens a serial port, uploads firmware or erases flash.

After hardware identification, wiring review and explicit selection of a port:

1. Record board model, serial identifier, flash/partition layout, image hash, build mode and wiring photographs. Review upload/partition behavior before flashing; a changed partition layout or erase operation can destroy pending readings.
2. Inspect USB `status`. On a genuinely new blank device only, initialize its empty filesystem using the explicit `format --confirm-erase` command. This erases **all local pending readings** and preserves valid NVS identity/high-water state. It is not a routine boot repair. Never use it on an unknown or deployed journal without documenting the loss.
3. Enroll the hive on the server with `scripts/provision-device.cjs`; use `SIMULATED` for demo/fixed-value testing. Keep its private export outside version control and restrict filesystem access. Validate it with `provision --credentials <private-export> --dry-run`, then provision using the explicitly selected USB port. Do not print the private export or place it in screenshots/slides.
4. Perform scale calibration if using a scale. Retrieve the pairing code privately. Set and verify the clock after other serial operations. Use `sample` only if the clock survives that serial session, otherwise the periodic sampler will run after time setup.
5. Use a compatible phone/browser over HTTPS, sign in as the hive's owner, open hive monitoring, choose the enrolled device and complete OS pairing. Check one observed metric against its reference measurement before treating it as physical evidence.
6. Collect while offline, reconnect to internet, confirm the database row and returned storage receipt, and inspect journal count after replay. A phone label alone is insufficient proof of firmware deletion.

The USB utility accepts only explicit local ports, validates identity before importing pyserial, correlates replies by request ID and prints an allowlisted public status response. Dry-run and unit tests do not open hardware. Formatting, port access and flashing have not been executed in this development checkpoint.

## Verification scope

`npm run test:firmware` compiles the shared C++ core on the host and runs 15 journal/protocol tests plus six Python operator-tool tests. Exact byte/HMAC compatibility is checked against the application's Node implementation. Fault cases cover reservation/append/deletion interruption, reboot, full storage, invalid readings/clocks, key/epoch rotation, corruption and counter exhaustion.

`npm run test:firmware:integration` is a separate synthetic local test requiring the compiled driver, dedicated PostgreSQL database and project MQTT TLS fixture. It carries a packet generated by the C++ core through the account queue, authenticated gateway and worker. It checks pending state after broker-only acceptance, receipt acceptance after database commit, journal deletion, reboot and duplicate delivery. The phone queue uses fake-indexeddb; the journal storage model remains in memory. Session identity is injected into the handler; this test does not exercise HTTP login, browser UI or physical BLE.

Final compile/test results and source hashes are recorded in `docs/qa/firmware-verification.json` after execution. Earlier document 13 results remain a historical checkpoint and are not automatically rerun or combined into a fresh whole-application test count.

## Required physical acceptance before a pilot

- Identify board/sensors, verify logic levels and measure HX711 pulse timing. Check valid/missing sensor behavior, scale reference masses and RTC loss/drift. Record photographs and actual observations with consent.
- Test pairing, wrong PIN, unauthorized commands, reconnect, phone screen/suspension behavior and supported phone/browser combinations. After draining a journal, rotate its enrollment and confirm that the old bond cannot silently authenticate; test interruption during bond removal/binding. Verify original bytes after each disconnect. Record firmware/OS/browser versions.
- Interrupt power during sequence reservation, temporary packet write, rename, receipt processing and deletion. Repeat across many cycles; compare journal IDs/hashes and server rows. No reused exposed sequence, silent packet replacement or automatic format is acceptable. Measure actual recovery time and capacity.
- Fill real flash, then restore connectivity. Confirm backpressure and that acknowledged space becomes reusable. Evaluate outages against the seven-day intake window and the actual sampling/storage budget.
- Measure current draw, usable battery duration, enclosure moisture/heat behavior, range and maintenance effort. The prototype currently keeps BLE/MCU active and makes no battery-life or solar-autonomy claim.
- Review device-key extraction risks. This reference build stores the secret in ordinary NVS. Production secure boot, flash/NVS encryption, signed updates, anti-rollback, key recovery and physical access policy need a board-specific provisioning design and test. No fuse-burning or security-lock commands are supplied or executed here.

Espressif documents NVS recovery and wear management in its [ESP-IDF 5.5.5 NVS guide](https://docs.espressif.com/projects/esp-idf/en/v5.5.5/esp32/api-reference/storage/nvs_flash.html). That platform behavior supports the design but is not a substitute for testing this exact firmware, partition layout and hardware under interrupted power.

Use the [fieldwork starter](submission/FIELDWORK-STARTER.md) for evidence collection. Keep unavailable details explicitly pending; do not describe synthetic telemetry, host fault tests or compiled images as a rural deployment.
