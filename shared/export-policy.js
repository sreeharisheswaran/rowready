export function isFormulaRisk(value) {
  return /^[\t\r\n]/u.test(value) || /^\s*[=+\-@＝＋－＠]/u.test(value);
}

export const spreadsheetValue = (value) => (isFormulaRisk(value) ? `'${value}` : value);
