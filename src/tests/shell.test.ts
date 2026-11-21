import { describe, it, expect } from "vitest";
import { buildCommand, quoteCmd, quotePosix } from "../core/shell.js";

describe("buildCommand", () => {
  it("passes a single argument through as a shell string", () => {
    expect(buildCommand(["npm test && npm run build"], "linux")).toBe("npm test && npm run build");
    expect(buildCommand(["npm test && npm run build"], "win32")).toBe("npm test && npm run build");
  });

  it("keeps arguments with spaces together (POSIX)", () => {
    expect(buildCommand(["echo", "a b"], "linux")).toBe("echo 'a b'");
    expect(buildCommand(["npm", "run", "build"], "linux")).toBe("npm run build");
  });

  it("keeps arguments with spaces together (Windows)", () => {
    expect(buildCommand(["echo", "a b"], "win32")).toBe('echo "a b"');
    expect(buildCommand(["node", "-e", "a&&b"], "win32")).toBe('node -e "a&&b"');
  });
});

describe("quoting", () => {
  it("escapes single quotes for POSIX shells", () => {
    expect(quotePosix("it's")).toBe("'it'\\''s'");
    expect(quotePosix("")).toBe("''");
  });

  it("escapes double quotes for cmd.exe", () => {
    expect(quoteCmd('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteCmd("")).toBe('""');
  });
});
