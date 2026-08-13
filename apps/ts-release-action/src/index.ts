import * as core from "@actions/core"
import {
  encodeCompletePreparedReleaseRef,
  makeReleaseApi,
  unsupportedExecutionHost
} from "@mannyc1/ts-release"
import { makeNodeReleaseLayer } from "@mannyc1/ts-release/node"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import {
  actionErrorMessage,
  makePreparedReferenceChannel,
  runAction
} from "./commands.js"
import {
  actionProducerContextFromEnvironment,
  makeActionsArtifactTransport,
  makeActionPreparedReleaseStore,
  makeGitHubRunAttemptAuthenticator
} from "./prepared-store.js"

const summarize = async (message: string): Promise<void> => {
  await core.summary.addRaw(`${message}\n`).write()
}

let api: ReturnType<typeof makeReleaseApi> | undefined
try {
  const hostRefusal = unsupportedExecutionHost(process.platform)
  if (hostRefusal !== undefined) throw new Error(hostRefusal)

  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
  const producer = actionProducerContextFromEnvironment(process.env)
  const actionToken = process.env.GITHUB_TOKEN?.trim()
  if (actionToken !== undefined && actionToken.length > 0) core.setSecret(actionToken)
  const preparedReference = makePreparedReferenceChannel({
    output: core.setOutput,
    summarize
  })
  const store = makeActionPreparedReleaseStore({
    workspace,
    context: producer,
    artifacts: makeActionsArtifactTransport(),
    ...(actionToken === undefined || actionToken.length === 0 ? {} : { token: actionToken }),
    runAttempts: makeGitHubRunAttemptAuthenticator(),
    onCommit: async (reference) => {
      await preparedReference.emit(encodeCompletePreparedReleaseRef(reference))
    }
  })
  api = makeReleaseApi(makeNodeReleaseLayer(store))

  await runAction(api, {
    workspace,
    input: core.getInput,
    output: core.setOutput,
    read: (path) => readFileSync(path, "utf8"),
    write: (path, value) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, value)
    },
    preparedReference,
    summarize
  })
} catch (cause) {
  core.setFailed(actionErrorMessage(cause))
} finally {
  await api?.dispose()
}
