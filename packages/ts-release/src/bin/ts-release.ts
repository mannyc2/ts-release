#!/usr/bin/env node
import { runCommandLine } from "../internal/CommandLine.js"

process.exitCode = await runCommandLine(process.argv.slice(2))
// Native stdio handles may retain queued writes after destroy(). Teardown only
// after runCommandLine has awaited the application's scoped interruption.
if (process.exitCode === 130 || process.exitCode === 143) process.exit(process.exitCode)
