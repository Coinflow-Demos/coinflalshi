function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds the auto-submitting POST form used to complete a TokenEx-routed 3DS
 * challenge (`url`/`creq` come from Coinflow's 412 response, but this string
 * is injected directly into an iframe's srcDoc, so both are escaped and the
 * action is restricted to https:// — returns null if url isn't safe to use). */
export function buildThreeDsChallengeHtml({url, creq}: {url: string; creq: string}): string | null {
  if (!/^https:\/\//i.test(url)) return null;
  return `<html><body onload="document.challenge.submit()">
    <form method="post" name="challenge" action="${escapeHtmlAttribute(url)}">
      <input type="hidden" name="creq" value="${escapeHtmlAttribute(creq)}" />
    </form>
  </body></html>`;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Builds the same auto-submitting POST form as `buildThreeDsChallengeHtml`,
 * but for the Basis-Theory-routed challenge shape (empty `creq`, with
 * `acsChallengeUrl`/`acsTransactionId`/`sessionId`/`threeDSVersion` in the
 * 412 response's `url` query string instead). The EMV 3DS `creq` payload —
 * `{messageType, messageVersion, threeDSServerTransID, acsTransID,
 * challengeWindowSize}` — is exactly what `@basis-theory/web-threeds`'s own
 * `startChallenge()` constructs client-side before POSTing it to
 * `acsChallengeUrl`; it never uses an API key for this, only for its
 * unrelated `createSession` call, so we build the same payload ourselves and
 * skip the SDK (and the merchant key it would otherwise require) entirely. */
export function buildBasisTheoryChallengeHtml({
  acsChallengeUrl,
  acsTransactionId,
  sessionId,
  threeDSVersion,
}: {
  acsChallengeUrl: string;
  acsTransactionId: string;
  sessionId: string;
  threeDSVersion: string;
}): string | null {
  const creq = {
    messageType: 'CReq',
    messageVersion: threeDSVersion,
    threeDSServerTransID: sessionId,
    acsTransID: acsTransactionId,
    challengeWindowSize: '03',
  };
  return buildThreeDsChallengeHtml({url: acsChallengeUrl, creq: base64UrlEncode(JSON.stringify(creq))});
}

/** Recognizes the ACS's own completion signal for a Basis-Theory-routed
 * challenge — `{type: "challenge", isCompleted, ...}`, posted directly to
 * window.parent once the user finishes (the same shape
 * @basis-theory/web-threeds itself listens for from its hosted challenge
 * page). Coinflow's own TokenEx notification page instead posts the plain
 * string "challenge_success" — check for both. */
export function isBasisTheoryChallengeNotification(data: unknown): data is {type: string; isCompleted: boolean} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as {type?: unknown}).type === 'challenge' &&
    typeof (data as {isCompleted?: unknown}).isCompleted === 'boolean'
  );
}
