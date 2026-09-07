"""Capture unchanged Twine's native encoder at its outbound session boundary."""
import base64
import hashlib
import importlib.metadata
import json
import pathlib
import sys
from twine.package import PackageFile
from twine.repository import Repository
import twine.package
import twine.repository

directory = pathlib.Path(sys.argv[1])
requests = []

def capture(url, *, data, allow_redirects, headers):
    assert allow_redirects is False
    body = data.read()
    requests.append({"endpoint": url, "headers": headers,
                     "bodyBase64": base64.b64encode(body).decode(),
                     "bodySha256": hashlib.sha256(body).hexdigest()})
    return type("Response", (), {"status_code": 200})()

repository = Repository("https://upload.pypi.org/legacy/", None, None, True)
repository.session.post = capture
for path in sorted((directory / "distributions").iterdir()):
    package = PackageFile.from_filename(str(path), None)
    repository.upload(package)
    requests[-1]["filename"] = path.name
    requests[-1]["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    requests[-1]["metadata"] = package.metadata_dictionary()

record = {"format": "ts-release/python-native-oracle/1",
          "twine": importlib.metadata.version("twine"),
          "sources": [{"name": module.__name__, "sha256": hashlib.sha256(pathlib.Path(module.__file__).read_bytes()).hexdigest()}
                      for module in [twine.package, twine.repository]],
          "requests": requests,
          "limits": ["Native Twine encoder with captured outbound port; no registry write",
                     "Boundary/field order differ; provider uses SHA256 without optional Blake2 and format-specific file MIME"]}
(directory / "native-oracle.json").write_text(json.dumps(record, indent=2) + "\n")
