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
