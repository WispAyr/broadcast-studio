import React from 'react';
import NARStudioDashboard from '../../components/NARStudioDashboard';

/**
 * Control-section wrapper for the NAR presenter studio dashboard.
 * The dashboard itself is a standalone live component (also available as the
 * `nar_studio` screen module and for intranet embedding).
 */
export default function StudioDashboard() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <NARStudioDashboard />
    </div>
  );
}
