/**
 * Device Detection Utilities
 * Detects device capabilities for performance optimization
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLowPower: boolean;
  supportsWebGL: boolean;
}

let cachedDeviceInfo: DeviceInfo | null = null;

export function getDeviceInfo(): DeviceInfo {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLowPower: false,
      supportsWebGL: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;

  // Detect low-power devices
  // Check for hardware concurrency (CPU cores)
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as any).deviceMemory || 4; // GB
  const isLowPower = hardwareConcurrency <= 2 || deviceMemory <= 2;

  // Check WebGL support
  const canvas = document.createElement("canvas");
  const supportsWebGL =
    !!canvas.getContext("webgl") || !!canvas.getContext("experimental-webgl");

  cachedDeviceInfo = {
    isMobile,
    isTablet,
    isDesktop,
    isLowPower,
    supportsWebGL,
  };

  return cachedDeviceInfo;
}

export function shouldDisableHeavyVisuals(): boolean {
  const deviceInfo = getDeviceInfo();
  return deviceInfo.isLowPower || deviceInfo.isMobile;
}






