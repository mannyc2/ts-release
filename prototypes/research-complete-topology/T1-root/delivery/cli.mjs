#!/usr/bin/env node
import { runCli } from "./t1-root.bundle.mjs";
process.stdout.write(`${await runCli(process.argv[2] ?? "cli-request")}\n`);
