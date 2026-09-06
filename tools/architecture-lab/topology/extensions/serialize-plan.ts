import { Schema } from "effect"
import { canonical } from "./identity.js"
import { Plan } from "./contracts.js"

/** Public durable encoding convenience; identity and validation stay canonical. */
export const serializePlan = (plan: Plan): string => canonical(Schema.encodeSync(Plan)(plan))
