---
"@stapel/listings-react": minor
"@stapel/cdn-react": patch
---

listings-react: `@stapel/currencies-react` is now a required peer. The `/default` entry imports it statically, so declaring it optional let a host without it fail `vite build`. cdn-react / listings-react docs: `useUploadQueue` examples pass the required `target`, and the composer example reads `useCategoryFeatures(...).data?.features`.
