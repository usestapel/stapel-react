---
"@stapel/workspaces-react": minor
"@stapel/profiles-react": minor
---

Ручки вчерашних релизов бэкенда стали вызываемыми с фронта.

`@stapel/workspaces-react` (контракт stapel-workspaces `>=0.14 <0.15`):

- `useInvitations` / `useInfiniteInvitations` — админская таблица приглашений
  (`GET /{ws}/invitations`) с фильтрами `status` (`pending` / `never_accepted`
  / `all`) и `search`. Пагинация **якорная**, как у `useMembers`: страница
  адресуется непрозрачным `next_anchor` предыдущей, номера страницы нет —
  оффсет поехал бы ровно в тот момент, когда приглашение отзывают у админа
  под руками.
- `useRevokeInvitation` / `useResendInvitation` — отзыв и повторная отправка;
  обе возвращают обновлённый DTO. Ресенд ротирует токен и перезапускает TTL,
  поэтому таблица инвалидируется: старый `expires_at` на экране врал бы про
  живую креденцию.
- `useResetMemberPassword` — админский сброс пароля участнику.
  `generated_password` приходит ровно один раз и **не попадает в кэш
  запросов** (ничего не пишется через `setQueryData`, `gcTime: 0`): рантайм
  ядра персистит весь пользовательский query-кэш в localStorage, так что
  запись туда означала бы живой пароль на диске и в девтулзах.
- `useCapabilityGate` + порт `BUILTIN_CAPABILITY_LEVELS` — уровень `high` и
  скоуп `sensitive` известны **до** кнопки, а не после 403.
  `readVerificationEnrollment` отличает конверт «заведи фактор» (его ядро не
  перехватывает — перехватывать нечего) от обычного челленджа.
- `useUpdateSecuritySettings` — `provisioned_user_policies` теперь список
  независимых требований (#90), пустой список отправляется явно. Мердж
  делается на клиенте: бэкенд присваивает `settings` целиком, и голый
  `{security: …}` стёр бы остальные ключи.

`@stapel/profiles-react` (контракт stapel-profiles `>=0.9 <0.10`):

- `useProfilesBatch` — `POST /profiles/api/v1/batch`, один запрос вместо N.
  `profileBatchEntry` отвечает четырьмя состояниями (`found` / `missing` /
  `not_requested` / `unknown`): «профиля нет» — нормальное состояние и
  плейсхолдер, «не спрашивали» — другое дело, и схлопывать их в `undefined`
  значило бы вернуть тот самый дефект, ради которого батч и делался.
  Найденные профили засеваются в кэш `useProfile`; для `missing` не
  выдумывается ничего.
