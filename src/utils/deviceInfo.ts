export function getDeviceInfo(): { deviceType: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  let deviceType = 'Desktop 💻';

  if (/iPhone/i.test(ua)) {
    deviceType = 'iPhone 📱';
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
    deviceType = 'iPad / Tablet 📱';
  } else if (/Android/i.test(ua)) {
    if (/Tablet|Nexus 7|Nexus 10|SM-T/i.test(ua)) {
      deviceType = 'Android Tablet 📱';
    } else {
      deviceType = 'Android Mobile 📱';
    }
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceType = 'Mac Desktop 💻';
  } else if (/Windows/i.test(ua)) {
    deviceType = 'Windows PC 💻';
  } else if (/Linux/i.test(ua)) {
    deviceType = 'Linux Desktop 💻';
  }

  return { deviceType };
}

export async function fetchClientIp(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return data.ip;
      }
    }
  } catch (e) {
    // ignore
  }
  return '116.108.72.x';
}
