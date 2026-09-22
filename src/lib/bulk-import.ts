export function parseBulkImport(text: string): { title: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ title: line }));
}
