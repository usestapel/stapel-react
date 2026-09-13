/**
 * `useMediaUpload` — one pick in, one CDN key and its render snapshot out.
 *
 * The three properties this hook is for, each asserted against the REAL flow
 * over a mocked wire (CONTRIBUTING.md): the key is the opaque `<type>/<hash>`
 * a consuming module stores, the descriptor is the snapshot the upload
 * response ALREADY carried (so no `describe` round trip is spent on a
 * reference this client just created), and a `Blob` with no name is given one
 * whose extension the server's own allowlist will accept.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { useMediaUpload } from "../src/index.js";
import { asFile, limitsForTarget } from "../src/headless/useMediaUpload.js";
import { CDN_DEFAULT_LIMITS } from "../src/index.js";
import { mockServer, TestHarness } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  documentFile,
  fileRow,
  hashOf,
  hit,
  imageFile,
  imageRow,
  MISS,
  uploaded,
} from "./fixtures.js";

function wrapper(server: MockServer): (props: { children: ReactNode }) => ReactElement {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

describe("the key and the descriptor", () => {
  it("hands back <type>/<hash> and the snapshot that came WITH the row", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/image/": { body: uploaded(imageRow({ hash })) },
    });
    const { result } = renderHook(() => useMediaUpload(), {
      wrapper: wrapper(server),
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.upload(file);
    });

    const got = outcome as { key: string; descriptor: { kind: string } | null };
    expect(got.key).toBe(`product/${hash}`);
    expect(result.current.key).toBe(`product/${hash}`);
    expect(got.descriptor?.kind).toBe("image");
    expect(result.current.phase).toBe("done");
    // The point of reading `render_meta` off the upload response: a component
    // that re-asked `describe` for a reference it had just made would pay a
    // round trip for bytes it was handed.
    expect(server.count("describe/")).toBe(0);
  });

  it("a dedup hit yields the same key with NO upload request", async () => {
    const file = imageFile();
    const hash = await hashOf(file);
    const server = mockServer({
      "file/exists/": { body: hit(imageRow({ hash })) },
      "POST upload/image/": { body: uploaded(imageRow({ hash })) },
    });
    const { result } = renderHook(() => useMediaUpload(), {
      wrapper: wrapper(server),
    });
    await act(async () => {
      await result.current.upload(file);
    });
    expect(result.current.key).toBe(`product/${hash}`);
    expect(result.current.deduped).toBe(true);
    expect(server.count("upload/image/")).toBe(0);
  });

  it("the target is per-call, so ONE control drives several intakes", async () => {
    const doc = documentFile();
    const hash = await hashOf(doc);
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/file/": { body: { file: fileRow({ hash }), message: "ok" } },
    });
    const { result } = renderHook(() => useMediaUpload(), {
      wrapper: wrapper(server),
    });
    await act(async () => {
      await result.current.upload(doc, { target: { kind: "file" } });
    });
    expect(result.current.key).toBe(`file/${hash}`);
    expect(result.current.kind).toBe("file");
    expect(result.current.descriptor?.kind).toBe("file");
  });

  it("a client-side refusal is an error, not a silent nothing", async () => {
    const server = mockServer({});
    const { result } = renderHook(() => useMediaUpload(), {
      wrapper: wrapper(server),
    });
    let outcome: unknown = "unset";
    await act(async () => {
      outcome = await result.current.upload(
        new File(["x"], "notes.exe", { type: "application/x-msdownload" })
      );
    });
    expect(outcome).toBeNull();
    expect(result.current.phase).toBe("failed");
    // The SERVER's own code, so the sentence is the same wherever the refusal
    // was decided — there is no second vocabulary for a client-side one.
    expect(result.current.error?.code).toBe("error.400.invalid_format");
    expect(server.calls).toHaveLength(0);
  });
});

describe("a Blob is not a File, and the gate reads File.name", () => {
  it("names an unnamed blob from its own MIME, never from a guess", () => {
    const named = asFile(new Blob(["x"], { type: "audio/webm" }), undefined);
    expect(named.name).toBe("upload.webm");
    expect(named.type).toBe("audio/webm");
  });

  it("prefers the caller's name — it is what the server stores and a document renders", () => {
    const named = asFile(new Blob(["x"], { type: "audio/ogg" }), "voice-2026.ogg");
    expect(named.name).toBe("voice-2026.ogg");
  });

  it("never renames a real File: renaming a pick would lose its extension", () => {
    const picked = imageFile("holiday.jpg");
    expect(asFile(picked, "other.png")).toBe(picked);
  });

  it("an unknown MIME yields no extension, so the gate refuses it honestly", () => {
    // Inventing an extension here would make an unsupported file look
    // supported — the mirror's one forbidden direction.
    expect(asFile(new Blob(["x"], { type: "audio/flac" }), undefined).name).toBe(
      "upload"
    );
  });
});

describe("the ceilings a target is measured against", () => {
  it("reads the intake's own limits, never the image ones for everything", () => {
    // A 30 MB clip refused against the image ceiling is exactly what
    // model/limits.ts says a mirror must never do.
    expect(limitsForTarget({ kind: "video" }, CDN_DEFAULT_LIMITS).maxBytes).toBe(
      CDN_DEFAULT_LIMITS.video.maxBytes
    );
    expect(limitsForTarget({ kind: "file" }, CDN_DEFAULT_LIMITS).maxBytes).toBe(
      CDN_DEFAULT_LIMITS.file.maxBytes
    );
    expect(limitsForTarget({ kind: "avatar" }, CDN_DEFAULT_LIMITS)).toBe(
      CDN_DEFAULT_LIMITS.image
    );
    expect(
      limitsForTarget({ kind: "typed", assetType: "cover" }, CDN_DEFAULT_LIMITS)
    ).toBe(CDN_DEFAULT_LIMITS.image);
  });
});
