# Honey Chain hive firmware

Reference firmware for a **classic ESP32 DevKit**, with a shared C++ journal and the same packet/receipt protocol as the application. Hardware selection, board wiring, calibration, phone pairing and physical power-loss tests remain pending. No board has been flashed during development.

Read [the firmware implementation and bench plan](../docs/14-HIVE-FIRMWARE-AND-BENCH-PLAN.md) before using hardware. This directory does not contain enrollment secrets. The phone does not receive device keys.

## Compile without hardware

The Windows setup keeps tools inside ignored `.local-tools/arduino`. It checks the official Arduino CLI 1.5.1 archive SHA-256 before extracting it. The sketch profile pins ESP32 core 3.3.12 and every library version. The first profile build downloads an isolated toolchain and can take substantial time and disk space.

From the repository root:

```powershell
./scripts/setup-firmware-tools.ps1
./scripts/build-firmware.ps1
./scripts/build-firmware.ps1 -Simulation
```

The normal build reads available sensors. The simulation build produces fixed synthetic measurements and **refuses capture unless enrolled as `SIMULATED`**. Keep images and enrollment modes clearly identified. Both commands compile only; neither selects a port nor uploads firmware.

`sketch.yaml` selects `esp32:esp32:esp32:PartitionScheme=no_ota`. Changing board or partition scheme requires a fresh compatibility and data-retention review. The prototype implements no OTA updater, Wi-Fi credentials, battery telemetry or deep sleep.

## Run host checks

Install a C++17 compiler. On Windows, the host build defaults to `C:/mingw64/bin/g++.exe` and Windows CNG; override with `HONEYCHAIN_HOST_CXX`. Linux uses `g++` and OpenSSL development headers. Python 3 is needed for the USB utility tests; override its executable with `HONEYCHAIN_PYTHON` when `python` is not on PATH.

```powershell
npm run test:firmware
```

These checks compile the shared core and exercise an **in-memory durable-store/fault model**, not ESP32 flash. The optional `npm run test:firmware:integration` requires a separately started, isolated integration database and project TLS broker as described in document 14. It must not be pointed at production services.

## USB operator utility

Install `tools/requirements.txt` in a private virtual environment when a board is available. Use an explicitly chosen local USB port; the utility does not discover ports, flash boards or accept network serial URLs. `--dry-run` validates a request without importing pyserial or opening hardware.

```powershell
python firmware/tools/provision.py provision --credentials .local-data/private-device.json --dry-run
python firmware/tools/provision.py status --port COM3
```

`COM3` is an example, not a detected device. Detailed first-boot, calibration and pairing steps are in document 14. Formatting is destructive and requires an explicit `format --confirm-erase` action. Never format merely to recover a mount error or install a fresh enrollment over pending readings.
