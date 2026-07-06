import React from 'react';
import NARStudioDashboard from '../components/NARStudioDashboard';

/**
 * Screen-module form of the NAR presenter studio dashboard, so it can be
 * dropped onto any managed screen via the Layouts/Screens system. Config keys
 * map straight onto the dashboard's props.
 */
export default function NARStudioModule({ config = {} }) {
  return (
    <NARStudioDashboard
      stationId={config.stationId || undefined}
      newsUrl={config.newsUrl || undefined}
      socialUrl={config.socialUrl || ''}
      live={config.live !== false}
      embed
    />
  );
}
