import React from 'react';

export default function TextModule({ config = {} }) {
  const text = config.text || config.content || '';
  const align = config.align || 'center';

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4"
      style={{
        background: config.background || 'transparent',
        color: config.color || '#ffffff',
        textAlign: align
      }}
    >
      <span
        style={{
          fontSize: config.fontSize || '1.5rem',
          fontWeight: config.fontWeight || 'normal',
          fontFamily: config.fontFamily || 'inherit',
          lineHeight: 1.4
        }}
      >
        {text}
      </span>
    </div>
  );
}
