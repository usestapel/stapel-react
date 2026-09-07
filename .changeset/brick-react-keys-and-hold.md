---
"@stapel/brick-react": patch
---

`<BrickConsole/>` stops taking keystrokes that are not its own, and both components gain the host controls an integrator asked for:

- **An editable target keeps its keys.** The 0.1.0 window listener called `preventDefault()` on arrows, Space, Enter and `r` without looking at the target, so a form field beside a mounted game (an upload's title, typed while the game filled the wait) lost those characters. A key whose target is `input`, `textarea`, `select`, anything `contenteditable`, or anything inside one is no longer the game's; a focused button or link keeps Space and Enter as well, so the console's own menu and the host's buttons next to it stay reachable by keyboard.
- **The host can decline a key, or all of them.** `captureKeys: "focus" | "global"` — `"focus"` is the new default: the frame is focusable and reads keys only while focus is inside it. `"global"` is the opt-in for the window-level behaviour 0.1.0 had, and in either mode a handler that ran first and called `preventDefault()` keeps the key (a tour overlay stepping on ArrowLeft/Right). `enabled={false}` detaches every key handler while the board stays on screen. The contract is written down in the README.
- **Locale is documented and proven.** The package already registers with core's engine the fleet way (`registerBrickI18n`, `registerBrickI18nRu`/`Es` on the subpaths, `useOptionalI18n` in the components); the README now states the three things a host must mount for a locale to apply, and a test renders the console under a host engine switched to `ru`. The graceful English floor outside a provider is unchanged.
- **`paused`** on `<WaitingGame/>` and `<BrickConsole/>` (and `useBrickGame`) holds the game without unmounting it: the tick stops, the board and score stay, Start is inert until the hold clears, and clearing it resumes only a run the hold itself stopped — a board the person paused stays paused.

`<WaitingGame/>` forwards `captureKeys`, `enabled` and `paused` unchanged.
