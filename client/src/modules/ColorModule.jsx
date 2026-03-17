import React from 'react';

export default function ColorModule({ config = {} }) {
  return (
    <div
      className="w-full h-full"
      style={{ background: config.color || config.background || '#000000' }}
    />
  );
}
