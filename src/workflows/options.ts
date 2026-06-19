export interface ReleaseConfigFields {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
}

export interface ReleaseFormatField<Format extends string> {
  readonly format?: Format | undefined
}

export interface ReleaseExecutionFields extends ReleaseConfigFields {
  readonly execute?: boolean | undefined
  readonly approveIrreversible?: boolean | undefined
}

export const releaseConfigFields = (
  input: ReleaseConfigFields
) => ({
  ...(input.root === undefined ? {} : { root: input.root }),
  ...(input.configPath === undefined ? {} : { configPath: input.configPath })
})

export const releaseFormatField = <Format extends string>(
  input: ReleaseFormatField<Format>
) => ({
  ...(input.format === undefined ? {} : { format: input.format })
})

export const releaseExecuteField = (
  input: { readonly execute?: boolean | undefined }
) => ({
  ...(input.execute === undefined ? {} : { execute: input.execute })
})

export const releaseExecutionFields = (
  input: ReleaseExecutionFields
) => ({
  ...releaseConfigFields(input),
  ...releaseExecuteField(input),
  ...(input.approveIrreversible === undefined ? {} : { approveIrreversible: input.approveIrreversible })
})
