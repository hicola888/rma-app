const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/** Stop Excel from treating an exported cell as a formula. */
export function escapeFormula(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix)) ? `'${value}` : value;
}
