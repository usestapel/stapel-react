import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "../src/editors/csv.js";

describe("parseCsv", () => {
  it("parses plain rows and cells", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("parses quoted fields with commas, quotes, and newlines", () => {
    expect(parseCsv('"a,1","say ""hi""","line\nbreak"')).toEqual([
      ["a,1", 'say "hi"', "line\nbreak"],
    ]);
  });

  it("tolerates CRLF and a trailing newline without a phantom row", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps empty cells", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("empty text is an empty grid", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("serializeCsv", () => {
  it("quotes only what needs quoting", () => {
    expect(
      serializeCsv([
        ["plain", "a,1", 'say "hi"', "line\nbreak"],
      ])
    ).toBe('plain,"a,1","say ""hi""","line\nbreak"');
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["a", "b,1", 'q"q'],
      ["", "line\nbreak", "z"],
    ];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
  });
});
