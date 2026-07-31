import { forgeProfiles } from "./forge-profiles.js"
import { httpProfiles } from "./http-profiles.js"
import { objectStoreProfiles } from "./object-store-profiles.js"; export const providerProfiles = [
  ...forgeProfiles, ...httpProfiles, ...objectStoreProfiles]
