---
"@stapel/tokens": minor
---

Add the design-system **bridge role table** (`bridgeColorRoles`,
`bridgeRadiusRole`, `bridgeFontSizeRole` + the `BridgeColorRole` type;
frontend-guidelines §2.4). This is the SINGLE L2-core-token → neutral-role
mapping that both `@stapel/tokens-antd` and `@stapel/tokens-mui` consume, so the
two design-system theme bridges cannot drift. Hand-written (like the breakpoint
helpers), not part of the generated surface; no token values change.
