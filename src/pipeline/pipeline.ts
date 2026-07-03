import type { Pipe } from "./pipe.js"
import { buildPipe } from "../pipes/build.js"
import { npmPackPipe } from "../pipes/npm-pack.js"
import { pypiWheelPipe } from "../pipes/pypi-wheel.js"

export type * from "../types/effect-internal.js"

export const buildPipeline: ReadonlyArray<Pipe<unknown>> = [
  buildPipe,
  npmPackPipe,
  pypiWheelPipe
]
