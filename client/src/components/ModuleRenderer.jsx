import React from 'react';
import moduleRegistry from '../modules/index';

export default function ModuleRenderer({ type, config = {}, moduleId }) {
  const Component = moduleRegistry[type];

  if (!Component) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-xs">Unknown: {type}</span>
      </div>
    );
  }

  return <Component config={config} moduleId={moduleId} />;
}
