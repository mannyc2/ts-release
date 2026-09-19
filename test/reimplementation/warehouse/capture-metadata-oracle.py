"""Native Twine admission controls over actual Python-built wheel members."""
import base64
import hashlib
import importlib.metadata
import io
import json
import pathlib
import tempfile
import zipfile
from twine.package import PackageFile
from twine.repository import Repository
import packaging.metadata
import packaging.requirements
import packaging.specifiers
import twine.package

directory = pathlib.Path(__file__).parent / "fixtures"
filename = "ts_release_native_fixture-1.2.3-py3-none-any.whl"
original = (directory / "distributions" / filename).read_bytes()
cases = [
    ("valid-python-range", "2.4", "Requires-Python: >=3.10, !=3.11.*\n"),
    ("invalid-python-range", "2.4", "Requires-Python: not-a-version\n"),
    ("invalid-pre-wildcard", "2.4", "Requires-Python: ==3.11rc1.*\n"),
    ("invalid-compatible-single", "2.4", "Requires-Python: ~=3\n"),
    ("invalid-local-order", "2.4", "Requires-Python: >=3.11+local\n"),
    ("arbitrary-equality", "2.4", "Requires-Python: ===vendor-version\n"),
    ("valid-requirement", "2.4", "Requires-Dist: requests[security,tests] (>=2.8.1, ==2.8.*); python_version < '3.12' and (os_name == 'posix' or extra == 'test')\n"),
    ("valid-url-requirement", "2.4", "Requires-Dist: package @ https://example.org/pkg.whl ; sys_platform == 'linux'\n"),
    ("valid-empty-extras", "2.4", "Requires-Dist: package[]\n"),
    ("invalid-range-requirement", "2.4", "Requires-Dist: package >=no\n"),
    ("invalid-extra-requirement", "2.4", "Requires-Dist: package[a,]\n"),
    ("invalid-marker-variable", "2.4", "Requires-Dist: package; imaginary == 'x'\n"),
    ("invalid-marker-expression", "2.4", "Requires-Dist: package; os_name == 'posix' or\n"),
    ("valid-dynamic", "2.4", "Dynamic: Summary\n"),
    ("invalid-dynamic-name", "2.4", "Dynamic: Name\n"),
    ("invalid-dynamic-field", "2.4", "Dynamic: Imaginary\n"),
    ("old-dynamic", "2.1", "Dynamic: Summary\n"),
    ("valid-license", "2.4", "License-Expression: mit OR (Apache-2.0 AND BSD-3-Clause)\n"),
    ("valid-license-ref", "2.4", "License-Expression: LicenseRef-Proprietary\n"),
    ("valid-license-exception", "2.4", "License-Expression: GPL-2.0-only WITH Classpath-exception-2.0\n"),
    ("invalid-license", "2.4", "License-Expression: MadeUp-License\n"),
    ("old-license-expression", "2.1", "License-Expression: MIT\n"),
    ("valid-license-file", "2.4", "License-File: licenses/LICENSE\n"),
    ("old-setuptools-license-file", "2.1", "License-File: ../LICENSE\n"),
    ("invalid-license-file", "2.4", "License-File: ../LICENSE\n"),
    ("invalid-absolute-license-file", "2.4", "License-File: C:\\LICENSE\n"),
    ("folded-summary", "2.4", "Summary: first\n second\n"),
    ("summary-unicode-newline", "2.4", "Summary: first\u2028second\n"),
    ("valid-markdown", "2.4", 'Description-Content-Type: text/markdown; charset="UTF-8"; variant=CommonMark\n'),
    ("invalid-markdown-variant", "2.4", "Description-Content-Type: text/markdown; variant=arbitrary\n"),
    ("invalid-description-charset", "2.4", "Description-Content-Type: text/plain; charset=ascii\n"),
    ("invalid-description-type", "2.4", "Description-Content-Type: application/json\n"),
    ("invalid-mime-syntax", "2.4", "Description-Content-Type: text/plain; x*\n"),
    ("valid-extra", "2.4", "Provides-Extra: cli_tools\n"),
    ("invalid-extra", "2.4", "Provides-Extra: invalid extra\n"),
    ("duplicate-url-label", "2.4", "Project-URL: Docs, https://example.org/one\nProject-URL: Docs, https://example.org/two\n"),
    ("keywords-urls", "2.4", "Keywords: release,testing, python\nProject-URL: Docs,https://example.org/\n"),
    ("unknown-field", "2.4", "Imaginary: value\n"),
    ("duplicate-name", "2.4", "Name: other-project\n"),
    ("invalid-version-2.0", "2.0", ""),
    ("valid-version-1.0", "1.0", ""),
    ("valid-imports", "2.5", "Import-Name: ts_release_native_fixture; private\nImport-Namespace: namespace.part\n"),
    ("valid-empty-imports", "2.6", "Import-Name: \n"),
    ("invalid-import-name", "2.5", "Import-Name: namespace.class\n"),
    ("old-import-name", "2.4", "Import-Name: namespace.part\n"),
]
for index, (key, value) in enumerate(json.loads((directory / "grammar-cases.json").read_text())):
    cases.append((f"review-grammar-{index}-{key}", "2.5" if key.startswith("Import-") else "2.4", f"{key}: {value}\n"))
cases.extend([
    ("native-new-license-exception", "2.4", "License-Expression: MIT WITH PCRE2-exception\n"),
    ("native-new-cgal-exception", "2.4", "License-Expression: GPL-3.0-only WITH CGAL-linking-exception\n"),
    ("non-native-catalog-license", "2.4", "License-Expression: MIT-STK\n"),
    ("invalid-extended-charset", "2.4", "Description-Content-Type: text/plain; charset*=UTF-8''ascii\n"),
    ("invalid-extended-variant", "2.4", "Description-Content-Type: text/markdown; variant*=UTF-8''unknown\n"),
])
records = []
with tempfile.TemporaryDirectory(prefix="ts-release-metadata-oracle-") as work:
    for label, version, fields in cases:
        stream = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(original)) as source, zipfile.ZipFile(stream, "w") as target:
            for member in source.infolist():
                data = source.read(member)
                if member.filename.endswith("/METADATA"):
                    data = (f"Metadata-Version: {version}\nName: ts-release-native-fixture\nVersion: 1.2.3\n" + fields + "\nNative validation control.\n").encode()
                target.writestr(member, data)
        archive = stream.getvalue()
        path = pathlib.Path(work) / filename
        path.write_bytes(archive)
        try:
            package = PackageFile.from_filename(str(path), None)
            native_fields = Repository._convert_metadata_to_list_of_tuples(package.metadata_dictionary())
            accepted = True
        except Exception:
            native_fields = None
            accepted = False
        records.append({"case": label, "accepted": accepted, "fields": native_fields,
                        "sha256": hashlib.sha256(archive).hexdigest(),
                        "archiveBase64": base64.b64encode(archive).decode()})
record = {"format": "ts-release/python-metadata-oracle/1", "filename": filename,
          "packages": {name: importlib.metadata.version(name) for name in ["twine", "packaging"]},
          "sources": [{"name": module.__name__, "sha256": hashlib.sha256(pathlib.Path(module.__file__).read_bytes()).hexdigest()}
                      for module in [twine.package, packaging.metadata, packaging.requirements, packaging.specifiers]],
          "cases": records,
          "limits": ["Native Twine admission over mutated owned wheel metadata; no registry write", "RECORD intentionally unchanged: Twine does not validate installed member RECORD at upload admission"]}
(directory / "metadata-oracle.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"cases": len(records), "accepted": sum(item["accepted"] for item in records)}))
