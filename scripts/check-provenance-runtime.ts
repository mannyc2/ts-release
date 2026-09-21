import assert from "node:assert/strict"

// Offline native-crypto gate: compilation and stubbed verification missed this
// exact root-signature failure under Bun1.3.14. Pin the publishing Node runtime.
const program = `
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { Metadata } = require('@tufjs/models');
const seeds = JSON.parse(readFileSync('node_modules/@sigstore/tuf/seeds.json', 'utf8'));
const root = Metadata.fromJSON('root', JSON.parse(Buffer.from(seeds['https://tuf-repo-cdn.sigstore.dev']['root.json'], 'base64')));
root.verifyDelegate('root', root);
console.log(JSON.stringify({ runtime: process.version, sigstoreTrustRootVerified: true }));
`
const child = Bun.spawn(
  [process.env.TS_RELEASE_ACCEPTANCE_NODE ?? "node", "--input-type=module", "-e", program],
  {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  },
)
const [code, stdout, stderr] = await Promise.all([
  child.exited,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
])
assert.equal(code, 0, `Native provenance runtime failed trust-root verification\n${stderr}`)
assert.equal(JSON.parse(stdout).sigstoreTrustRootVerified, true)
console.log(stdout.trim())
