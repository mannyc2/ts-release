import { providerProfile } from "./profile.js"

const [gl, gt] = ["https://gitlab.com/api/v4", "https://gitea.com/api/v1"] as const
const release = (name: "gitlab" | "gitea", base: string, path: string, reconcilePath: string) =>
  providerProfile({ id: `forge.${name}-release/v1`, kind: "forge-release", variant: "ForgeRelease",
    protocol: `${name}-compatible/v1`, target: ["repository", "tag"],
    options: ["baseUrl", "dnsScope", "draft", "prerelease"], auth: "bearer", method: "POST",
    base, path, body: "forge-release/v1", success: "forge-release-response/v1",
    statuses: [200, 201], reconcile: "GET", reconcilePath, checkpoints: ["release", "assets"],
    equality: "tag-and-asset-name-digest", pagination: "link-header", selfHosted: true,
  })
const catalog = (name: "gitlab" | "gitea", base: string, path: string) =>
  providerProfile({ id: `forge.${name}-catalog-pr/v1`, kind: "forge-catalog-pr",
    variant: "ForgeCatalogPullRequest", protocol: `${name}-compatible/v1`,
    target: ["repository", "branch", "file"], options: ["baseUrl", "dnsScope", "title", "checkboxPolicy"],
    auth: "bearer", method: "POST", base, path, body: "catalog-pr/v1",
    success: "catalog-pr-response/v1", statuses: [200, 201], reconcile: "GET", reconcilePath: path,
    equality: "branch-file-content-digest", pagination: "link-header", selfHosted: true,
    checkpoints: ["branch", "file", "pull-request"] })
export const forgeProfiles = [
  release("gitlab", gl, "/projects/{repository}/releases", "/projects/{repository}/releases/{tag}"),
  release("gitea", gt, "/repos/{repository}/releases", "/repos/{repository}/releases/tags/{tag}"),
  catalog("gitlab", gl, "/projects/{repository}/merge_requests"),
  catalog("gitea", gt, "/repos/{repository}/pulls"),
  providerProfile({ id: "forge.milestone-close/v1", kind: "forge-milestone",
    variant: "MilestoneClose", protocol: "forge-neutral/v1", target: ["repository", "milestone"],
    options: [], auth: "bearer", method: "PATCH", base: "https://api.github.com",
    path: "/repos/{repository}/milestones/{milestone}", body: "milestone-close/v1",
    success: "milestone-response/v1", statuses: [200], reconcile: "GET", checkpoints: ["close"],
    reconcilePath: "/repos/{repository}/milestones/{milestone}", equality: "state-closed",
  })]
