import * as Notary from "effect-build-apple/Notary";
import { type ProviderDefinition } from "../Provider.js";
import { ApplePreparation } from "./Model.js";
export declare const sourceCorresponds: (input: ApplePreparation, result: Notary.SubmissionReference) => boolean;
export declare const classifyEvidence: (input: ApplePreparation, operationId: string, value: unknown, receipts: readonly unknown[]) => "Pending" | "Satisfied" | "Conflict";
export declare const preparationProvider: ProviderDefinition;
