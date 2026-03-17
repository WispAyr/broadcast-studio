import React, { useState, useEffect } from 'react';

const MOCK_POSTS = [
  { id: 1, platform: 'twitter', user: '@NowAyrshire', handle: 'Now Ayrshire Radio', text: 'Good morning Ayrshire! Tune in for the Breakfast Show with all your local news and weather.', time: '2m', avatar: 'NA', verified: true },
  { id: 2, platform: 'twitter', user: '@listener_jane', handle: 'Jane M', text: 'Loving the new morning playlist! Keep it up @NowAyrshire', time: '5m', avatar: 'JM', verified: false },
  { id: 3, platform: 'facebook', user: 'Ayrshire Events', handle: 'Ayrshire Events', text: 'Don\'t miss the Ayr Flower Show this weekend! Live coverage on Now Ayrshire Radio.', time: '12m', avatar: 'AE', verified: false },
  { id: 4, platform: 'twitter', user: '@weather_ayr', handle: 'Ayr Weather', text: 'Sunny spells expected across Ayrshire today with highs of 18C. Perfect for the coast!', time: '18m', avatar: 'WA', verified: true },
  { id: 5, platform: 'instagram', user: '@nowayrshire', handle: 'Now Ayrshire Radio', text: 'Behind the scenes at the studio this morning! New equipment looking great.', time: '25m', avatar: 'NA', verified: true },
];

const platformColors = {
  twitter: '#1DA1F2',
  facebook: '#4267B2',
  instagram: '#E1306C',
};

const platformIcons = {
  twitter: '\ud835\udd4f',
  facebook: 'f',
  instagram: '\ud83d\udcf7',
};

export default function SocialModule({ config = {} }) {
  const posts = config.posts || MOCK_POSTS;
  const bg = config.background || 'transparent';
  const color = config.color || '#ffffff';
  const showPlatform = config.showPlatform !== false;
  const autoScroll = config.autoScroll !== false;
  const scrollSpeed = config.scrollSpeed || 5000;

  const [visibleIndex, setVisibleIndex] = useState(0);

  useEffect(() => {
    if (!autoScroll || posts.length <= 3) return;
    const timer = setInterval(() => {
      setVisibleIndex((prev) => (prev + 1) % Math.max(1, posts.length - 2));
    }, scrollSpeed);
    return () => clearInterval(timer);
  }, [autoScroll, scrollSpeed, posts.length]);

  const visiblePosts = posts.slice(visibleIndex, visibleIndex + 4);

  return (
    <div
      className="w-full h-full overflow-hidden p-3 flex flex-col gap-2"
      style={{ background: bg, color }}
    >
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Social Feed
      </div>
      {visiblePosts.map((post) => (
        <div
          key={post.id}
          className="flex gap-3 p-2 rounded-lg bg-white/5 transition-all duration-500"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: platformColors[post.platform] || '#666' }}
          >
            {post.avatar || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate">{post.handle}</span>
              {post.verified && (
                <span className="text-blue-400 text-xs">&#10003;</span>
              )}
              {showPlatform && (
                <span
                  className="text-xs ml-auto opacity-50"
                  style={{ color: platformColors[post.platform] }}
                >
                  {platformIcons[post.platform]}
                </span>
              )}
              <span className="text-xs text-gray-500 ml-1">{post.time}</span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">
              {post.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
