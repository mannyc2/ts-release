export const unsupportedExecutionHost = (platform: string): string | undefined =>
  platform === "linux"
    ? undefined
    : "ts-release is currently certified to run on Linux. Its Bun builder can cross-compile the advertised macOS artifacts."
