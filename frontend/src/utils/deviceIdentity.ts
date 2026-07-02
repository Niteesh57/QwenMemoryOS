// ═══════════════════════════════════════════════════════════════════════
//  deviceIdentity.ts — Device Fingerprinting & Graph Pairing Identity
// ═══════════════════════════════════════════════════════════════════════

export function getLocalDeviceId(): string {
  let id = localStorage.getItem('qwenos_device_id');
  if (!id) {
    id = 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
    localStorage.setItem('qwenos_device_id', id);
  }
  return id;
}

export function getDeviceName(): string {
  let name = localStorage.getItem('qwenos_device_name');
  if (!name) {
    const isMac = navigator.userAgent.includes('Mac');
    const isWin = navigator.userAgent.includes('Win');
    const os = isMac ? 'macOS' : isWin ? 'Windows PC' : 'Linux';
    const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Edge';
    name = `${browser} on ${os}`;
    localStorage.setItem('qwenos_device_name', name);
  }
  return name;
}

export function setDeviceName(newName: string) {
  if (newName && newName.trim()) {
    localStorage.setItem('qwenos_device_name', newName.trim());
  }
}

export function getActiveDeviceId(): string {
  const pairedId = localStorage.getItem('qwenos_paired_device_id');
  return pairedId || getLocalDeviceId();
}

export function getPairedDeviceName(): string | null {
  return localStorage.getItem('qwenos_paired_device_name');
}

export function pairWithDevice(deviceId: string, deviceName?: string) {
  localStorage.setItem('qwenos_paired_device_id', deviceId);
  if (deviceName) {
    localStorage.setItem('qwenos_paired_device_name', deviceName);
  }
}

export function unpairDevice() {
  localStorage.removeItem('qwenos_paired_device_id');
  localStorage.removeItem('qwenos_paired_device_name');
}

export function getDeviceHeaders(): Record<string, string> {
  return {
    'X-Device-ID': getActiveDeviceId(),
    'X-Device-Name': getDeviceName(),
  };
}
