/**
 * Container-level audio extraction for ISO BMFF (mp4 / mov / m4v / 3gp).
 *
 * Only the `moov` box is read into memory. The first `soun` trak is kept
 * verbatim; the only table rewritten is its chunk offsets (`stco` / `co64`).
 * The output is `Blob([ftyp, moov, mdatHeader, ...source.slice(chunk)])`, so
 * every audio chunk is a slice reference into the source: nothing is decoded,
 * re-encoded, or copied into memory. `mvhd.duration` is set to the audio
 * track's own duration so the movie does not claim the (possibly longer)
 * video's length.
 *
 * Any input this cannot handle exactly returns `null` — the caller uploads the
 * original file instead. Never throws for a malformed input.
 */

export interface RemuxResult {
  readonly blob: Blob;
  /** `<base>.m4a`. */
  readonly name: string;
  readonly contentType: "audio/mp4";
  /** Sample-entry fourcc of the kept track, e.g. `mp4a`. */
  readonly codec: string;
  /** Presentation duration of the audio track (edit list honoured). */
  readonly durationSeconds: number;
  /** Size of the source file. */
  readonly originalBytes: number;
}

const MAX_MOOV_BYTES = 64 * 1024 * 1024;
const ALLOWED_ENTRIES = new Set(["mp4a", "alac", "ac-3", "ec-3", "Opus", "fLaC", "sawb", "samr"]);
/** Top-level boxes a plain (non-fragmented) ISO BMFF file may open with. */
const LEADING_BOXES = new Set(["ftyp", "moov", "mdat", "free", "skip", "wide", "pnot"]);
/** Boxes that are containers on the path trak → stbl. */
const CONTAINERS = new Set(["trak", "mdia", "minf", "stbl"]);
const U32 = 0x1_0000_0000;

class Unsupported extends Error {}

function fail(why: string): never {
  throw new Unsupported(why);
}

interface BoxRef {
  readonly type: string;
  /** Absolute offset of the box header. */
  readonly start: number;
  readonly headerSize: number;
  /** Total box size including the header. */
  readonly size: number;
}

function fourcc(v: DataView, at: number): string {
  return String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
}

function u64(v: DataView, at: number): number {
  const n = v.getUint32(at) * U32 + v.getUint32(at + 4);
  if (!Number.isSafeInteger(n)) fail("64-bit value out of range");
  return n;
}

/** Iterate the boxes of `[from, to)` inside an in-memory buffer. */
function childBoxes(v: DataView, from: number, to: number): BoxRef[] {
  const out: BoxRef[] = [];
  let at = from;
  while (at < to) {
    if (to - at < 8) fail("truncated box header");
    let size = v.getUint32(at);
    const type = fourcc(v, at + 4);
    let headerSize = 8;
    if (size === 1) {
      if (to - at < 16) fail("truncated largesize");
      size = u64(v, at + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < headerSize || at + size > to) fail(`bad size for ${type}`);
    out.push({ type, start: at, headerSize, size });
    at += size;
  }
  return out;
}

/** Walk the top-level boxes of the file reading only their headers. */
async function topLevelBoxes(file: Blob): Promise<BoxRef[]> {
  const out: BoxRef[] = [];
  let at = 0;
  const total = file.size;
  while (at < total) {
    if (total - at < 8) fail("truncated top-level header");
    const head = new DataView(await file.slice(at, Math.min(at + 16, total)).arrayBuffer());
    let size = head.getUint32(0);
    const type = fourcc(head, 4);
    let headerSize = 8;
    if (size === 1) {
      if (head.byteLength < 16) fail("truncated largesize");
      size = u64(head, 8);
      headerSize = 16;
    } else if (size === 0) {
      size = total - at;
    }
    if (size < headerSize || at + size > total) fail(`bad top-level size for ${type}`);
    out.push({ type, start: at, headerSize, size });
    at += size;
  }
  return out;
}

/** One node of the rebuilt trak tree: either raw bytes or a container. */
type Node =
  | { readonly kind: "raw"; readonly type: string; readonly bytes: Uint8Array }
  | { readonly kind: "box"; readonly type: string; readonly children: Node[] };

function toTree(buf: Uint8Array, v: DataView, box: BoxRef): Node {
  if (!CONTAINERS.has(box.type)) {
    return { kind: "raw", type: box.type, bytes: buf.subarray(box.start, box.start + box.size) };
  }
  const children = childBoxes(v, box.start + box.headerSize, box.start + box.size).map((c) =>
    toTree(buf, v, c)
  );
  return { kind: "box", type: box.type, children };
}

function find(node: Node, type: string): Node | undefined {
  return node.kind === "box" ? node.children.find((c) => c.type === type) : undefined;
}

function raw(node: Node | undefined, type: string): Uint8Array {
  const c = node && find(node, type);
  if (!c || c.kind !== "raw") fail(`missing ${type}`);
  return c.bytes;
}

function view(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function nodeSize(n: Node): number {
  return n.kind === "raw" ? n.bytes.byteLength : 8 + n.children.reduce((s, c) => s + nodeSize(c), 0);
}

function writeNode(n: Node, out: Uint8Array, at: number): number {
  if (n.kind === "raw") {
    out.set(n.bytes, at);
    return at + n.bytes.byteLength;
  }
  const size = nodeSize(n);
  const v = view(out);
  v.setUint32(at, size);
  for (let i = 0; i < 4; i++) out[at + 4 + i] = n.type.charCodeAt(i);
  let p = at + 8;
  for (const c of n.children) p = writeNode(c, out, p);
  return p;
}

/** Swap the stbl's chunk-offset box (whichever of stco/co64 it holds). */
function replaceOffsets(stbl: Node, replacement: Node): void {
  if (stbl.kind !== "box") fail("not a container");
  const i = stbl.children.findIndex((c) => c.type === "stco" || c.type === "co64");
  if (i < 0) fail("missing chunk offsets");
  stbl.children[i] = replacement;
}

interface AudioTrack {
  readonly trak: Node;
  readonly stbl: Node;
  readonly offsetType: "stco" | "co64";
  readonly codec: string;
  readonly chunks: ReadonlyArray<readonly [number, number]>;
  readonly tkhdDuration: number;
  readonly mdhdTimescale: number;
  readonly mdhdDuration: number;
}

function handlerType(mdia: Node): string {
  const hdlr = raw(mdia, "hdlr");
  if (hdlr.byteLength < 20) fail("short hdlr");
  return fourcc(view(hdlr), 16);
}

function readAudioTrack(trak: Node, fileSize: number): AudioTrack {
  const mdia = find(trak, "mdia");
  if (!mdia) fail("trak without mdia");
  const minf = find(mdia, "minf");
  const stbl = minf && find(minf, "stbl");
  if (!stbl) fail("trak without stbl");

  const tkhd = view(raw(trak, "tkhd"));
  const tkhdDuration = tkhd.getUint8(8) === 1 ? u64(tkhd, 8 + 4 + 8 + 8 + 4 + 4) : tkhd.getUint32(8 + 4 + 4 + 4 + 4 + 4);
  const mdhd = view(raw(mdia, "mdhd"));
  const v1 = mdhd.getUint8(8) === 1;
  const mdhdTimescale = mdhd.getUint32(v1 ? 8 + 4 + 16 : 8 + 4 + 8);
  const mdhdDuration = v1 ? u64(mdhd, 8 + 4 + 16 + 4) : mdhd.getUint32(8 + 4 + 8 + 4);

  if (find(stbl, "stz2")) fail("stz2 is not supported");

  // Sample descriptions: every entry must be an allowed audio codec.
  const stsd = view(raw(stbl, "stsd"));
  const entryCount = stsd.getUint32(12);
  if (entryCount < 1) fail("empty stsd");
  let codec = "";
  let soundVersion = 0;
  let p = 16;
  for (let i = 0; i < entryCount; i++) {
    if (p + 8 > stsd.byteLength) fail("truncated stsd");
    const size = stsd.getUint32(p);
    const type = fourcc(stsd, p + 4);
    if (!ALLOWED_ENTRIES.has(type)) fail(`unsupported sample entry ${type}`);
    if (size < 8 || p + size > stsd.byteLength) fail("bad stsd entry size");
    if (i === 0) {
      codec = type;
      if (size >= 18) soundVersion = stsd.getUint16(p + 16);
    }
    p += size;
  }

  // Sample sizes.
  const stsz = view(raw(stbl, "stsz"));
  const constSize = stsz.getUint32(12);
  const sampleCount = stsz.getUint32(16);
  if (constSize === 0 && stsz.byteLength < 20 + 4 * sampleCount) fail("truncated stsz");
  // A QuickTime v1/v2 sound description with a constant sample size counts
  // samples, not packets: byte sizes cannot be derived from stsz alone.
  if (constSize !== 0 && soundVersion !== 0) fail("QuickTime constant-size sound description");
  const sampleSize = (i: number): number => (constSize !== 0 ? constSize : stsz.getUint32(20 + 4 * i));

  // Chunk offsets.
  const co64Bytes = stbl.kind === "box" ? stbl.children.find((c) => c.type === "co64") : undefined;
  const offsetType: "stco" | "co64" = co64Bytes ? "co64" : "stco";
  const co = view(raw(stbl, offsetType));
  const chunkCount = co.getUint32(12);
  const width = offsetType === "co64" ? 8 : 4;
  if (co.byteLength < 16 + width * chunkCount) fail("truncated chunk offsets");
  const chunkOffset = (i: number): number =>
    offsetType === "co64" ? u64(co, 16 + 8 * i) : co.getUint32(16 + 4 * i);

  // Sample-to-chunk.
  const stsc = view(raw(stbl, "stsc"));
  const stscCount = stsc.getUint32(12);
  if (stsc.byteLength < 16 + 12 * stscCount) fail("truncated stsc");
  if (chunkCount > 0 && stscCount === 0) fail("empty stsc");

  const chunks: Array<readonly [number, number]> = [];
  let sample = 0;
  for (let e = 0; e < stscCount; e++) {
    const first = stsc.getUint32(16 + 12 * e);
    const perChunk = stsc.getUint32(16 + 12 * e + 4);
    const next = e + 1 < stscCount ? stsc.getUint32(16 + 12 * (e + 1)) : chunkCount + 1;
    if (first < 1 || next <= first || next > chunkCount + 1) fail("bad stsc run");
    if (e === 0 && first !== 1) fail("stsc does not start at chunk 1");
    for (let c = first; c < next; c++) {
      if (sample + perChunk > sampleCount) fail("stsc runs past the sample count");
      let bytes = 0;
      for (let s = 0; s < perChunk; s++) bytes += sampleSize(sample + s);
      sample += perChunk;
      const start = chunkOffset(c - 1);
      if (start + bytes > fileSize) fail("chunk outside the file");
      chunks.push([start, bytes]);
    }
  }
  if (chunks.length !== chunkCount || sample !== sampleCount) fail("chunk/sample tables disagree");

  return { trak, stbl, offsetType, codec, chunks, tkhdDuration, mdhdTimescale, mdhdDuration };
}

function offsetsBox(type: "stco" | "co64", offsets: readonly number[]): Node {
  const width = type === "co64" ? 8 : 4;
  const bytes = new Uint8Array(16 + width * offsets.length);
  const v = view(bytes);
  v.setUint32(0, bytes.byteLength);
  for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
  v.setUint32(12, offsets.length);
  offsets.forEach((o, i) => {
    if (type === "co64") {
      v.setUint32(16 + 8 * i, Math.floor(o / U32));
      v.setUint32(16 + 8 * i + 4, o % U32);
    } else {
      v.setUint32(16 + 4 * i, o);
    }
  });
  return { kind: "raw", type, bytes };
}

function buildFtyp(): Uint8Array<ArrayBuffer> {
  const brands = ["M4A ", "isom", "iso2", "mp41"];
  const bytes = new Uint8Array(16 + 4 * brands.length);
  const v = view(bytes);
  v.setUint32(0, bytes.byteLength);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < 4; i++) bytes[at + i] = s.charCodeAt(i);
  };
  put(4, "ftyp");
  put(8, "M4A ");
  v.setUint32(12, 0x200);
  brands.forEach((b, i) => put(16 + 4 * i, b));
  return bytes;
}

function baseName(name: string | undefined): string {
  const n = (name ?? "").split(/[\\/]/).pop() ?? "";
  const dot = n.lastIndexOf(".");
  const base = dot > 0 ? n.slice(0, dot) : n;
  return base || "audio";
}

async function remux(file: Blob & { name?: string }): Promise<RemuxResult> {
  const top = await topLevelBoxes(file);
  const first = top[0];
  if (!first || !LEADING_BOXES.has(first.type)) fail("not ISO BMFF");
  if (top.some((b) => b.type === "moof" || b.type === "styp" || b.type === "sidx")) fail("fragmented");
  const moovRefs = top.filter((b) => b.type === "moov");
  const moovRef = moovRefs[0];
  if (moovRefs.length !== 1 || !moovRef) fail("expected exactly one moov");
  if (moovRef.size > MAX_MOOV_BYTES) fail("moov too large");

  const buf = new Uint8Array(await file.slice(moovRef.start, moovRef.start + moovRef.size).arrayBuffer());
  const v = view(buf);
  const moovChildren = childBoxes(v, moovRef.headerSize, moovRef.size);
  if (moovChildren.some((c) => c.type === "mvex")) fail("fragmented (mvex)");
  const mvhdRef = moovChildren.find((c) => c.type === "mvhd");
  if (!mvhdRef) fail("missing mvhd");

  let track: AudioTrack | undefined;
  for (const ref of moovChildren) {
    if (ref.type !== "trak") continue;
    const trak = toTree(buf, v, ref);
    const mdia = find(trak, "mdia");
    if (!mdia || handlerType(mdia) !== "soun") continue;
    track = readAudioTrack(trak, file.size);
    break;
  }
  if (!track) fail("no audio track");
  if (track.chunks.length === 0) fail("audio track has no samples");

  // mvhd copied, with its duration set to the audio track's.
  const mvhd = buf.slice(mvhdRef.start, mvhdRef.start + mvhdRef.size);
  const mv = view(mvhd);
  const mvV1 = mv.getUint8(8) === 1;
  const movieTimescale = mv.getUint32(mvV1 ? 8 + 4 + 16 : 8 + 4 + 8);
  if (mvV1) {
    mv.setUint32(8 + 4 + 16 + 4, Math.floor(track.tkhdDuration / U32));
    mv.setUint32(8 + 4 + 16 + 8, track.tkhdDuration % U32);
  } else {
    if (track.tkhdDuration >= U32) fail("duration overflow");
    mv.setUint32(8 + 4 + 8 + 4, track.tkhdDuration);
  }

  const ftyp = buildFtyp();
  const audioBytes = track.chunks.reduce((s, [, n]) => s + n, 0);
  const mdatHeaderSize = audioBytes + 8 < U32 ? 8 : 16;
  const layout = (type: "stco" | "co64"): { moovSize: number; base: number } => {
    replaceOffsets(track.stbl, offsetsBox(type, track.chunks.map(() => 0)));
    const moovSize = 8 + mvhd.byteLength + nodeSize(track.trak);
    return { moovSize, base: ftyp.byteLength + moovSize + mdatHeaderSize };
  };
  let offsetType: "stco" | "co64" = "stco";
  let { base } = layout("stco");
  if (base + audioBytes >= U32) {
    offsetType = "co64";
    ({ base } = layout("co64"));
  }
  const offsets: number[] = [];
  let cursor = base;
  for (const [, n] of track.chunks) {
    offsets.push(cursor);
    cursor += n;
  }
  replaceOffsets(track.stbl, offsetsBox(offsetType, offsets));
  const moovSize = 8 + mvhd.byteLength + nodeSize(track.trak);
  const moov = new Uint8Array(moovSize);
  view(moov).setUint32(0, moovSize);
  moov.set([0x6d, 0x6f, 0x6f, 0x76], 4);
  moov.set(mvhd, 8);
  writeNode(track.trak, moov, 8 + mvhd.byteLength);

  const mdatHeader = new Uint8Array(mdatHeaderSize);
  const mh = view(mdatHeader);
  if (mdatHeaderSize === 8) {
    mh.setUint32(0, audioBytes + 8);
  } else {
    mh.setUint32(0, 1);
    mh.setUint32(8, Math.floor((audioBytes + 16) / U32));
    mh.setUint32(12, (audioBytes + 16) % U32);
  }
  mdatHeader.set([0x6d, 0x64, 0x61, 0x74], 4);

  // Adjacent chunks become one slice.
  const slices: Blob[] = [];
  let runStart = -1;
  let runEnd = -1;
  for (const [start, n] of track.chunks) {
    if (start === runEnd) {
      runEnd += n;
      continue;
    }
    if (runStart >= 0) slices.push(file.slice(runStart, runEnd));
    runStart = start;
    runEnd = start + n;
  }
  if (runStart >= 0) slices.push(file.slice(runStart, runEnd));

  const blob = new Blob([ftyp, moov, mdatHeader, ...slices], { type: "audio/mp4" });
  const durationSeconds =
    track.tkhdDuration > 0 && movieTimescale > 0
      ? track.tkhdDuration / movieTimescale
      : track.mdhdTimescale > 0
        ? track.mdhdDuration / track.mdhdTimescale
        : 0;
  return {
    blob,
    name: `${baseName(file.name)}.m4a`,
    contentType: "audio/mp4",
    codec: track.codec,
    durationSeconds,
    originalBytes: file.size,
  };
}

/**
 * Extract the first audio track of an ISO BMFF file as a standalone `.m4a`
 * without decoding. `null` when the input is not something this can do
 * exactly — upload the original then.
 */
export async function extractAudioTrack(
  file: Blob & { readonly name?: string }
): Promise<RemuxResult | null> {
  try {
    return await remux(file);
  } catch {
    // Unsupported layout, or a parse surprise (RangeError from a DataView
    // read past a truncated box): either way, the original is uploaded.
    return null;
  }
}
