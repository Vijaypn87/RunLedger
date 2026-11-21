/** True for a UTF-8 continuation byte (0b10xxxxxx). */
function isContinuation(b: number | undefined): boolean {
  return b !== undefined && (b & 0xc0) === 0x80;
}

/** First `max` bytes of `buf`, cut back so no multi-byte character is split. */
export function utf8Head(buf: Buffer, max: number): string {
  if (buf.length <= max) return buf.toString("utf8");
  let end = max;
  while (end > 0 && isContinuation(buf[end])) end--;
  return buf.subarray(0, end).toString("utf8");
}

/** Last `max` bytes of `buf`, moved forward so no multi-byte character is split. */
export function utf8Tail(buf: Buffer, max: number): string {
  if (buf.length <= max) return buf.toString("utf8");
  let start = buf.length - max;
  while (start < buf.length && isContinuation(buf[start])) start++;
  return buf.subarray(start).toString("utf8");
}
