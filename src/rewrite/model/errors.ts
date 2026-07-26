import * as Schema from "effect/Schema"

const Reason = { reason: Schema.String }

export class PlanDecodeError extends Schema.TaggedErrorClass<PlanDecodeError>()(
  "PlanDecodeError",
  Reason
) {}
export class NonCanonicalPlanError
  extends Schema.TaggedErrorClass<NonCanonicalPlanError>()(
    "NonCanonicalPlanError",
    Reason
  )
{}
export class DuplicatePlanValueError
  extends Schema.TaggedErrorClass<DuplicatePlanValueError>()(
    "DuplicatePlanValueError",
    { kind: Schema.Literals(["operation-id", "output-id", "output-path"]), value: Schema.String }
  )
{}
export class OutputReferenceError
  extends Schema.TaggedErrorClass<OutputReferenceError>()(
    "OutputReferenceError",
    { operationId: Schema.String, outputId: Schema.String, reason: Schema.String }
  )
{}
export class UnsafePlanPathError
  extends Schema.TaggedErrorClass<UnsafePlanPathError>()(
    "UnsafePlanPathError",
    { path: Schema.String }
  )
{}
export class StageActionMismatchError
  extends Schema.TaggedErrorClass<StageActionMismatchError>()(
    "StageActionMismatchError",
    { stage: Schema.String, action: Schema.String }
  )
{}
export class CredentialConfinementError
  extends Schema.TaggedErrorClass<CredentialConfinementError>()(
    "CredentialConfinementError",
    { credential: Schema.String, reason: Schema.String }
  )
{}
export class SecretLikePlanValueError
  extends Schema.TaggedErrorClass<SecretLikePlanValueError>()(
    "SecretLikePlanValueError",
    { field: Schema.String }
  )
{}
export class ConfigValueError extends Schema.TaggedErrorClass<ConfigValueError>()(
  "ConfigValueError",
  Reason
) {}
export class ConfigDecodeError extends Schema.TaggedErrorClass<ConfigDecodeError>()(
  "ConfigDecodeError",
  Reason
) {}
export class PlanningFactsError extends Schema.TaggedErrorClass<PlanningFactsError>()(
  "PlanningFactsError",
  Reason
) {}
