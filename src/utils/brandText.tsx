import React from 'react';

/**
 * Utility function to highlight ProxyCom brand name in purple
 * Wraps any occurrence of "ProxyCom" with a span that has purple color
 */
export const highlightProxyCom = (text: string): React.ReactNode => {
  if (!text || typeof text !== 'string') return text;

  const parts = text.split(/(ProxyCom)/gi);

  return parts.map((part, index) => {
    if (part.toLowerCase() === 'proxycom') {
      return (
        <span key={index} className="proxycom-brand">
          {part}
        </span>
      );
    }
    return part;
  });
};
