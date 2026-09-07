"""Native pipes stay unread until after exit, independently of Bun's stream buffering."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

runtime, cli, application = sys.argv[1:]
work = Path(tempfile.mkdtemp(prefix="ts-release-cli-pipes-"))
input_file = work / "input.json"
marker = work / "lifecycle"
input_file.write_text(json.dumps({"marker": str(marker), "unresolved": True, "large": True}))
child = subprocess.Popen([runtime, cli, application, str(input_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and (not marker.exists() or marker.read_text() != "acquire\nrelease\n"):
        time.sleep(0.01)
    assert marker.read_text() == "acquire\nrelease\n"
    time.sleep(0.1)
    assert child.poll() is None, "Large output must be backpressured before the signal"
    child.send_signal(signal.SIGTERM)
    assert child.wait(timeout=2) == 143
    out, err = child.communicate()
    assert 0 < len(out) < 1024 * 1024, len(out)
    assert err == b"", err
finally:
    if child.poll() is None:
        child.kill()
    child.wait()

child = subprocess.Popen([runtime, cli, application, str(input_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
child.stdout.close()
assert child.wait(timeout=5) == 1
assert child.stderr.read() == b""

fifo = work / "input.fifo"
os.mkfifo(fifo)
child = subprocess.run([runtime, cli, application, str(fifo)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3)
assert child.returncode == 1
assert child.stdout == b""
assert child.stderr == b"ts-release: application failed; inspect the durable journal before resuming.\n"
assert marker.read_text() == "acquire\nrelease\nacquire\nrelease\n"
assert fifo.exists()
assert input_file.exists()
print(json.dumps({"cases": 3, "assertions": 13}))
