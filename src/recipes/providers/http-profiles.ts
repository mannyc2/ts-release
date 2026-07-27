import { providerProfile } from "./profile.js"

const stream = ["authorization", "content-type", "digest", "x-ts-release-key"] as const
const repositories = [
  ["artifactory", ["repository", "path"], "PUT", "https://artifactory.example.invalid",
    "/{repository}/{path}", [200, 201], "HEAD", "/{repository}/{path}", "content-length-and-digest", true, false],
  ["cloudsmith", ["owner", "repository", "path"], "POST", "https://api.cloudsmith.io",
    "/v1/packages/{owner}/{repository}/upload/{path}", [200, 201, 202], "GET",
    "/v1/packages/{owner}/{repository}/{path}", "size-and-digest", false, true],
  ["gemfury", ["account", "repository", "path"], "POST", "https://push.fury.io",
    "/{account}/{repository}/{path}", [200, 201], "GET", "/{account}/{repository}/{path}",
    "size-and-digest", false, false]
] as const
const repositoryProfiles = repositories.map(([name,target,method,base,path,statuses,reconcile,reconcilePath,
  equality,selfHosted,paged]) => providerProfile({
  id:`repository.${name}-upload/v1`,protocol:`${name}-compatible/v1`,target,method,base,path,statuses,reconcile,
  reconcilePath,equality,headers:stream,...(paged?{pagination:"link-header" as const}:{}),
  ...(selfHosted?{selfHosted:true,options:["baseUrl","dnsScope","contentType"] as const}:{}) }))
export const httpProfiles = [
  providerProfile({ id: "http.generic-upload/v1", kind: "http-publish", variant: "GenericHttp",
    protocol: "versionless-reviewed-http/v1", target: ["endpoint"],
    options: ["method", "headerNames", "bodyMapping"], method: "CONFIGURED",
    base: "configured-reviewed-endpoint", path: "configured-reviewed-path", headers: stream,
    body: "configured-raw-artifact/v1", success: "empty/v1", statuses: [200, 201, 202, 204],
    reconcile: "NONE", reconcilePath: "none", equality: "manual-only", selfHosted: true }),
  ...repositoryProfiles,
  providerProfile({ id: "registry.dockerhub-description/v1", kind: "registry-metadata",
    variant: "RegistryMetadata", protocol: "dockerhub-compatible/v1", target: ["repository"],
    options: ["summary", "description"], method: "PATCH", base: "https://hub.docker.com",
    path: "/v2/repositories/{repository}/", body: "registry-description/v1",
    success: "registry-description/v1", statuses: [200], reconcile: "GET",
    equality: "summary-and-description", checkpoints: ["update"] })]
