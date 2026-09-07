import * as Schema from "effect/Schema";
import { File } from "@mannyc1/ts-release/bundle";
export declare const text: Schema.NonEmptyString;
export declare const project: Schema.NonEmptyString;
export declare const normalizeProject: (name: string) => string;
export declare const version: Schema.NonEmptyString;
export declare const metadataVersion: Schema.Literals<readonly ["1.0", "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]>;
export declare const filename: Schema.NonEmptyString;
declare const PyPi_base: Schema.Class<PyPi, Schema.TaggedStruct<"PyPi", {
    readonly uploadUrl: Schema.Literal<"https://upload.pypi.org/legacy/">;
    readonly simpleUrl: Schema.Literal<"https://pypi.org/simple/">;
}>, {}>;
export declare class PyPi extends PyPi_base {
}
declare const TestPyPi_base: Schema.Class<TestPyPi, Schema.TaggedStruct<"TestPyPi", {
    readonly uploadUrl: Schema.Literal<"https://test.pypi.org/legacy/">;
    readonly simpleUrl: Schema.Literal<"https://test.pypi.org/simple/">;
}>, {}>;
export declare class TestPyPi extends TestPyPi_base {
}
declare const Compatible_base: Schema.Class<Compatible, Schema.TaggedStruct<"Compatible", {
    readonly implementation: Schema.Literals<readonly ["pypiserver", "devpi-server"]>;
    readonly version: Schema.NonEmptyString;
    readonly uploadUrl: Schema.NonEmptyString;
    readonly simpleUrl: Schema.NonEmptyString;
    readonly duplicateLaw: Schema.Literal<"not-inherited">;
}>, {}>;
export declare class Compatible extends Compatible_base {
}
export declare const Endpoint: Schema.Union<readonly [typeof PyPi, typeof TestPyPi, typeof Compatible]>;
export type Endpoint = typeof Endpoint.Type;
declare const TokenAuthorization_base: Schema.Class<TokenAuthorization, Schema.TaggedStruct<"TokenAuthorization", {
    readonly principal: Schema.NonEmptyString;
    readonly username: Schema.NonEmptyString;
}>, {}>;
export declare class TokenAuthorization extends TokenAuthorization_base {
}
declare const TrustedAuthorization_base: Schema.Class<TrustedAuthorization, Schema.TaggedStruct<"TrustedAuthorization", {
    readonly principal: Schema.NonEmptyString;
    readonly projects: Schema.$Array<Schema.NonEmptyString>;
    readonly repository: Schema.NonEmptyString;
    readonly workflow: Schema.NonEmptyString;
    readonly workflowRef: Schema.NonEmptyString;
    readonly issuer: Schema.Literal<"https://token.actions.githubusercontent.com">;
    readonly audience: Schema.Literals<readonly ["pypi", "testpypi"]>;
}>, {}>;
export declare class TrustedAuthorization extends TrustedAuthorization_base {
}
export declare const Authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
export type Authorization = typeof Authorization.Type;
declare const WheelUpload_base: Schema.Class<WheelUpload, Schema.TaggedStruct<"WheelUpload", {
    readonly pythonTag: Schema.NonEmptyString;
    readonly endpoint: Schema.Union<readonly [typeof PyPi, typeof TestPyPi, typeof Compatible]>;
    readonly project: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly metadataVersion: Schema.Literals<readonly ["1.0", "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]>;
    readonly distribution: typeof File;
    readonly filename: Schema.NonEmptyString;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
}>, {}>;
export declare class WheelUpload extends WheelUpload_base {
}
declare const SdistUpload_base: Schema.Class<SdistUpload, Schema.TaggedStruct<"SdistUpload", {
    readonly pythonTag: Schema.Literal<"source">;
    readonly endpoint: Schema.Union<readonly [typeof PyPi, typeof TestPyPi, typeof Compatible]>;
    readonly project: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly metadataVersion: Schema.Literals<readonly ["1.0", "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]>;
    readonly distribution: typeof File;
    readonly filename: Schema.NonEmptyString;
    readonly authorization: Schema.Union<readonly [typeof TokenAuthorization, typeof TrustedAuthorization]>;
}>, {}>;
export declare class SdistUpload extends SdistUpload_base {
}
export declare const UploadIntent: Schema.Union<readonly [typeof WheelUpload, typeof SdistUpload]>;
export type UploadIntent = typeof UploadIntent.Type;
declare const DistributionMetadata_base: Schema.Class<DistributionMetadata, Schema.Struct<{
    readonly kind: Schema.Literals<readonly ["wheel", "sdist"]>;
    readonly project: Schema.NonEmptyString;
    readonly version: Schema.NonEmptyString;
    readonly metadataVersion: Schema.Literals<readonly ["1.0", "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]>;
    readonly pythonTag: Schema.NonEmptyString;
    readonly filename: Schema.NonEmptyString;
}>, {}>;
export declare class DistributionMetadata extends DistributionMetadata_base {
}
export {};
