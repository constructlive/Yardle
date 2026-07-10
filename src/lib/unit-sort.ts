export function unitReferenceSortKey(reference: string) {
  const value = reference.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/");
  const numeric = value.match(/^(\d+(?:\.\d+)?)([A-Za-z]*)/);
  if (!numeric) {
    return { numeric: false, firstNumber: Number.POSITIVE_INFINITY, suffix: "", text: value.toUpperCase() };
  }
  return { numeric: true, firstNumber: Number(numeric[1]), suffix: numeric[2].toUpperCase(), text: value.toUpperCase() };
}

export function compareUnitReferences(left: string, right: string) {
  const a = unitReferenceSortKey(left);
  const b = unitReferenceSortKey(right);
  if (a.numeric !== b.numeric) return a.numeric ? -1 : 1;
  if (a.numeric && b.numeric) {
    if (a.firstNumber !== b.firstNumber) return a.firstNumber - b.firstNumber;
    if (a.suffix !== b.suffix) {
      if (!a.suffix) return -1;
      if (!b.suffix) return 1;
      return a.suffix.localeCompare(b.suffix, undefined, { numeric: true, sensitivity: "base" });
    }
  }
  return a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" });
}