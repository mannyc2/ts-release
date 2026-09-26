"""Native pipes stay unread until after exit, independently of Bun's stream buffering."""
import json
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import sys
import tempfile
import time

runtime, cli, application = sys.argv[1:]
child = None
work = None
output = None
writer = None
stopping = False


def stop(_signal, _frame):
    global stopping
    stopping = True
    if child is not None and child.poll() is None:
        child.send_signal(signal.SIGTERM)


def check_running():
    if stopping:
        raise InterruptedError("Pipe fixture interrupted by its test runner")


# A runner signal must reach the owned CLI instead of orphaning it. Register
# before fixture acquisition, and latch it across all three child operations.
signal.signal(signal.SIGTERM, stop)
try:
    work = Path(tempfile.mkdtemp(prefix="ts-release-cli-pipes-"))
    input_file = work / "input.json"
    marker = work / "lifecycle"
    input_file.write_text(json.dumps({"marker": str(marker), "unresolved": True, "large": True}))
    reader, writer = os.pipe()
    output = os.fdopen(reader, "rb")
    check_running()
    child = subprocess.Popen([runtime, cli, application, str(input_file)], stdout=writer, stderr=subprocess.PIPE)
    check_running()
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and (not marker.exists() or marker.read_text() != "acquire\nrelease\n"):
        check_running()
        time.sleep(0.01)
    assert marker.read_text() == "acquire\nrelease\n"
    # Nobody reads the pipe. Its write end becoming non-writable is the native
    # backpressure barrier, rather than elapsed time after application cleanup.
    while select.select([], [writer], [], 0)[1]:
        check_running()
        if child.poll() is not None or time.monotonic() >= deadline:
            raise TimeoutError("Large report did not reach native pipe backpressure")
        time.sleep(0.01)
    os.close(writer)
    writer = None
    assert child.poll() is None, "Large output must be backpressured before the signal"
    child.send_signal(signal.SIGTERM)
    assert child.wait(timeout=2) == 143
    out, err = output.read(), child.stderr.read()
    assert 0 < len(out) < 1024 * 1024, len(out)
    assert err == b"", err
    output.close()
    output = None
    child.stderr.close()

    check_running()
    child = subprocess.Popen([runtime, cli, application, str(input_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    check_running()
    child.stdout.close()
    assert child.wait(timeout=5) == 1
    assert child.stderr.read() == b""
    child.stderr.close()

    fifo = work / "input.fifo"
    os.mkfifo(fifo)
    check_running()
    child = subprocess.Popen([runtime, cli, application, str(fifo)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    check_running()
    out, err = child.communicate(timeout=3)
    assert child.returncode == 1
    assert out == b""
    assert b"ts-release --observe" in err
    assert marker.read_text() == "acquire\nrelease\nacquire\nrelease\n"
    assert fifo.exists()
    assert input_file.exists()
    print(json.dumps({"cases": 3, "assertions": 13}))
finally:
    if child is not None:
        if child.poll() is None:
            child.send_signal(signal.SIGTERM)
            try:
                child.wait(timeout=2)
            except subprocess.TimeoutExpired:
                child.kill()
        child.wait()
        if child.stdout is not None:
            child.stdout.close()
        if child.stderr is not None:
            child.stderr.close()
    if output is not None:
        output.close()
    if writer is not None:
        os.close(writer)
    if work is not None:
        shutil.rmtree(work)
