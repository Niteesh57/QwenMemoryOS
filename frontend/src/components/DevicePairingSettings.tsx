import React, { useState, useEffect } from 'react';
import { Laptop, Key, ShieldCheck, Link2, Unlink, CheckCircle, AlertTriangle } from 'lucide-react';
import { getLocalDeviceId, getDeviceName, getActiveDeviceId, getPairedDeviceName, pairWithDevice, unpairDevice } from '../utils/deviceIdentity';

const API = 'http://localhost:3000';

export const DevicePairingSettings: React.FC<{ onPairChange?: () => void }> = ({ onPairChange }) => {
  const localId = getLocalDeviceId();
  const localName = getDeviceName();
  const activeId = getActiveDeviceId();
  const isPaired = activeId !== localId;
  const pairedName = getPairedDeviceName();

  // OTP Generation state
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [generating, setGenerating] = useState<boolean>(false);

  // Pairing verification state
  const [targetDeviceId, setTargetDeviceId] = useState<string>('');
  const [targetOtp, setTargetOtp] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Timer countdown effect for generated OTP
  useEffect(() => {
    if (timeLeft <= 0) {
      if (generatedOtp) setGeneratedOtp(null);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, generatedOtp]);

  const handleGenerateOtp = async () => {
    setGenerating(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/device/otp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: localId, deviceName: localName }),
      });
      const data = await res.json();
      if (res.ok && data.otp) {
        setGeneratedOtp(data.otp);
        setTimeLeft(120); // 2 minutes
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to generate OTP' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Cannot reach backend server.' });
    } finally {
      setGenerating(false);
    }
  };

  const handleVerifyAndPair = async () => {
    if (!targetDeviceId.trim() || !targetOtp.trim()) {
      setMsg({ type: 'error', text: 'Please enter both Device ID and the 6-digit OTP.' });
      return;
    }
    setVerifying(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/device/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDeviceId: targetDeviceId.trim(),
          otp: targetOtp.trim(),
          adoptingDeviceId: localId,
          adoptingDeviceName: localName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.paired) {
        pairWithDevice(data.deviceId, data.deviceName);
        setMsg({ type: 'success', text: `Successfully paired! Memory Graph mapped to ${data.deviceName || data.deviceId}.` });
        setTargetOtp('');
        setTargetDeviceId('');
        if (onPairChange) onPairChange();
      } else {
        setMsg({ type: 'error', text: data.error || 'Verification failed. Incorrect or expired OTP.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error verifying OTP.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleUnpair = () => {
    unpairDevice();
    setMsg({ type: 'success', text: 'Unpaired successfully. Returned to local device memory.' });
    if (onPairChange) onPairChange();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', color: '#f8fafc' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Laptop size={18} color="#c084fc" /> Device & Memory Graph Isolation
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
          Each device has its own isolated Neo4j graph space. Use a 2-minute OTP to adopt and access your graph across different devices.
        </p>
      </div>

      {/* Current Device Card */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: isPaired ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isPaired ? '⚡ Active Paired Memory Graph' : '💻 Local Device Identity'}
          </span>
          {isPaired ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: 'rgba(192, 132, 252, 0.15)', color: '#d8b4fe', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              <Link2 size={11} /> Paired
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              <ShieldCheck size={11} /> Isolated
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>
            {activeId}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {isPaired ? `Target Device Name: ${pairedName || 'Remote Workspace'}` : `Device Name: ${localName}`}
          </div>
        </div>

        {isPaired && (
          <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={handleUnpair}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Unlink size={13} /> Unpair & Revert to Local Graph ({localId})
            </button>
          </div>
        )}
      </div>

      {/* Generate OTP Section */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Allow Access From Another Device</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Generate a 2-minute OTP to adopt this device's memory graph.</div>
          </div>
          <button
            onClick={handleGenerateOtp}
            disabled={generating || timeLeft > 0}
            style={{
              background: timeLeft > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(139, 92, 246, 0.2)',
              border: timeLeft > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(139, 92, 246, 0.4)',
              color: timeLeft > 0 ? '#64748b' : '#c4b5fd',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: timeLeft > 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Key size={13} /> {timeLeft > 0 ? `Active (${timeLeft}s)` : 'Generate OTP'}
          </button>
        </div>

        {generatedOtp && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px dashed #8b5cf6',
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ fontSize: '10px', color: '#c4b5fd', fontWeight: 600 }}>ENTER THIS OTP ON YOUR OTHER DEVICE:</div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '6px', color: '#ffffff', fontFamily: 'monospace' }}>
              {generatedOtp}
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Expires in {Math.floor(timeLeft / 60)}m {timeLeft % 60}s</div>
          </div>
        )}
      </div>

      {/* Pair with another device */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Adopt Another Device's Memory Graph</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Enter the Device ID and OTP displayed on your target system.</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Target Device ID (e.g. DEV-XXXXXX)"
            value={targetDeviceId}
            onChange={e => setTargetDeviceId(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '8px 10px',
              fontSize: '11px',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
          <input
            type="text"
            placeholder="6-Digit OTP"
            maxLength={6}
            value={targetOtp}
            onChange={e => setTargetOtp(e.target.value)}
            style={{
              width: '100px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '2px',
              outline: 'none'
            }}
          />
        </div>

        <button
          onClick={handleVerifyAndPair}
          disabled={verifying}
          style={{
            background: 'rgba(52, 211, 153, 0.18)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            color: '#34d399',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: verifying ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s'
          }}
        >
          <Link2 size={14} /> {verifying ? 'Verifying...' : 'Pair & Sync Memory Graph'}
        </button>
      </div>

      {msg && (
        <div style={{
          background: msg.type === 'success' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: msg.type === 'success' ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
          color: msg.type === 'success' ? '#34d399' : '#f87171',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
};
