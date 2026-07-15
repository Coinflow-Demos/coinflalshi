import {Dimensions} from 'react-native';

/** RN equivalent of the web app's get3DsBrowserParams — there's no
 * window.screen, so this uses Dimensions instead. colorDepth has no RN
 * equivalent; 24 (24-bit color) is the standard default browsers report. */
export function get3DsBrowserParams() {
  const {width, height} = Dimensions.get('screen');
  return {
    colorDepth: 24,
    screenHeight: Math.round(height),
    screenWidth: Math.round(width),
    timeZone: new Date().getTimezoneOffset(),
  };
}
