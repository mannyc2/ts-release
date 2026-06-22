import { ReleaseWorkflowPhase } from "../domain/status.js"

export const workflowPhases: ReadonlyArray<ReleaseWorkflowPhase> = ["render", "validation", "execution", "verification"]
