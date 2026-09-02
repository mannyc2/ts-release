#!/usr/bin/env node
import { runCli } from "./index.mjs";
process.stdout.write(`${await runCli(process.argv[2] ?? "cli-request")}\n`);
