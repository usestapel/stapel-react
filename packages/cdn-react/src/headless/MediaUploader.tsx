import type { ReactNode } from "react";
import type { CdnRef } from "../api/types.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { useUploadQueue } from "./useUploadQueue.js";
import type { UploadQueueBag } from "./useUploadQueue.js";

/**
 * Headless gallery uploader — a renderless queue of picks, bounded by `max`,
 * whose settled `<type>/<hash>` references are the value a composer stores.
 *
 * ```tsx
 * <MediaUploader max={10} onRefsChange={(refs) => form.setImagesDraft(refs)}>
 *   {({ items, canAdd, settled, add, remove, reorder }) => (
 *     <YourGrid … />
 *   )}
 * </MediaUploader>
 * ```
 *
 * Every decision a skin needs is in the bag and none of them is a boolean that
 * lost its reason: `canAdd` and `settled` are `ActionAvailability`, so a
 * disabled Add button and a disabled Save button can each say why.
 */
export function MediaUploader(props: {
  /** How many references this gallery may hold (listings' composer: 10). */
  max: number;
  target?: CdnUploadTarget;
  /** References the queue starts with — a reopened draft. */
  initialRefs?: readonly CdnRef[];
  concurrency?: number;
  onRefsChange?: (refs: readonly CdnRef[]) => void;
  children: (bag: UploadQueueBag) => ReactNode;
}): ReactNode {
  const bag = useUploadQueue({
    max: props.max,
    ...(props.target !== undefined ? { target: props.target } : {}),
    ...(props.initialRefs !== undefined ? { initialRefs: props.initialRefs } : {}),
    ...(props.concurrency !== undefined ? { concurrency: props.concurrency } : {}),
    ...(props.onRefsChange !== undefined
      ? { onRefsChange: props.onRefsChange }
      : {}),
  });
  return props.children(bag);
}
