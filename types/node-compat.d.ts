import type { TextDecoderOptions as NodeTextDecoderOptions } from "node:util"

// effect@4.0.0-rc.115 Channel.d.ts references this browser-global type name.
// @types/node@25.9.3 exposes the same native constructor options from node:util,
// but does not declare that global name. Native projects need not opt into
// DOM/Bun ambient types. Interface merging also supports the npm SDK's explicit
// DOM reference in @types/make-fetch-happen. No runtime shim or skipped checking.
declare global {
  interface TextDecoderOptions extends NodeTextDecoderOptions {}
}
