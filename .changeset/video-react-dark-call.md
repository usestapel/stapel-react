---
"@stapel/video-react": patch
---

The call surface is drawn from the theme in BOTH modes — the dark theme no longer gets a white sheet.

Owner report: "in video-call mode in the dark theme everything is very bad". Measured on the stand, headless, `data-theme="dark"`, 1440 and 390: `<CallRoute>`'s full-screen frame and `<IncomingCallOverlay>`'s phone arm were filled `#ffffff`, and every line on them — "Звонок", the peer's name, "Вы подключены", the caller's name on the ring — was the dark theme's light text at **1.09:1**. The frame read `token.colorBgContainer` ABOVE the component's own `<SkinTheme>`, which in a host that themes through `data-theme` alone (the storefront) is antd's ambient default: light, whatever the page is.

**Every token is now read inside the skin.** `<CallRoute>` is a `<SkinTheme surface="raised">` with the fixed frame as its style, so the sheet and the text come from the same resolved mode; `<IncomingCallOverlay>` and `<CallPanel>` resolve their skin first and read their tokens under it. The panel now themes correctly on its own too — a host mounting it outside `<CallRoute>`, or the showcase, used to get the light frame under a dark page.

**The ring's avatar** is filled from the `surface` / `text` pair with a `border` edge instead of antd's translucent white lettered in the on-accent colour, which measured 2.76:1 on the dark card. **The corner picture** gets a `border` edge so it reads as a picture on a tile one step darker than it.

Two gates in `test/darkSkin.test.tsx`: the default skin's source carries no colour literal at all (no hex, no `rgb()`, no named colour), and rendered under `data-theme="dark"` every fill the skin writes is one of the dark theme's own surface roles, every skin root resolved dark, nothing is light — and the same render under light resolves the light roles, so the colour is derived, not painted.
