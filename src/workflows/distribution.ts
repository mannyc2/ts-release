import * as Config from "./config.js"

export type * from "../types/effect-internal.js"

export const stageArtifacts = Config.stageArtifacts
export const renderStageArtifacts = Config.renderStageArtifacts
export const renderStagedArtifacts = Config.renderStagedArtifacts

export const planDistribution = Config.plan
export const renderDistributionPlan = Config.renderPlan
export const renderPlannedDistributionPlan = Config.renderPlannedPlan

export const renderDistribution = Config.render
export const validateDistribution = Config.validate
export const executeApprovedDistribution = Config.execute
export const runApprovedDistribution = Config.run
export const verifyDistribution = Config.verify
export const reconcileDistribution = Config.reconcile

export const stage = stageArtifacts
export const plan = planDistribution
export const renderPlan = renderDistributionPlan
export const renderPlannedPlan = renderPlannedDistributionPlan
export const render = renderDistribution
export const validate = validateDistribution
export const execute = executeApprovedDistribution
export const run = runApprovedDistribution
export const verify = verifyDistribution
export const reconcile = reconcileDistribution
