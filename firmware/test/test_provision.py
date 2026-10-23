import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("firmware_provision", ROOT / "firmware/tools/provision.py")
UTILITY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UTILITY)
SECRET = "ab" * 32  # Public test-only credential, never a real device enrollment.


class ProvisionTests(unittest.TestCase):
    def setUp(self):
        folder = ROOT / ".local-data/firmware-python-tests"
        folder.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=folder)
        self.addCleanup(self.directory.cleanup)
        self.file = Path(self.directory.name) / "test-enrollment.json"
        self.identity = {"version": 1, "deviceId": "SIM-USB-TEST", "epoch": str(uuid.uuid4()), "secret": SECRET, "source": "SIMULATED", "nextSequence": 999}
        self.file.write_text(json.dumps(self.identity), encoding="utf-8")

    def test_dry_run_validates_without_opening_hardware_or_printing_key(self):
        original_import = __import__

        def checked_import(name, *args, **kwargs):
            if name == "serial":
                self.fail("Dry run imported a hardware transport")
            return original_import(name, *args, **kwargs)

        output = io.StringIO()
        with patch("builtins.__import__", checked_import), contextlib.redirect_stdout(output):
            self.assertEqual(UTILITY.main(["provision", "--credentials", str(self.file), "--dry-run"]), 0)
        self.assertNotIn(SECRET, output.getvalue())
        self.assertFalse(json.loads(output.getvalue())["hardwareOpened"])
        self.assertNotIn("nextSequence", UTILITY.enrollment(self.file))

    def test_malformed_enrollment_rejects_without_echoing_contents(self):
        for change in ({"version": True}, {"secret": "example"}, {"source": "REAL"}, {"epoch": "old"}, {"deviceId": "../OTHER"}):
            self.file.write_text(json.dumps({**self.identity, **change}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "contents were not printed"):
                UTILITY.enrollment(self.file)

    def test_format_requires_explicit_confirmation_even_in_dry_run(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(UTILITY.main(["format", "--dry-run"]), 1)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(UTILITY.main(["format", "--confirm-erase", "--dry-run"]), 0)

    def test_non_dry_run_needs_explicit_local_port_before_importing_serial(self):
        for args in (["status"], ["status", "--port", "socket://example.test"]):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(UTILITY.main(args), 1)

    def test_scale_requires_finite_measured_parameters(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(UTILITY.main(["set-scale", "--tare-offset", "0", "--counts-per-kg", "nan", "--dry-run"]), 1)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(UTILITY.main(["set-scale", "--tare-offset", "1234", "--counts-per-kg", "-85000", "--dry-run"]), 0)

    def test_reply_correlation_ignores_boot_messages_and_filters_private_fields(self):
        class Channel:
            def write(self, data):
                self.request = json.loads(data)
                self.responses = [b'{"ok":false,"code":"UNPROVISIONED"}\n', json.dumps({"ok": True, "code": "OK", "requestId": self.request["requestId"], "secret": SECRET, "raw": {"secret": SECRET}}).encode()]

            def flush(self):
                pass

            def read_until(self, *args):
                return self.responses.pop(0)

        channel = Channel()
        response = UTILITY.exchange(channel, {"command": "provision", "identity": UTILITY.enrollment(self.file)})
        self.assertEqual(channel.request["identity"]["secret"], SECRET)
        self.assertEqual(response["code"], "OK")
        self.assertNotIn(SECRET, json.dumps(response))
        self.assertNotIn("raw", response)


if __name__ == "__main__":
    unittest.main()
