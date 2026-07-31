export type CatalogCheckboxPolicy = "preserve" | "check"

export const applyCatalogCheckboxPolicy = (
  content: string,
  policy: CatalogCheckboxPolicy
): string => policy === "preserve"
  ? content
  : content.split("\n").map((line) =>
      line.replace(/^(\s*-\s*)\[ \]/u, "$1[x]")
    ).join("\n")
