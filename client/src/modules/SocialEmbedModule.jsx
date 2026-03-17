import React, { useEffect, useRef } from 'react';

export default function SocialEmbedModule({ config = {} }) {
  const platform = config.platform || 'twitter';
  const accountUrl = config.accountUrl || config.url || '';
  const theme = config.theme || 'dark';
  const background = config.background || '#000000';
  const color = config.color || '#ffffff';
  const containerRef = useRef(null);

  useEffect(() => {
    if (!accountUrl) return;

    const container = containerRef.current;
    if (!container) return;

    // Clear previous embeds
    container.innerHTML = '';

    if (platform === 'twitter' || platform === 'x') {
      // Twitter/X timeline embed
      const anchor = document.createElement('a');
      anchor.className = 'twitter-timeline';
      anchor.setAttribute('data-theme', theme);
      anchor.setAttribute('data-chrome', 'noheader nofooter noborders transparent');
      anchor.href = accountUrl;
      container.appendChild(anchor);

      // Load Twitter widget script
      if (!document.getElementById('twitter-wjs')) {
        const script = document.createElement('script');
        script.id = 'twitter-wjs';
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        document.head.appendChild(script);
      } else if (window.twttr?.widgets) {
        window.twttr.widgets.load(container);
      }
    } else if (platform === 'facebook') {
      // Facebook page plugin
      const div = document.createElement('div');
      div.className = 'fb-page';
      div.setAttribute('data-href', accountUrl);
      div.setAttribute('data-tabs', 'timeline');
      div.setAttribute('data-small-header', 'true');
      div.setAttribute('data-adapt-container-width', 'true');
      div.setAttribute('data-hide-cover', 'false');
      container.appendChild(div);

      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0';
        script.async = true;
        document.head.appendChild(script);
      } else if (window.FB?.XFBML) {
        window.FB.XFBML.parse(container);
      }
    } else if (platform === 'instagram') {
      // Instagram embed via iframe
      const iframe = document.createElement('iframe');
      const embedUrl = accountUrl.includes('/embed') ? accountUrl : accountUrl.replace(/\/$/, '') + '/embed';
      iframe.src = embedUrl;
      iframe.style.cssText = 'width:100%;height:100%;border:0;overflow:hidden;';
      iframe.setAttribute('scrolling', 'no');
      container.appendChild(iframe);
    }
  }, [platform, accountUrl, theme]);

  if (!accountUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <div className="text-center">
          <p className="text-sm">No social account configured</p>
          <p className="text-xs opacity-50 mt-1">Set platform and account URL</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ background, color }}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
