import MobileDetect from 'mobile-detect';
import { detect } from 'detect-browser';

const browserInfo = detect();
const md = new MobileDetect(window.navigator.userAgent);

/** Contains all pertinent device information */
export class DeviceInfo {

    /** Is this device currently in VR mode */
    public static isInVRMode: boolean;

    /** The name of the browser this device is using */
    public static browser: string = browserInfo ? browserInfo.name : '';

    /** Is WebXR Supported */
    public static isXRSupported: boolean;

    /** Is this device a touch capable mobile device */
    public static isMobileOrTablet: boolean = ((md.mobile() !== null) || (md.tablet() !== null));

    /** Is this device a touch capable mobile phone */
    public static isMobile: boolean = (md.mobile() !== null);

    /** Is this device an iOS device */
    public static isIOS: boolean = (md.os() === 'iOS');

    /** Can this device share links to native apps */
    // @ts-ignore
    public static canDoNativeShare: boolean = navigator.share as boolean;
}