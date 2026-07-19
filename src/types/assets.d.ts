// Invariant: imported authored assets are compile-time strings and carry no executable TypeScript behavior.
declare module "*.py" {
  const contents: string
  export default contents
}
