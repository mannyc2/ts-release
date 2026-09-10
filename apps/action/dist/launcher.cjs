// apps/action/src/launcher.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var import_node_module = require("node:module");
var import_node_url = require("node:url");
var required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value)
    throw new Error(`GitHub Action requires ${name}`);
  return value;
};
var inside = (root, child) => {
  const path = import_node_path.relative(root, child);
  return path !== ".." && !path.startsWith(`..${import_node_path.sep}`) && !import_node_path.isAbsolute(path);
};
var applicationPath = async (workspace, input) => {
  const candidate = import_node_path.resolve(workspace, input);
  const actual = inside(workspace, candidate) ? await import_promises.realpath(candidate) : candidate;
  if (!inside(workspace, actual))
    throw new Error("Action application is outside GITHUB_WORKSPACE");
  return actual;
};
var runActionEnvironment = async (environment = process.env) => {
  const workspace = await import_promises.realpath(required(environment, "GITHUB_WORKSPACE"));
  const application = await applicationPath(workspace, required(environment, "INPUT_APPLICATION"));
  const manifestPath = import_node_module.findPackageJSON("@mannyc1/ts-release/node", import_node_url.pathToFileURL(application));
  if (!manifestPath)
    throw new Error("Install @mannyc1/ts-release in the application workspace");
  const manifest = JSON.parse(await import_promises.readFile(manifestPath, "utf8"));
  const entry = import_node_path.resolve(import_node_path.dirname(manifestPath), manifest.exports["./node"].import);
  const { runApplication, runInterruptibleProcess } = await import(import_node_url.pathToFileURL(entry).href);
  return runInterruptibleProcess(async (signal, exitCode) => {
    try {
      const input = JSON.parse(environment.INPUT_INPUT ?? "{}");
      const observe = environment.INPUT_OBSERVE ?? "false";
      if (!["true", "false"].includes(observe))
        throw new Error("observe must be true or false");
      const report = await runApplication(application, input, signal, observe === "true" ? "observe" : "run");
      const revision = String(report.journal.revision);
      if (!/^[a-f0-9]{64}$/u.test(report.plan.planId) || !/^\d+$/u.test(revision))
        throw new Error("Action report contains invalid output identities");
      await import_promises.appendFile(required(environment, "GITHUB_OUTPUT"), `plan-id=${report.plan.planId}
journal-revision=${revision}
`, { encoding: "utf8" });
      process.stdout.write(`${JSON.stringify(report)}
`);
      const complete = report.operations.every((operation) => operation.status === "Satisfied");
      if (!complete)
        process.stderr.write(`ts-release Action: publication is incomplete. Inspect the JSON operation statuses; rerun with observe: true and the same application, input, Bundle, Plan and durable journal to refresh progress. Unresolved dispatches still require evidence before retry.
`);
      return exitCode() || (complete ? 0 : 2);
    } catch (cause) {
      if (exitCode())
        return exitCode();
      throw cause;
    }
  });
};
runActionEnvironment().then((code) => process.exitCode = code, () => {
  process.stderr.write(`ts-release Action failed; verify the workspace dependency installation, application/input and durable journal access. Rerun with observe: true to inspect progress before resuming.
`);
  process.exitCode = 1;
});
