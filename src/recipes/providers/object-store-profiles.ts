import { providerProfile } from "./profile.js"

const rows = [
  ["object.s3-put/v1","s3-signed-put/v1",["bucket","key"],"signed-request","https://s3.amazonaws.com",
    "/{bucket}/{key}","empty/v1",[200,201,204],"HEAD","/{bucket}/{key}","content-length-and-digest",[]],
  ["object.gcs-put/v1","gcs-json-upload/v1",["bucket","key"],"bearer","https://storage.googleapis.com",
    "/upload/storage/v1/b/{bucket}/o/{key}","object-metadata/v1",[200,201],"GET",
    "/storage/v1/b/{bucket}/o/{key}","size-and-digest",[]],
  ["object.azure-blob-put/v1","azure-blob-put/v1",["account","container","blob"],"shared-key",
    "https://{account}.blob.core.windows.net","/{container}/{blob}","empty/v1",[201],"HEAD",
    "/{container}/{blob}","content-length-and-digest",["x-ms-blob-type"]]
] as const
export const objectStoreProfiles = rows.map(([id,protocol,target,auth,base,path,success,statuses,reconcile,
  reconcilePath,equality,extra]) => providerProfile({ id, kind:"object-store-publish",
  variant:"ObjectStorePublish",protocol,target,options:["contentType"],auth,method:"PUT",base,path,
  headers:["authorization","content-type","digest",...extra,"x-ts-release-key"],body:"verified-content-stream/v1",
  success,statuses,reconcile,reconcilePath,equality,checkpoints:["put"] }))
