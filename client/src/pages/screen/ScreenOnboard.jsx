import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ScreenOnboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  // If token is in URL (from QR), try to claim directly
  useEffect(() => {
    const token = searchParams.get('token');
    const screenId = searchParams.get('id');
    if (token && screenId) {
      // QR code contains the full URL, just navigate
      setSuccess(true);
      setTimeout(() => navigate(`/screen/${screenId}`), 500);
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handlePinChange(value) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    setError('');

    if (digits.length === 6) {
      setClaiming(true);
      try {
        const res = await fetch('/api/screens/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: digits })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Invalid PIN');
          setClaiming(false);
          setPin('');
          setTimeout(() => inputRef.current?.focus(), 100);
          return;
        }
        setSuccess(true);
        setTimeout(() => navigate(`/screen/${data.screenId}`), 800);
      } catch (err) {
        setError('Connection error');
        setClaiming(false);
        setPin('');
      }
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">✓</div>
          <p className="text-green-400 text-2xl font-bold">Connected</p>
          <p className="text-gray-500 mt-2">Loading screen display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-center max-w-md w-full px-8">
        {/* Logo/Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Broadcast Studio</h1>
          <p className="text-gray-500 text-lg">Screen Setup</p>
        </div>

        {/* PIN Input */}
        <div className="mb-8">
          <p className="text-gray-400 mb-4 text-sm uppercase tracking-wider">Enter 6-digit PIN</p>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={e => handlePinChange(e.target.value)}
            disabled={claiming}
            className="w-full text-center text-5xl font-mono tracking-[0.5em] bg-gray-900 border-2 border-gray-700 rounded-xl py-4 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            placeholder="● ● ● ● ● ●"
            maxLength={6}
            autoComplete="off"
          />
          {/* Visual dots */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  i < pin.length ? 'bg-blue-500 scale-125' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Claiming state */}
        {claiming && !success && (
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-gray-600 text-sm">
            Find the PIN in the <span className="text-gray-400">Control Panel → Screens</span> page,
            or scan the QR code shown there.
          </p>
        </div>
      </div>
    </div>
  );
}
