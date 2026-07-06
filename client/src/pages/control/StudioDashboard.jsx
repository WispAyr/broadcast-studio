import React from 'react';
import NARStudioDashboard from '../../components/NARStudioDashboard';

/**
 * Control-section wrapper for the NAR presenter studio dashboard.
 * Fills the Control content area (the sidebar is a flex sibling, so this must
 * stay in normal flow — no absolute positioning, or it slides under the nav).
 * The dashboard is also available as the `nar_studio` screen module and for
 * intranet embedding.
 */
export default function StudioDashboard() {
  return (
    <div style={{ height: '100%', minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <NARStudioDashboard embed />
    </div>
  );
}
