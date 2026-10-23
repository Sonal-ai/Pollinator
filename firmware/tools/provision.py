"""Explicit USB operator utility. No port autodetection, flashing, or credential echo."""
import argparse
import json
import math
import re
import secrets
import sys
import time
import uuid
from pathlib import Path

SAFE_FIELDS = {"ok", "code", "requestId", "deviceId", "epoch", "source", "pending", "nextSequence",
               "filesystemReady", "sampleStatus", "bluetoothStatus", "climatePresent", "scaleCalibrated", "clockReady", "clockUtc", "raw", "pairingCode"}


def enrollment(file):
    try:
        value = json.loads(Path(file).read_text(encoding="utf-8-sig"))
        if not isinstance(value, dict) or type(value.get("version")) is not int or value.get("version") != 1:
            raise ValueError()
        device = value.get("deviceId")
        epoch = value.get("epoch")
        secret = value.get("secret")
        source = value.get("source")
        if not isinstance(device, str) or not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{2,63}", device):
            raise ValueError()
        if not isinstance(epoch, str) or str(uuid.UUID(epoch)) != epoch or uuid.UUID(epoch).version not in range(1, 9):
            raise ValueError()
        if not isinstance(secret, str) or not re.fullmatch(r"[a-f0-9]{64}", secret) or source not in ("DEVICE", "SIMULATED"):
            raise ValueError()
        return {"version": 1, "deviceId": device, "epoch": epoch, "secret": secret, "source": source}
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        raise ValueError("Enrollment file is missing or invalid. Its contents were not printed.") from None


def command(args):
    action = args.action
    if action == "provision":
        if not args.credentials:
            raise ValueError("Provide --credentials with the operator enrollment export.")
        return {"command": "provision", "identity": enrollment(args.credentials)}
    if action == "format":
        if not args.confirm_erase:
            raise ValueError("Formatting erases all pending readings. Explicit --confirm-erase is required.")
        return {"command": "format", "confirm": "ERASE_ALL_LOCAL_READINGS"}
    if action == "set-time":
        return {"command": "set-time", "unixSeconds": int(time.time())}
    if action == "set-scale":
        if args.tare_offset is None or args.counts_per_kg is None or not -2147483648 <= args.tare_offset <= 2147483647:
            raise ValueError("Provide measured --tare-offset and --counts-per-kg values.")
        if not math.isfinite(args.counts_per_kg) or not 1 <= abs(args.counts_per_kg) <= 1e9:
            raise ValueError("The scale calibration factor is invalid.")
        return {"command": "set-scale", "tareOffset": args.tare_offset, "countsPerKg": args.counts_per_kg}
    return {"command": action}


def exchange(channel, value, timeout=12):
    request_id = secrets.token_hex(8)
    data = {**value, "requestId": request_id}
    channel.write((json.dumps(data, separators=(",", ":")) + "\n").encode("ascii"))
    channel.flush()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        raw = channel.read_until(b"\n", 4097)
        if not raw or len(raw) > 4096:
            continue
        try:
            response = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            continue
        if not isinstance(response, dict) or response.get("requestId") != request_id or not isinstance(response.get("ok"), bool):
            continue
        safe = {}
        for key in SAFE_FIELDS:
            if key not in response:
                continue
            item = response[key]
            if isinstance(item, (dict, list)) or not isinstance(item, (str, int, float, bool)):
                continue
            if isinstance(item, str) and (len(item) > 128 or key in ("code", "sampleStatus", "bluetoothStatus") and not re.fullmatch(r"[A-Z0-9_]{1,64}", item)):
                continue
            safe[key] = item
        return safe
    raise RuntimeError("No matching device reply. Saved device state was not reset by this utility.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("status", "provision", "format", "set-time", "set-scale", "raw-scale", "pairing-code", "sample"))
    parser.add_argument("--port", help="Explicit local USB serial port, e.g. COM3 or /dev/ttyUSB0")
    parser.add_argument("--credentials")
    parser.add_argument("--confirm-erase", action="store_true")
    parser.add_argument("--tare-offset", type=int)
    parser.add_argument("--counts-per-kg", type=float)
    parser.add_argument("--dry-run", action="store_true", help="Validate input without importing serial, opening hardware or printing secrets")
    args = parser.parse_args(argv)
    try:
        value = command(args)
        if args.dry_run:
            result = {"ok": True, "dryRun": True, "action": args.action, "hardwareOpened": False}
            if "identity" in value:
                result.update({key: value["identity"][key] for key in ("deviceId", "epoch", "source")})
            print(json.dumps(result))
            return 0
        if not args.port or "://" in args.port:
            raise ValueError("Choose an explicit local USB --port. Network serial URLs and automatic selection are unsupported.")
        try:
            import serial
        except ImportError:
            raise RuntimeError("Install the pinned firmware/tools/requirements.txt in a private virtual environment first.") from None
        with serial.Serial(args.port, 115200, timeout=0.25, write_timeout=3) as channel:
            time.sleep(2)
            channel.reset_input_buffer()
            result = exchange(channel, value)
        print(json.dumps(result))
        return 0 if result.get("ok") else 1
    except (ValueError, RuntimeError, OSError):
        print("USB operator command failed. Check its explicit port, enrollment, confirmation and device status; credentials were not printed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
