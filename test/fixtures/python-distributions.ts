import { tarGz, zip } from "../../src/drivers/archive.js"

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)

export const wheelFixture = (
  project = "fixture",
  version = "1.2.3",
  python = "py3",
  abi = "none",
  platform = "any"
): { readonly filename: string, readonly bytes: Uint8Array } => {
  const escapedProject = project.replaceAll("-", "_")
  const escapedVersion = version.replaceAll("-", "_")
  const root = `${escapedProject}-${escapedVersion}.dist-info`
  const filename = `${escapedProject}-${escapedVersion}-${python}-${abi}-${platform}.whl`
  return {
    filename,
    bytes: zip([
      {
        path: `${root}/METADATA`, mode: 0o100644,
        data: bytes(`Metadata-Version: 2.4\nName: ${project}\nVersion: ${version}\n\nfixture\n`)
      },
      {
        path: `${root}/WHEEL`, mode: 0o100644,
        data: bytes(`Wheel-Version: 1.0\nGenerator: fixture\nRoot-Is-Purelib: true\nTag: ${python}-${abi}-${platform}\n`)
      },
      { path: `${project}/__init__.py`, mode: 0o100644, data: bytes("__version__ = 'fixture'\n") }
    ])
  }
}

export const sdistFixture = (
  project = "fixture",
  version = "1.2.3"
): { readonly filename: string, readonly bytes: Uint8Array } => ({
  filename: `${project}-${version}.tar.gz`,
  bytes: tarGz([
    {
      path: `${project}-${version}/PKG-INFO`, mode: 0o100644,
      data: bytes(`Metadata-Version: 2.4\nName: ${project}\nVersion: ${version}\n\nfixture\n`)
    },
    { path: `${project}-${version}/README.md`, mode: 0o100644, data: bytes("fixture\n") }
  ])
})
