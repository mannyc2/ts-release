import * as Schema from "effect/Schema"
import { ReleaseIntent } from "../domain/release.js"

export type * from "../types/effect-internal.js"

export const DEFAULT_CONFIG_PATH = "release.config.json"

export const ReleaseConfig = ReleaseIntent
export type ReleaseConfig = typeof ReleaseConfig.Type

export const decodeReleaseConfig = Schema.decodeUnknownEffect(ReleaseConfig)
