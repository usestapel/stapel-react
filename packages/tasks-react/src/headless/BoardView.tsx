/**
 * `<BoardView>` — the render-prop twin of {@link useBoard}.
 *
 * It renders nothing of its own: it calls the hook and hands the bag to
 * `children`. That is the whole seam a host needs to build a board with its own
 * design system without importing antd, and it is what makes the default skin
 * in `./default` genuinely replaceable rather than merely themeable.
 *
 * Named `BoardView`, not `KanbanBoard`, on purpose: `KanbanBoard` is the SKIN
 * component in `@stapel/tasks-react/default`, and two exports with one name —
 * one headless, one visual — is how a host ends up importing the wrong half.
 */
import type { ReactElement, ReactNode } from "react";
import { useBoard } from "./useBoard.js";
import type { BoardBag, BoardFilters } from "./useBoard.js";

export interface BoardViewProps {
  readonly boardId: string | undefined;
  readonly initialFilters?: BoardFilters;
  readonly children: (bag: BoardBag) => ReactNode;
}

export function BoardView(props: BoardViewProps): ReactElement {
  const bag = useBoard(props.boardId, props.initialFilters ?? {});
  return <>{props.children(bag)}</>;
}
