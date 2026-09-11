export {
  ApplicationSignature,
  ProductSignature,
  AppPreparation,
  DmgPreparation,
  PkgPreparation,
  ApplePreparation,
  ApplePreparations,
  PREPARATION_FORMAT,
  PREPARATIONS_FORMAT,
  PRODUCER_VERSION,
  createApplePreparations,
  loadApplePreparations,
  productOf,
  sourceIdentity,
  StapledApp,
  StapledDmg,
  StapledPkg,
  StapledProduct,
  FinalArtifact,
  ReadyToPlan,
  AppleEvidence,
} from "./apple/Model.js"
export type { ApplePreparationInput, Product } from "./apple/Model.js"
export { AppleTools, appleToolsLayer } from "./apple/Tools.js"
export type { AppleToolsShape, AppleToolError } from "./apple/Tools.js"
export { restorePreparedSource, submitPrepared, finishPrepared } from "./apple/Native.js"
export type { NativeAppleError, NativeAppleServices, DeriveDeliveryFiles } from "./apple/Native.js"
export { preparationProvider, sourceCorresponds } from "./apple/Provider.js"
export {
  preparationScopes,
  runPreparation,
  validateApplePublication,
  reportAppleContext,
} from "./apple/Preparation.js"
