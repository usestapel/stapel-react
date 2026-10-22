---
"@stapel/workspaces-react": patch
---

Publish `nav-manifest.json` (listed in `files`, exported as `./nav-manifest` and `./nav-manifest.json`). Every earlier version generated it but left it out of the tarball, so a consumer could not read the pair's entries or its `workspaces.switcher` embed from the installed package.
