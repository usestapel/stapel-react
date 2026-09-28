/**
 * Container-level audio extraction for ISO BMFF (mp4 / mov / m4v / 3gp).
 * The chosen track is kept as it is: no decode, no downmix, no re-encode —
 * the backend normalizes.
 *
 * Only the `moov` box is read into memory. The chosen `soun` trak (default: the first) is kept
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
  /** Channel count, unchanged from the source (no downmix). */
  readonly channels: number;
  readonly sampleRate: number;
  /** Which audio track was kept (`AudioTrackInfo.index`). */
  readonly trackIndex: number;
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

/** One audio track as `listAudioTracks` reports it. */
export interface AudioTrackInfo {
  /** 0-based among the file's audio tracks; pass it as `trackIndex`. */
  readonly index: number;
  /** Sample-entry fourcc, e.g. `mp4a`, `Opus`, `ac-3`. */
  readonly codec: string;
  readonly channels: number;
  readonly sampleRate: number;
  /** ISO 639-2/T code from `mdhd`, when set (`und` is omitted). */
  readonly language?: string;
  /** The track's handler name, when it carries a non-default one. */
  readonly name?: string;
  readonly durationSeconds: number;
  /** `tkhd` enabled flag. */
  readonly enabled: boolean;
  /** Whether `extractAudioTrack` can remux this track (else: upload whole). */
  readonly remuxable: boolean;
}

export interface ExtractAudioOptions {
  /** Which audio track (`AudioTrackInfo.index`). Default 0, the first. */
  readonly trackIndex?: number;
}

const GENERIC_HANDLER_NAMES = new Set(["", "SoundHandler", "Core Media Audio", "Sound Media Handler"]);

interface Movie {
  readonly mvhd: Uint8Array;
  readonly movieTimescale: number;
  readonly audio: ReadonlyArray<{ readonly info: AudioTrackInfo; readonly track: AudioTrack | null }>;
}

function describeTrack(
  trak: Node,
  mdia: Node,
  index: number,
  movieTimescale: number,
  track: AudioTrack | null
): AudioTrackInfo {
  const tkhd = view(raw(trak, "tkhd"));
  const enabled = (tkhd.getUint32(8) & 1) === 1;
  const tkhdDuration = tkhd.getUint8(8) === 1 ? u64(tkhd, 36) : tkhd.getUint32(28);
  const mdhd = view(raw(mdia, "mdhd"));
  const v1 = mdhd.getUint8(8) === 1;
  const mdhdTimescale = mdhd.getUint32(v1 ? 28 : 20);
  const mdhdDuration = v1 ? u64(mdhd, 32) : mdhd.getUint32(24);
  const langBits = mdhd.getUint16(v1 ? 40 : 28) & 0x7fff;
  const language = String.fromCharCode(
    ((langBits >> 10) & 0x1f) + 0x60,
    ((langBits >> 5) & 0x1f) + 0x60,
    (langBits & 0x1f) + 0x60
  );

  const hdlr = raw(mdia, "hdlr");
  let name = "";
  if (hdlr.byteLength > 32) {
    const bytes = hdlr.subarray(32);
    const end = bytes.indexOf(0);
    name = new TextDecoder().decode(end >= 0 ? bytes.subarray(0, end) : bytes).trim();
  }

  const minf = find(mdia, "minf");
  const stbl = minf && find(minf, "stbl");
  const stsd = view(raw(stbl, "stsd"));
  if (stsd.getUint32(12) < 1 || stsd.byteLength < 16 + 36) fail("empty stsd");
  const e = 16;
  const codec = fourcc(stsd, e + 4);
  const soundVersion = stsd.getUint16(e + 16);
  let channels = stsd.getUint16(e + 24);
  let sampleRate = stsd.getUint32(e + 32) / 65536;
  if (soundVersion === 2 && stsd.byteLength >= e + 52) {
    sampleRate = stsd.getFloat64(e + 40);
    channels = stsd.getUint32(e + 48);
  }
  if (!(sampleRate > 0) && mdhdTimescale > 0) sampleRate = mdhdTimescale;

  const durationSeconds =
    tkhdDuration > 0 && movieTimescale > 0
      ? tkhdDuration / movieTimescale
      : mdhdTimescale > 0
        ? mdhdDuration / mdhdTimescale
        : 0;
  return {
    index,
    codec,
    channels,
    sampleRate,
    ...(langBits !== 0 && language !== "und" && /^[a-z]{3}$/.test(language) ? { language } : {}),
    ...(GENERIC_HANDLER_NAMES.has(name) ? {} : { name }),
    durationSeconds,
    enabled,
    remuxable: track !== null && track.chunks.length > 0,
  };
}

async function readMovie(file: Blob): Promise<Movie> {
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
  const mvhd = buf.subarray(mvhdRef.start, mvhdRef.start + mvhdRef.size);
  const mv = view(mvhd);
  const movieTimescale = mv.getUint32(mv.getUint8(8) === 1 ? 28 : 20);

  const audio: Array<{ info: AudioTrackInfo; track: AudioTrack | null }> = [];
  for (const ref of moovChildren) {
    if (ref.type !== "trak") continue;
    const trak = toTree(buf, v, ref);
    const mdia = find(trak, "mdia");
    if (!mdia || handlerType(mdia) !== "soun") continue;
    let track: AudioTrack | null;
    try {
      track = readAudioTrack(trak, file.size);
    } catch {
      track = null; // listed, but uploaded whole if chosen
    }
    audio.push({ info: describeTrack(trak, mdia, audio.length, movieTimescale, track), track });
  }
  return { mvhd, movieTimescale, audio };
}

async function remux(
  file: Blob & { name?: string },
  trackIndex: number
): Promise<RemuxResult> {
  const movie = await readMovie(file);
  const chosen = movie.audio[trackIndex];
  if (!chosen) fail("no such audio track");
  const track = chosen.track;
  if (!track || !chosen.info.remuxable) fail("track cannot be remuxed");

  // mvhd copied, with its duration set to the audio track's.
  const mvhd = movie.mvhd.slice();
  const mv = view(mvhd);
  if (mv.getUint8(8) === 1) {
    mv.setUint32(32, Math.floor(track.tkhdDuration / U32));
    mv.setUint32(36, track.tkhdDuration % U32);
  } else {
    if (track.tkhdDuration >= U32) fail("duration overflow");
    mv.setUint32(24, track.tkhdDuration);
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
  return {
    blob,
    name: `${baseName(file.name)}.m4a`,
    contentType: "audio/mp4",
    codec: track.codec,
    channels: chosen.info.channels,
    sampleRate: chosen.info.sampleRate,
    trackIndex,
    durationSeconds: chosen.info.durationSeconds,
    originalBytes: file.size,
  };
}

/**
 * The file's audio tracks, for a picker when there is more than one. `null`
 * when the tracks cannot be listed (not ISO BMFF, fragmented, a parse
 * surprise) — upload the original then. `[]` means a movie with no audio.
 */
export async function listAudioTracks(
  file: Blob
): Promise<AudioTrackInfo[] | null> {
  try {
    return (await readMovie(file)).audio.map((a) => a.info);
  } catch {
    return null;
  }
}

/**
 * Extract one audio track (default the first) of an ISO BMFF file as a
 * standalone `.m4a` without decoding: the track is kept exactly as it is —
 * same codec, same channel layout, same samples. `null` for anything this
 * cannot do exactly — upload the original file whole then; extraction never
 * blocks or fails an upload.
 */
export async function extractAudioTrack(
  file: Blob & { readonly name?: string },
  options: ExtractAudioOptions = {}
): Promise<RemuxResult | null> {
  try {
    const index = options.trackIndex ?? 0;
    if (!Number.isInteger(index) || index < 0) return null;
    return await remux(file, index);
  } catch {
    // Unsupported layout, or a parse surprise (RangeError from a DataView
    // read past a truncated box): either way, the original is uploaded.
    return null;
  }
}

/** What to upload: the remuxed audio, or the original file whole. */
export interface PreparedUpload {
  readonly blob: Blob;
  readonly name: string;
  readonly contentType: string;
  /** The remux, or `null` when the original is sent as is. */
  readonly audio: RemuxResult | null;
}

/**
 * The remuxed audio when extraction works, the original file otherwise.
 * Never throws and never blocks the upload on extraction.
 */
export async function prepareUpload(
  file: Blob & { readonly name?: string },
  options: ExtractAudioOptions = {}
): Promise<PreparedUpload> {
  const audio = await extractAudioTrack(file, options);
  if (audio) return { blob: audio.blob, name: audio.name, contentType: audio.contentType, audio };
  return {
    blob: file,
    name: file.name ?? "upload",
    contentType: file.type || "application/octet-stream",
    audio: null,
  };
}
