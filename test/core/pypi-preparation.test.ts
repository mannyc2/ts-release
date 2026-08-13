import { describe, expect, test } from "bun:test"
import { inspectPythonDistribution, PythonDistributionError } from "../../src/model/python-distribution.js"
import { sdistFixture, wheelFixture } from "../fixtures/python-distributions.js"

describe("PyPI prebuilt distribution preparation", () => {
  test("verifies wheel and sdist filename, archive, metadata, and tags", () => {
    const wheel = wheelFixture()
    const sdist = sdistFixture()
    expect(inspectPythonDistribution(wheel.filename, wheel.bytes, "fixture", "1.2.3")).toMatchObject({
      _tag: "wheel", project: "fixture", version: "1.2.3", pythonTag: "py3", abiTag: "none", platformTag: "any"
    })
    expect(inspectPythonDistribution(sdist.filename, sdist.bytes, "fixture", "1.2.3")).toMatchObject({
      _tag: "sdist", project: "fixture", version: "1.2.3", pythonTag: "source"
    })
  })

  test("rejects malformed and mismatched distributions", () => {
    const wheel = wheelFixture()
    const sdist = sdistFixture()
    expect(() => inspectPythonDistribution(wheel.filename, wheel.bytes, "other", "1.2.3")).toThrow(PythonDistributionError)
    expect(() => inspectPythonDistribution("fixture-9.9.9.tar.gz", sdist.bytes, "fixture", "1.2.3")).toThrow(PythonDistributionError)
    expect(() => inspectPythonDistribution("fixture-1.2.3.zip", wheel.bytes, "fixture", "1.2.3")).toThrow(PythonDistributionError)
    expect(() => inspectPythonDistribution(wheel.filename, wheel.bytes.subarray(0, 40), "fixture", "1.2.3")).toThrow(PythonDistributionError)
  })
})
