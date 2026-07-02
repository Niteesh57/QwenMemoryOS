// ═══════════════════════════════════════════════════════════════════════
//  deviceAuthService.js — Device ID & 2-Minute OTP Pairing Service
// ═══════════════════════════════════════════════════════════════════════

const otpCache = new Map(); // Map<string (OTP), { deviceId, deviceName, expiresAt }>

/**
 * Clean up expired OTPs from memory
 */
function cleanExpiredOtps() {
  const now = Date.now();
  for (const [otp, entry] of otpCache.entries()) {
    if (now > entry.expiresAt) {
      otpCache.delete(otp);
    }
  }
}

/**
 * Generate a 6-digit OTP valid for 2 minutes (120 seconds)
 */
export function generateOtp(deviceId, deviceName) {
  cleanExpiredOtps();

  if (!deviceId) {
    throw new Error('Device ID is required to generate pairing OTP');
  }

  // Generate random 6-digit number
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 120 * 1000; // 2 minutes from now

  otpCache.set(otp, {
    deviceId,
    deviceName: deviceName || 'Unknown Device',
    expiresAt
  });

  console.log(`[DeviceAuth] Generated 2-min OTP [${otp}] for Device ID [${deviceId}] (${deviceName || 'Unknown'})`);

  return {
    ok: true,
    otp,
    expiresAt,
    expiresInSeconds: 120
  };
}

/**
 * Verify OTP and return paired device info
 */
export function verifyOtp(otp, targetDeviceNameOrId) {
  cleanExpiredOtps();

  if (!otp || typeof otp !== 'string') {
    return { ok: false, error: 'Please provide a valid 6-digit OTP.' };
  }

  const cleanOtp = otp.trim();
  const entry = otpCache.get(cleanOtp);

  if (!entry) {
    return {
      ok: false,
      error: 'Invalid or expired OTP. Please generate a new 2-minute OTP on your primary device.'
    };
  }

  // Verify targetDeviceNameOrId if user entered it (case-insensitive substring check)
  if (targetDeviceNameOrId && targetDeviceNameOrId.trim()) {
    const target = targetDeviceNameOrId.trim().toLowerCase();
    const idMatch = (entry.deviceId || '').toLowerCase().includes(target);
    const nameMatch = (entry.deviceName || '').toLowerCase().includes(target);
    if (!idMatch && !nameMatch) {
      return {
        ok: false,
        error: `OTP verified, but device name/ID did not match "${targetDeviceNameOrId}". Primary device is "${entry.deviceName}".`
      };
    }
  }

  // OTP verified successfully! Remove from cache so it cannot be reused.
  otpCache.delete(cleanOtp);

  console.log(`[DeviceAuth] Successfully verified OTP [${cleanOtp}] -> Paired with Device ID [${entry.deviceId}]`);

  return {
    ok: true,
    pairedDeviceId: entry.deviceId,
    pairedDeviceName: entry.deviceName
  };
}
