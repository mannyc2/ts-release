"""Execute unchanged pinned Warehouse duplicate helper and response branches.

Database expressions/rows and HTTP objects are bounded protocol stand-ins. This
is native source-law evidence, not execution of a hosted Warehouse deployment.
"""
import hashlib
import json
import pathlib
import textwrap
from types import SimpleNamespace

path = pathlib.Path(__file__).parent / "fixtures/warehouse-legacy.py"
source = path.read_text()
helper = source[source.index("def _is_duplicate_file("):source.index("\ndef _sort_releases(")]
start = source.index("        is_duplicate = _is_duplicate_file(request.db, filename, file_hashes)")
end = source.index("        # Check that the release is either new", start)
branches = textwrap.dedent(source[start:end])

class Predicate:
    def __init__(self, call): self.call = call
    def __or__(self, other): return Predicate(lambda row: self.call(row) or other.call(row))

class Column:
    def __init__(self, name): self.name = name
    def __eq__(self, value): return Predicate(lambda row: getattr(row, self.name) == value)

class File:
    filename = Column("filename")
    blake2_256_digest = Column("blake2_256_digest")

class Filename:
    filename = Column("filename")

class Query:
    def __init__(self, rows): self.rows = rows
    def filter(self, predicate): return Query([row for row in self.rows if predicate.call(row)])
    def first(self): return self.rows[0] if self.rows else None
    def exists(self): return self
    def scalar(self): return bool(self.rows)

class Database:
    def __init__(self, files, names): self.files, self.names = files, names
    def query(self, model):
        if isinstance(model, Query): return model
        return Query(self.files if model is File else self.names)

class HTTPBadRequest(Exception): pass
class HTTPOk:
    status_code = 200

namespace = {"File": File, "Filename": Filename, "HTTPOk": HTTPOk,
             "HTTPBadRequest": HTTPBadRequest, "_exc_with_message": lambda kind, text: kind(text)}
exec(compile(helper, str(path), "exec"), namespace)
exec(compile("def selected_response(request, filename, file_hashes):\n" + textwrap.indent(branches, "    "), str(path), "exec"), namespace)
name, hashes = "native-1.2.3.tar.gz", {"sha256": "sha256-fixture", "blake2_256": "blake-fixture"}
records = []
for label, row, deleted in [
    ("absent", None, False),
    ("exact", (name, hashes["sha256"], hashes["blake2_256"]), False),
    ("same-name-changed-hash", (name, "different", hashes["blake2_256"]), False),
    ("same-bytes-different-name", ("different.tar.gz", hashes["sha256"], hashes["blake2_256"]), False),
    ("deleted-filename", None, True),
]:
    doomed = []
    db = Database([] if row is None else [SimpleNamespace(filename=row[0], sha256_digest=row[1], blake2_256_digest=row[2])], [SimpleNamespace(filename=name)] if deleted else [])
    request = SimpleNamespace(db=db, tm=SimpleNamespace(doom=lambda: doomed.append(True)), metrics=SimpleNamespace(increment=lambda *args, **kwargs: None), help_url=lambda **kwargs: "https://pypi.org/help/#file-name-reuse")
    try:
        result = namespace["selected_response"](request, name, hashes)
        status = result.status_code if result else "continue-native-validation"
        message = None
    except HTTPBadRequest as error:
        status, message = 400, str(error)
    records.append({"case": label, "status": status, "doomed": bool(doomed), "message": message})
print(json.dumps({"source": "https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py", "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "helperSha256": hashlib.sha256(helper.encode()).hexdigest(), "branchesSha256": hashlib.sha256(branches.encode()).hexdigest(), "cases": records}))
