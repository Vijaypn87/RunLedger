/**
 * Build the shell command string for `runledger run -- <args...>`.
 *
 * - One argument is passed to the shell as-is, so a quoted pipeline such as
 *   `runledger run -- "npm test && npm run build"` keeps its shell meaning.
 * - Several arguments are each quoted where needed, so an argument the user's
 *   own shell already unquoted (`echo "a b"` -> ["echo", "a b"]) stays one
 *   argument instead of being split again.
 */
export function buildCommand(args: string[], platform: NodeJS.Platform = process.platform): string {
  if (args.length === 1) return args[0]!;
  const quote = platform === "win32" ? quoteCmd : quotePosix;
  return args.map(quote).join(" ");
}

export function quotePosix(arg: string): string {
  if (arg !== "" && /^[A-Za-z0-9_\-+=.,/:@%^]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function quoteCmd(arg: string): string {
  if (arg !== "" && !/[\s"&|<>^()!]/.test(arg)) return arg;
  // Inside double quotes cmd.exe treats & | < > ^ ( ) literally; programs
  // using the standard Windows argv parser read \" as a literal quote.
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
}
