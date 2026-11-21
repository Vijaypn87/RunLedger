import { describe, it, expect } from "vitest";
import { utf8Head, utf8Tail } from "../core/bytes.js";

describe("utf8Head / utf8Tail", () => {
  const buf = Buffer.from("aé€b", "utf8"); // 1 + 2 + 3 + 1 = 7 bytes

  it("never splits a multi-byte character", () => {
    expect(utf8Head(buf, 2)).toBe("a"); // would cut inside "é"
    expect(utf8Head(buf, 4)).toBe("aé"); // would cut inside "€"
    expect(utf8Tail(buf, 3)).toBe("b"); // would start inside "€"
    expect(utf8Tail(buf, 4)).toBe("€b");
    for (let n = 0; n <= 7; n++) {
      expect(utf8Head(buf, n)).not.toContain("�");
      expect(utf8Tail(buf, n)).not.toContain("�");
    }
  });

  it("returns the whole buffer when it fits", () => {
    expect(utf8Head(buf, 10)).toBe("aé€b");
    expect(utf8Tail(buf, 10)).toBe("aé€b");
  });
});
