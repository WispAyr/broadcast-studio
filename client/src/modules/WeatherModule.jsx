import React from 'react';

export default function WeatherModule({ config = {} }) {
  const location = config.location || 'Unknown';
  const temperature = config.temperature || '--';
  const condition = config.condition || 'N/A';
  const unit = config.unit || 'C';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4"
      style={{
        background: config.background || 'transparent',
        color: config.color || '#ffffff'
      }}
    >
      <span className="text-sm opacity-70 mb-1">{location}</span>
      <span className="text-4xl font-bold">
        {temperature}&deg;{unit}
      </span>
      <span className="text-sm opacity-70 mt-1">{condition}</span>
    </div>
  );
}
