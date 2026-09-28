// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fingerprintOf, hashParts } from "../src/upload/index.js";

const MiB = 1024 * 1024;

function patterned(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i * 7 + 3) & 0xff;
  return out;
}

/** `abcd…wxyz` style truncation used by the contract's vectors. */
const short = (h: string): string => `${h.slice(0, 8)}…${h.slice(-4)}`;

describe("fingerprint v1 — contract test vectors", () => {
  it('b"abc", P=2', async () => {
    const r = await hashParts(new Blob([new TextEncoder().encode("abc")]), 2);
    expect(r.fingerprint).toBe("8c4efddc2b77fce99702c6c9d161847e1fee33254038bd4f2239c0d3b2789d83");
    expect(r.partHashes).toEqual([
      "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
      "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6",
    ]);
    expect(await fingerprintOf(3, 2, r.partHashes)).toBe(r.fingerprint);
  });

  it("(i*7+3)&0xFF for 2 MiB + 5 bytes, P=1 MiB", async () => {
    const r = await hashParts(new Blob([patterned(2 * MiB + 5)]), MiB);
    expect(r.fingerprint).toBe("9fa7f4afce224ad288277d5ded529f672341fc3e360d5d555cdf4f9c5df1eaba");
    expect(r.partHashes.map(short)).toEqual(["172c15dc…28fd", "172c15dc…28fd", "c0a7188b…4646"]);
  });

  it("empty input, P=4 (one empty part)", async () => {
    const r = await hashParts(new Blob([]), 4);
    expect(r.fingerprint).toBe("0bfd9fff69fdcfb5ac58acfb5054f1c485487dab1004940357d2036b9b713956");
    expect(r.partHashes).toEqual([
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ]);
  });

  it("fingerprintOf refuses a wrong number of hashes", async () => {
    await expect(fingerprintOf(3, 2, ["a".repeat(64)])).rejects.toThrow(RangeError);
  });
});

describe("hashParts memory: one part in memory at a time", () => {
  it("reads the blob part by part, never whole", async () => {
    const partSize = 256 * 1024;
    const blob = new Blob([patterned(10 * partSize + 17)]);
    const realSlice = blob.slice.bind(blob);
    // Bytes read from the source and not yet digested (released).
    let held = 0;
    let peakHeld = 0;
    const heldBuffers = new Set<ArrayBuffer>();
    const partReads: number[] = [];
    const sliceSpy = vi.spyOn(blob, "slice").mockImplementation((start, end) => {
      const part = realSlice(start, end);
      const realRead = part.arrayBuffer.bind(part);
      vi.spyOn(part, "arrayBuffer").mockImplementation(async () => {
        const buf = await realRead();
        partReads.push(buf.byteLength);
        heldBuffers.add(buf);
        held += buf.byteLength;
        peakHeld = Math.max(peakHeld, held);
        return buf;
      });
      return part;
    });
    const wholeSpy = vi.spyOn(blob, "arrayBuffer");
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const digestSpy = vi.spyOn(crypto.subtle, "digest").mockImplementation(async (alg, data) => {
      const out = await digest(alg, data);
      if (data instanceof ArrayBuffer && heldBuffers.delete(data)) held -= data.byteLength;
      return out;
    });
    const progress: number[] = [];
    try {
      await hashParts(blob, partSize, { onProgress: (done) => progress.push(done) });
    } finally {
      digestSpy.mockRestore();
    }
    expect(wholeSpy).not.toHaveBeenCalled();
    expect(sliceSpy).toHaveBeenCalledTimes(11);
    for (const [i, call] of sliceSpy.mock.calls.entries()) {
      const [start, end] = call as [number, number];
      expect(start).toBe(i * partSize);
      expect(end - start).toBeLessThanOrEqual(partSize);
    }
    expect(partReads).toHaveLength(11);
    // Never more than one part's bytes read and not yet hashed.
    expect(peakHeld).toBeLessThanOrEqual(partSize);
    expect(held).toBe(0);
    expect(progress.at(-1)).toBe(blob.size);
    expect(progress).toHaveLength(11);
  });

  it("honours an abort signal between parts", async () => {
    const ctl = new AbortController();
    const blob = new Blob([patterned(4096)]);
    const p = hashParts(blob, 1024, {
      signal: ctl.signal,
      onProgress: (done) => {
        if (done >= 2048) ctl.abort();
      },
    });
    await expect(p).rejects.toBeDefined();
  });
});
