import React, { useState, useEffect, useCallback } from 'react';

/**
 * Now Ayrshire Radio — News Headlines Module
 * Pulls from: /wp-json/wp/v2/posts?per_page=10&_embed&categories=87
 * Shows: scrolling local news headlines with images and excerpts
 */

const NEWS_API = 'https://www.nowayrshireradio.co.uk/wp-json/wp/v2/posts';
const NEWS_CAT = 87;
const SPORT_CAT = 88;

function decodeHtml(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractImageUrl(post) {
  // Try featured media from _embedded
  try {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    if (media?.source_url) return media.source_url;
    if (media?.media_details?.sizes?.medium?.source_url) return media.media_details.sizes.medium.source_url;
  } catch {}
  // Try extracting from content
  const imgMatch = post.content?.rendered?.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

export default function NARNewsModule({ config = {} }) {
  const {
    refreshInterval = 120000,
    background = 'transparent',
    color = '#ffffff',
    accentColor = '#3b82f6',
    showImages = true,
    showExcerpts = true,
    maxItems = 8,
    categories = 'news', // 'news', 'sport', 'all'
    autoScroll = true,
    scrollInterval = 8000,
    title,
    layout = 'list', // 'list', 'hero', 'ticker'
    compact = false,
  } = config;

  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const catIds = categories === 'sport' ? SPORT_CAT : categories === 'all' ? `${NEWS_CAT},${SPORT_CAT}` : NEWS_CAT;
  const displayTitle = title || (categories === 'sport' ? 'SPORT' : categories === 'all' ? 'NEWS & SPORT' : 'LOCAL NEWS');

  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      try {
        const url = `${NEWS_API}?per_page=${maxItems}&_embed&categories=${catIds}`;
        const proxyUrl = `/api/proxy/fetch?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`${res.status}`);
        const text = await res.text();
        const data = JSON.parse(text);
        if (mounted && Array.isArray(data)) setPosts(data);
        setError(null);
      } catch (e) {
        if (mounted) setError(e.message);
      }
    };
    fetchPosts();
    const timer = setInterval(fetchPosts, refreshInterval);
    return () => { mounted = false; clearInterval(timer); };
  }, [refreshInterval, maxItems, catIds]);

  // Auto-scroll for hero mode
  useEffect(() => {
    if (!autoScroll || layout !== 'hero' || posts.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % posts.length);
    }, scrollInterval);
    return () => clearInterval(timer);
  }, [autoScroll, scrollInterval, posts.length, layout]);

  if (error && !posts.length) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <div className="text-center">
          <p className="text-3xl mb-2">📰</p>
          <p className="text-sm">News unavailable</p>
        </div>
      </div>
    );
  }

  if (layout === 'ticker') {
    return <NewsTicker posts={posts} config={{ background, color, accentColor, displayTitle }} />;
  }

  if (layout === 'hero') {
    const post = posts[activeIdx] || posts[0];
    if (!post) return null;
    const imgUrl = extractImageUrl(post);
    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: '#000', color }}>
        {showImages && imgUrl && (
          <img src={imgUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white"
              style={{ background: accentColor }}>
              {displayTitle}
            </span>
            <span className="text-xs opacity-50">{timeAgo(post.date)}</span>
            <span className="ml-auto text-xs opacity-30">{activeIdx + 1}/{posts.length}</span>
          </div>
          <h1 className="text-2xl font-bold leading-tight mb-2">
            {decodeHtml(post.title?.rendered)}
          </h1>
          {showExcerpts && (
            <p className="text-sm opacity-70 line-clamp-2 leading-relaxed">
              {stripHtml(decodeHtml(post.excerpt?.rendered))}
            </p>
          )}
        </div>
        {/* Progress dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {posts.slice(0, 8).map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? 'bg-white scale-125' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>
    );
  }

  // Default: list layout
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background, color }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `2px solid ${accentColor}` }}>
        <span className="text-lg">📰</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {displayTitle}
        </span>
        <span className="ml-auto text-[10px] opacity-30">nowayrshireradio.co.uk</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {posts.map((post, i) => {
          const imgUrl = showImages ? extractImageUrl(post) : null;
          const cats = post.class_list?.filter(c => c.startsWith('category-')).map(c => c.replace('category-', '')) || [];
          return (
            <div key={post.id} className={`flex gap-3 px-4 py-3 ${i < posts.length - 1 ? 'border-b border-white/5' : ''}`}>
              {imgUrl && !compact && (
                <img src={imgUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {cats.includes('sport') && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Sport</span>
                  )}
                  <span className="text-[10px] opacity-40">{timeAgo(post.date)}</span>
                </div>
                <h3 className={`font-semibold leading-snug ${compact ? 'text-xs' : 'text-sm'} line-clamp-2`}>
                  {decodeHtml(post.title?.rendered)}
                </h3>
                {showExcerpts && !compact && (
                  <p className="text-xs opacity-50 mt-1 line-clamp-2 leading-relaxed">
                    {stripHtml(decodeHtml(post.excerpt?.rendered)).substring(0, 150)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Horizontal scrolling ticker sub-component
function NewsTicker({ posts, config }) {
  const { background, color, accentColor, displayTitle } = config;
  return (
    <div className="w-full h-full flex items-center overflow-hidden" style={{ background, color }}>
      <div className="flex-shrink-0 px-3 py-1 mr-3" style={{ background: accentColor }}>
        <span className="text-xs font-bold uppercase text-white">{displayTitle}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex gap-8">
          {posts.map((post, i) => (
            <span key={post.id} className="text-sm">
              <span className="font-semibold">{decodeHtml(post.title?.rendered)}</span>
              <span className="opacity-40 mx-3">•</span>
            </span>
          ))}
          {/* Duplicate for seamless scroll */}
          {posts.map((post, i) => (
            <span key={`dup-${post.id}`} className="text-sm">
              <span className="font-semibold">{decodeHtml(post.title?.rendered)}</span>
              <span className="opacity-40 mx-3">•</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
}
