#!/usr/bin/env bun

import { cwd, exit } from "node:process"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { checkSkillPlugin } from "./lib/skill-plugin.js"

const report = checkSkillPlugin(cwd())
console.log(encodeCanonicalJson(report).trimEnd())
if (report.status !== "ready") exit(1)
