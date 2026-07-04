/**
 * Serialize a value to a JSON string that is safe to embed inside an inline
 * <script> tag. Escapes characters that could break out of the script context
 * or the surrounding HTML comment/script-close sequences, plus the JS line
 * separators U+2028 / U+2029 which are valid in JSON but illegal in JS source.
 */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
