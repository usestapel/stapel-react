/**
 * `@stapel/recordings-react/upload` — framework-free large-upload client:
 * ISO BMFF audio extraction (container remux, zero-copy), fingerprint v1, and
 * the resumable checksum-verified multipart protocol. No React, no antd; not
 * re-exported from the package's main entry.
 */
export { extractAudioTrack, listAudioTracks, prepareUpload } from "./audioRemux.js";
export type { AudioTrackInfo, ExtractAudioOptions, PreparedUpload, RemuxResult } from "./audioRemux.js";
export { hashParts, fingerprintOf, partCount, partRange, sha256Hex, toHex } from "./fingerprint.js";
export type { HashPartsOptions, HashPartsResult } from "./fingerprint.js";
export {
  runChunkedUpload,
  UploadInterruptedError,
  UploadRestartRequiredError,
  waitUntilOnlineAndVisible,
} from "./chunkedUpload.js";
export { xhrPutPart } from "./storage-client.js";
export type {
  ChunkedUploadProgress,
  ChunkedUploadResult,
  PartPutResult,
  PartPutter,
  RetryPolicy,
  RunChunkedUploadOptions,
  UploadRestartReason,
} from "./chunkedUpload.js";
export {
  createChunkedTransport,
  ChunkedTransportError,
  toTransportError,
  hasUploadErrorCode,
  uploadErrorParam,
  uploadErrorStatus,
  UPLOAD_ERROR_KEYS,
} from "./transport.js";
export type {
  ChunkedTransportOptions,
  ChunkedUploadTransport,
  CompletedPart,
  FetchLikeClient,
  FetchLikeInit,
  FetchLikeResult,
  MultipartManifest,
  MultipartMint,
  MultipartPartUrl,
  MultipartStart,
  MultipartStartRequest,
  PartHash,
  StoredPart,
  UploadedRecording,
  UploadLookup,
} from "./transport.js";
