import type { ReleaseIntent } from "./config.js"
import type { VerifiedReleaseContext } from "./context.js"
import { contributeRelease } from "./capabilities.js"
import { linkContributions, ReleaseGraph } from "./graph.js"

// Pure internal IR compiler. It reads only its arguments; the source observer
// and prepared store are deliberately outside this function.
export const compileReleaseGraph = (
  intent: ReleaseIntent,
  context: VerifiedReleaseContext
): ReleaseGraph => linkContributions(contributeRelease(intent, context))
