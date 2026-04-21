import React, { useEffect, useRef, useState } from 'react';
import { registerConfirm } from '../lib/dialog';
import ConfirmDialog from './ConfirmDialog';

// Mounts a single ConfirmDialog and registers it with the promise-based helper
// in `lib/dialog.js`. Stacked calls are queued — the second dialog opens after
// the first resolves — so concurrent await confirmAsync() calls don't collide.
export default function ConfirmHost() {
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);

  useEffect(() => {
    registerConfirm((opts) => {
      if (!current) setCurrent(opts);
      else queueRef.current.push(opts);
    });
  }, [current]);

  if (!current) return null;

  const close = (confirmed) => {
    if (confirmed) current.onConfirm?.();
    else current.onCancel?.();
    const next = queueRef.current.shift() || null;
    setCurrent(next);
  };

  return (
    <ConfirmDialog
      open
      title={current.title}
      message={current.message}
      confirmLabel={current.confirmLabel}
      cancelLabel={current.cancelLabel}
      variant={current.variant}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}
