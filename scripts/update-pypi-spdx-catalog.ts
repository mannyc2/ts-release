import { join } from "node:path"

// Generated data, not executable provider logic. Keep its bytes and metadata
// cost visible in source accounting and bind it to the native validation owner.
const bin = process.env.TS_RELEASE_PYTHON_NATIVE_BIN ?? "/tmp/ts-release-warehouse-native-venv/bin"
const source = `import hashlib,importlib.metadata,json,pathlib
from packaging.licenses import _spdx
assert importlib.metadata.version('packaging') == '26.3'
print(json.dumps({'format':'ts-release/python-spdx-catalog/1','packaging':'26.3','spdx':_spdx.VERSION,'sourceSha256':hashlib.sha256(pathlib.Path(_spdx.__file__).read_bytes()).hexdigest(),'license':'CC0-1.0 (SPDX license-list-data)','licenses':sorted(_spdx.LICENSES),'exceptions':sorted(_spdx.EXCEPTIONS)},indent=2))`
const child = Bun.spawn([join(bin, "python"), "-c", source], { stdout: "pipe", stderr: "inherit" })
const output = await new Response(child.stdout).text()
if (await child.exited) throw new Error("Native SPDX projection failed")
await Bun.write(join(import.meta.dir, "../packages/pypi/src/SpdxCatalog.json"), output)
