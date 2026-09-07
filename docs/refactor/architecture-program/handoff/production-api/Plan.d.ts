import * as Effect from "effect/Effect";
import { type ProviderDescriptor } from "./Provider.js";
import { ReleaseError } from "./internal/Error.js";
import { Operation, Plan } from "./internal/ReleaseModel.js";
export declare const createOperation: (provider: ProviderDescriptor, intent: unknown, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, ReleaseError, never>;
export declare const validateDag: (operations: ReadonlyArray<Operation>) => void;
export declare const planValue: (bundleId: string, operations: ReadonlyArray<Operation>) => {
    format: "ts-release/plan/1";
    bundleId: string;
    operations: Operation[];
};
export declare const createPlan: (bundleId: string, operations: readonly Operation[], journalId?: string | undefined) => Effect.Effect<Plan, ReleaseError, never>;
export declare const createPreparationScope: (provider: ProviderDescriptor, input: unknown, journalId?: string | undefined) => Effect.Effect<{
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
}, ReleaseError, never>;
export declare const loadPlan: (input: unknown, providers: readonly ProviderDescriptor[]) => Effect.Effect<Plan, ReleaseError, never>;
