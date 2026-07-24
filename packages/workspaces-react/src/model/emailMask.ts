/**
 * Email masking — a PORT of stapel-workspaces' `views._mask_email` (the
 * function that produces `InvitationPreviewResponse.email_masked`). KEEP IN
 * SYNC with the backend: first character of the local part and of the domain
 * name survive, the TLD stays readable — `m***@e***.com`.
 *
 * Why the client re-implements it: the public invitation preview deliberately
 * carries only the MASKED email (harvest-proof, org-program §B2), yet the
 * §B4 flow must route "session & email match" vs "wrong account" BEFORE
 * attempting the accept. Masking the signed-in account's own (fully known)
 * email with the same algorithm and comparing the two masks is the exact
 * decision the backend would make — without ever exposing the invitee's
 * address. A mask collision (two addresses masking identically) merely shows
 * the accept prompt; the backend's real email-match on accept remains the
 * enforcement point.
 */

/** Mask an email exactly like the backend's invitation preview does. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  const domain = at === -1 ? "" : email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const maskedLocal = `${local.slice(0, 1) || "*"}***`;
  if (dot !== -1) {
    const domainName = domain.slice(0, dot);
    const tld = domain.slice(dot + 1);
    return `${maskedLocal}@${domainName.slice(0, 1) || "*"}***.${tld}`;
  }
  return `${maskedLocal}@${domain.slice(0, 1) || "*"}***`;
}

/** Whether `email`, masked by the backend's algorithm, equals `emailMasked`
 * (case-insensitive on the email, as the backend matches `iexact`). */
export function emailMatchesMask(email: string, emailMasked: string): boolean {
  return maskEmail(email.trim().toLowerCase()) === emailMasked.toLowerCase();
}
