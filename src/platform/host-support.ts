export const unsupportedExecutionHost = (platform: string): string | undefined =>
  platform === "linux" || platform === "darwin"
    ? undefined
    : "ts-release runs on Linux and macOS. Its Bun builder can produce Windows artifacts."
