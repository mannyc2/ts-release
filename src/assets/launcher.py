"""Python launcher for the bundled {{consoleScript}} CLI."""

from __future__ import annotations

import os
import platform
import stat
import subprocess
import sys
from importlib import resources


BINARIES = {
{{entries}}
}


def _platform_key() -> tuple[str, str]:
    system = sys.platform
    if system.startswith("linux"):
        os_name = "linux"
    elif system == "darwin":
        os_name = "darwin"
    elif system in ("win32", "cygwin"):
        os_name = "windows"
    else:
        raise RuntimeError(f"Unsupported operating system: {system}")

    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        arch = "x64"
    elif machine in ("aarch64", "arm64"):
        arch = "arm64"
    else:
        raise RuntimeError(f"Unsupported architecture: {machine}")

    return os_name, arch


def main() -> int:
    try:
        binary_name = BINARIES[_platform_key()]
        binary = resources.files("{{moduleName}}").joinpath("bin", binary_name)
        if not binary.is_file():
            raise RuntimeError(f"Bundled {{consoleScript}} binary was not found: {binary}")
        binary_path = os.fspath(binary)
        if os.name != "nt":
            os.chmod(binary_path, os.stat(binary_path).st_mode | stat.S_IXUSR)
        completed = subprocess.run([binary_path, *sys.argv[1:]], check=False)
        return completed.returncode
    except Exception as error:
        print(f"{{consoleScript}} launcher error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
