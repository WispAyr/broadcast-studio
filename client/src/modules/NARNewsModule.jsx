import React, { useState, useEffect } from 'react';

const NEWS_API = 'https://www.nowayrshireradio.co.uk/wp-json/wp/v2/posts';
const NEWS_CAT = 87;
const SPORT_CAT = 88;

function decodeHtml(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
function stripHtml(str) { return str ? str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; }
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function extractImageUrl(post) {
  try {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    if (media?.source_url) return media.source_url;
    if (media?.media_details?.sizes?.medium?.source_url) return media.media_details.sizes.medium.source_url;
  } catch {}
  const imgMatch = post.content?.rendered?.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

export default function NARNewsModule({ config = {} }) {
  const {
    refreshInterval = 120000, background, color = '#ffffff', accentColor = '#3b82f6',
    showImages = true, showExcerpts = true, maxItems = 8, categories = 'news',
    autoScroll = true, scrollInterval = 8000, title, layout = 'list', compact = false,
  } = config;

  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const catIds = categories === 'sport' ? SPORT_CAT : categories === 'all' ? `${NEWS_CAT},${SPORT_CAT}` : NEWS_CAT;
  const displayTitle = title || (categories === 'sport' ? 'SPORT' : categories === 'all' ? 'NEWS & SPORT' : 'LOCAL NEWS');

  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      try {
        const url = `${NEWS_API}?per_page=${maxItems}&_embed&categories=${catIds}`;
        const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = JSON.parse(await res.text());
        if (mounted && Array.isArray(data)) setPosts(data);
        setError(null);
      } catch (e) { if (mounted) setError(e.message); }
    };
    fetchPosts();
    const timer = setInterval(fetchPosts, refreshInterval);
    return () => { mounted = false; clearInterval(timer); };
  }, [refreshInterval, maxItems, catIds]);

  useEffect(() => {
    if (!autoScroll || layout !== 'hero' || posts.length <= 1) return;
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setActiveIdx(prev => (prev + 1) % posts.length);
        setFadeIn(true);
      }, 400);
    }, scrollInterval);
    return () => clearInterval(timer);
  }, [autoScroll, scrollInterval, posts.length, layout]);

  const bg = background || 'linear-gradient(180deg, #0a0e1a, #111827)';

  if (error && !posts.length) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: bg, color: '#666' }}>
        <div className="text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#444" className="mx-auto mb-2"><path d="M19 5v14H5V5h14m1.1-2H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9zM11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
          <p className="text-sm">News unavailable</p>
        </div>
      </div>
    );
  }

  if (layout === 'ticker') return <NewsTicker posts={posts} config={{ background: bg, color, accentColor, displayTitle }} />;

  if (layout === 'hero') {
    const post = posts[activeIdx] || posts[0];
    if (!post) return null;
    const imgUrl = extractImageUrl(post);
    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: '#000', color }}>
        <style>{`
          @keyframes heroFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes heroImgZoom { from { transform: scale(1); } to { transform: scale(1.05); } }
          .hero-content { transition: opacity 0.4s ease, transform 0.4s ease; }
          .hero-content-visible { opacity: 1; transform: translateY(0); }
          .hero-content-hidden { opacity: 0; transform: translateY(12px); }
        `}</style>
        {showImages && imgUrl && (
          <img src={imgUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35, animation: 'heroImgZoom 20s ease-in-out infinite alternate' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.2) 100%)' }} />
        <div className={`absolute inset-0 flex flex-col justify-end p-6 hero-content ${fadeIn ? 'hero-content-visible' : 'hero-content-hidden'}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-[0.15em] text-white flex items-center gap-1.5"
              style={{ background: accentColor }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {displayTitle}
            </span>
            <span className="text-xs opacity-40">{timeAgo(post.date)}</span>
            <span className="ml-auto text-xs opacity-20 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{activeIdx + 1}/{posts.length}</span>
          </div>
          <h1 className="text-2xl font-black leading-tight mb-2" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
            {decodeHtml(post.title?.rendered)}
          </h1>
          {showExcerpts && (
            <p className="text-sm opacity-60 line-clamp-2 leading-relaxed max-w-[80%]">
              {stripHtml(decodeHtml(post.excerpt?.rendered))}
            </p>
          )}
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 flex">
          {posts.slice(0, 8).map((_, i) => (
            <div key={i} className="flex-1" style={{ background: i === activeIdx ? accentColor : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>
    );
  }

  // List layout
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: bg, color }}>
      <style>{`
        @keyframes listCardIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
        .list-card { animation: listCardIn 0.4s ease-out forwards; }
      `}</style>

      <div className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(15px)', borderBottom: `2px solid ${accentColor}33` }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={accentColor} opacity="0.8">
          <path d="M19 5v14H5V5h14m1.1-2H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9z"/>
        </svg>
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{displayTitle}</span>
        <span className="ml-auto text-[10px] opacity-20">nowayrshireradio.co.uk</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {posts.map((post, i) => {
          const imgUrl = showImages ? extractImageUrl(post) : null;
          const cats = post.class_list?.filter(c => c.startsWith('category-')).map(c => c.replace('category-', '')) || [];
          return (
            <div key={post.id} className="list-card flex gap-3 px-4 py-3 transition-all"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animationDelay: `${i * 0.08}s`, opacity: 0, background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              {imgUrl && !compact && (
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.3))' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {cats.includes('sport') && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                      style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.2)' }}>Sport</span>
                  )}
                  <span className="text-[10px] opacity-30">{timeAgo(post.date)}</span>
                </div>
                <h3 className={`font-semibold leading-snug ${compact ? 'text-xs' : 'text-sm'} line-clamp-2`}>
                  {decodeHtml(post.title?.rendered)}
                </h3>
                {showExcerpts && !compact && (
                  <p className="text-xs opacity-40 mt-1 line-clamp-2 leading-relaxed">
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

function NewsTicker({ posts, config }) {
  const { background, color, accentColor, displayTitle } = config;
  return (
    <div className="w-full h-full flex items-center overflow-hidden relative" style={{ background, color }}>
      <style>{`
        @keyframes narMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
      <div className="flex-shrink-0 px-3 py-1.5 mr-3 h-full flex items-center gap-1.5"
        style={{ background: accentColor, borderRight: '2px solid rgba(255,255,255,0.1)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white">{displayTitle}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="whitespace-nowrap flex gap-8" style={{ animation: 'narMarquee 40s linear infinite' }}>
          {[...posts, ...posts].map((post, i) => (
            <span key={i} className="text-sm font-semibold">
              {decodeHtml(post.title?.rendered)}
              <span className="opacity-30 mx-3">●</span>
            </span>
          ))}
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(10,14,26,0.9))' }} />
    </div>
  );
}
