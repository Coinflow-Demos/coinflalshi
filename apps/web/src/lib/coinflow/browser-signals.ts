export function get3DsBrowserParams() {
  return {
    colorDepth: window.screen.colorDepth,
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    timeZone: new Date().getTimezoneOffset(),
  };
}

declare global {
  interface Window {
    nSureSDK?: {getDeviceId(): string};
  }
}

/** From the nSure fraud-protection script mounted in the root layout —
 * required on Coinflow API calls or the charge gets auto-declined. */
export function getFraudProtectionDeviceId(): string | undefined {
  return window.nSureSDK?.getDeviceId();
}
