/** Admission only; evaluation of Python environment markers belongs to pip.
 * Grammar: PyPA dependency-specifiers. Range semantics: pinned PEP440 parser,
 * with native packaging's stricter release-only wildcard rule. */
export declare const specifiers: (value: string) => void;
export declare const requirement: (value: string) => void;
