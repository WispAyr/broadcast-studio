/**
 * Composition Registry
 * Each composition exports: component, schema (input props definition),
 * meta (name, description, thumbnail, defaultDuration, fps)
 */

import { TitleReveal } from './TitleReveal';
import { LowerThird } from './LowerThird';
import { KineticText } from './KineticText';
import { ParticleTitle } from './ParticleTitle';
import { GradientWave } from './GradientWave';
import { LogoStinger } from './LogoStinger';
import { CountdownTimer } from './CountdownTimer';
import { SponsorCarousel } from './SponsorCarousel';
import { SocialPopup } from './SocialPopup';
import { TextScramble } from './TextScramble';

// New compositions
import { EventSchedule } from './EventSchedule';
import { ArtistSpotlight } from './ArtistSpotlight';
import { SetlistTracker } from './SetlistTracker';
import { DrinkMenu } from './DrinkMenu';
import { TicketCTA } from './TicketCTA';
import { NeonSign } from './NeonSign';
import { RetroWave } from './RetroWave';
import { Starfield } from './Starfield';
import { MatrixRain } from './MatrixRain';
import { FireworksBurst } from './FireworksBurst';
import { LiquidBlob } from './LiquidBlob';
import { GlitchOverlay } from './GlitchOverlay';
import { PollResults } from './PollResults';
import { Scoreboard } from './Scoreboard';
import { NextUp } from './NextUp';
import { BRB } from './BRB';
import { TechDifficulties } from './TechDifficulties';
import { HashtagWall } from './HashtagWall';
import { QROverlay } from './QROverlay';
import { WifiInfo } from './WifiInfo';
import { CountryNight } from './CountryNight';
import { ClubNight } from './ClubNight';
import { ComedyNight } from './ComedyNight';
import { FamilyFun } from './FamilyFun';

// NAR Branded compositions
import { NARStationIdent } from './NARStationIdent';
import { NARShowBanner } from './NARShowBanner';
import { NARNowPlaying } from './NARNowPlaying';
import { NARBreakingNews } from './NARBreakingNews';
import { NARWeather } from './NARWeather';
import { NARSocialFeed } from './NARSocialFeed';
import { NARCountdown } from './NARCountdown';

// Premium Broadcast compositions
import { CinematicReveal } from './CinematicReveal';
import { AudioSpectrum3D } from './AudioSpectrum3D';
import { DataDashboard } from './DataDashboard';
import { SplitScreenWipe } from './SplitScreenWipe';
import { ParallaxSlideshow } from './ParallaxSlideshow';
import { GlassmorphismClock } from './GlassmorphismClock';
import { ElectricBorder } from './ElectricBorder';
import { MinimalEndCard } from './MinimalEndCard';

const compositions = {
  title_reveal: {
    component: TitleReveal,
    meta: {
      name: 'Title Reveal',
      description: 'Animated title with reveal effect — great for event names and headings',
      category: 'titles',
      defaultDuration: 5,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'YOUR TITLE' },
      subtitle: { type: 'text', label: 'Subtitle', default: '' },
      color: { type: 'color', label: 'Text Color', default: '#ffffff' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#3b82f6' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      fontSize: { type: 'number', label: 'Font Size', default: 120, min: 20, max: 300 },
      style: { type: 'select', label: 'Style', default: 'slide-up', options: ['slide-up', 'fade-in', 'typewriter', 'split'] },
    },
  },

  lower_third: {
    component: LowerThird,
    meta: {
      name: 'Lower Third',
      description: 'Professional lower-third overlay with name and title',
      category: 'overlays',
      defaultDuration: 6,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      name: { type: 'text', label: 'Name', default: 'Speaker Name' },
      title: { type: 'text', label: 'Title / Role', default: 'Event Host' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#3b82f6' },
      style: { type: 'select', label: 'Style', default: 'modern', options: ['modern', 'minimal', 'bold', 'glassmorphism'] },
      position: { type: 'select', label: 'Position', default: 'bottom-left', options: ['bottom-left', 'bottom-right', 'top-left', 'top-right'] },
    },
  },

  kinetic_text: {
    component: KineticText,
    meta: {
      name: 'Kinetic Typography',
      description: 'Words animate in with impact — perfect for lyrics, quotes, or announcements',
      category: 'titles',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      words: { type: 'textarea', label: 'Text (one word per beat)', default: 'BOOTS\nAND\nBEATS' },
      color: { type: 'color', label: 'Text Color', default: '#ffffff' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#f59e0b' },
      background: { type: 'color', label: 'Background', default: 'transparent' },
      fontSize: { type: 'number', label: 'Font Size', default: 180, min: 40, max: 400 },
      style: { type: 'select', label: 'Animation', default: 'slam', options: ['slam', 'wave', 'rotate', 'glitch'] },
    },
  },

  particle_title: {
    component: ParticleTitle,
    meta: {
      name: 'Particle Title',
      description: 'Title emerges from particle effects — dramatic event opener',
      category: 'titles',
      defaultDuration: 6,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'BOOTS N BEATS' },
      particleColor: { type: 'color', label: 'Particle Color', default: '#f59e0b' },
      textColor: { type: 'color', label: 'Text Color', default: '#ffffff' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      particleCount: { type: 'number', label: 'Particle Count', default: 100, min: 20, max: 500 },
      fontSize: { type: 'number', label: 'Font Size', default: 140, min: 40, max: 300 },
    },
  },

  gradient_wave: {
    component: GradientWave,
    meta: {
      name: 'Gradient Wave',
      description: 'Flowing animated gradient background — ambient visual filler',
      category: 'backgrounds',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      colors: { type: 'textarea', label: 'Colors (one hex per line)', default: '#667eea\n#764ba2\n#f093fb\n#f5576c' },
      speed: { type: 'number', label: 'Speed', default: 1, min: 0.1, max: 5 },
      style: { type: 'select', label: 'Style', default: 'mesh', options: ['mesh', 'linear', 'radial', 'conic'] },
    },
  },

  logo_stinger: {
    component: LogoStinger,
    meta: {
      name: 'Logo Stinger',
      description: 'Logo animation with impact — transitions, intros, outros',
      category: 'branding',
      defaultDuration: 3,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      logoUrl: { type: 'text', label: 'Logo URL', default: '' },
      text: { type: 'text', label: 'Text', default: '' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#3b82f6' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      style: { type: 'select', label: 'Style', default: 'zoom-spin', options: ['zoom-spin', 'glitch', 'shatter', 'wipe'] },
    },
  },

  countdown_timer: {
    component: CountdownTimer,
    meta: {
      name: 'Countdown (Cinematic)',
      description: 'Dramatic countdown with visual flair — event start, set changes',
      category: 'utility',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      targetTime: { type: 'text', label: 'Target Time (ISO or HH:MM)', default: '' },
      label: { type: 'text', label: 'Label', default: 'STARTING IN' },
      color: { type: 'color', label: 'Color', default: '#ffffff' },
      accentColor: { type: 'color', label: 'Accent', default: '#ef4444' },
      background: { type: 'color', label: 'Background', default: 'transparent' },
      style: { type: 'select', label: 'Style', default: 'flip', options: ['flip', 'radial', 'minimal', 'dramatic'] },
    },
  },

  sponsor_carousel: {
    component: SponsorCarousel,
    meta: {
      name: 'Sponsor Carousel',
      description: 'Rotating sponsor logos with smooth transitions',
      category: 'branding',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      sponsors: { type: 'textarea', label: 'Sponsor URLs (one per line)', default: '' },
      intervalSec: { type: 'number', label: 'Seconds per sponsor', default: 3, min: 1, max: 30 },
      style: { type: 'select', label: 'Transition', default: 'fade', options: ['fade', 'slide', 'zoom', 'flip'] },
      background: { type: 'color', label: 'Background', default: 'transparent' },
    },
  },

  social_popup: {
    component: SocialPopup,
    meta: {
      name: 'Social Popup',
      description: 'Animated social media handle overlay',
      category: 'overlays',
      defaultDuration: 5,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      platform: { type: 'select', label: 'Platform', default: 'instagram', options: ['instagram', 'twitter', 'facebook', 'tiktok', 'youtube'] },
      handle: { type: 'text', label: 'Handle', default: '@yourhandle' },
      accentColor: { type: 'color', label: 'Color', default: '#e1306c' },
      position: { type: 'select', label: 'Position', default: 'bottom-right', options: ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'center'] },
    },
  },

  text_scramble: {
    component: TextScramble,
    meta: {
      name: 'Text Scramble',
      description: 'Matrix-style text decode effect — reveals messages with drama',
      category: 'titles',
      defaultDuration: 4,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text: { type: 'text', label: 'Text', default: 'COMING UP NEXT' },
      color: { type: 'color', label: 'Color', default: '#22d3ee' },
      background: { type: 'color', label: 'Background', default: 'transparent' },
      fontSize: { type: 'number', label: 'Font Size', default: 100, min: 20, max: 300 },
      scrambleChars: { type: 'text', label: 'Scramble Characters', default: '!<>-_\\/[]{}—=+*^?#________' },
    },
  },

  // ═══════════════════════════════════════════════
  // NEW COMPOSITIONS
  // ═══════════════════════════════════════════════

  event_schedule: {
    component: EventSchedule,
    meta: {
      name: 'Event Schedule',
      description: 'Animated lineup/timetable with acts and times — auto-scrolling',
      category: 'event',
      defaultDuration: 12,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'TONIGHT\'S LINEUP' },
      items: { type: 'textarea', label: 'Schedule (Time — Act per line)', default: '9:00 PM — DJ Shadow\n10:00 PM — The Headliners\n11:00 PM — MC Thunder\n11:30 PM — Grand Finale' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#f59e0b' },
      textColor: { type: 'color', label: 'Text Color', default: '#ffffff' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
    },
  },

  artist_spotlight: {
    component: ArtistSpotlight,
    meta: {
      name: 'Artist Spotlight',
      description: 'Full-screen artist promo with name, genre badge, and set time',
      category: 'event',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      artistName: { type: 'text', label: 'Artist Name', default: 'DJ SHADOW' },
      genre: { type: 'text', label: 'Genre', default: 'Electronic' },
      setTime: { type: 'text', label: 'Set Time', default: '10:00 PM' },
      description: { type: 'text', label: 'Description', default: 'Award-winning artist bringing the beats' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#ec4899' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  setlist_tracker: {
    component: SetlistTracker,
    meta: {
      name: 'Setlist Tracker',
      description: 'Now playing / next up overlay with animated equalizer',
      category: 'overlays',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      currentSong: { type: 'text', label: 'Current Song', default: 'Thunderstruck' },
      currentArtist: { type: 'text', label: 'Current Artist', default: 'AC/DC' },
      nextSong: { type: 'text', label: 'Next Song', default: 'Sweet Home Alabama' },
      nextArtist: { type: 'text', label: 'Next Artist', default: 'Lynyrd Skynyrd' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#22d3ee' },
      background: { type: 'color', label: 'Background', default: 'transparent' },
    },
  },

  drink_menu: {
    component: DrinkMenu,
    meta: {
      name: 'Drink Menu',
      description: 'Animated bar menu with prices and featured cocktail',
      category: 'event',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'BAR MENU' },
      items: { type: 'textarea', label: 'Menu (Name — Price per line)', default: 'Pint of Lager — £5.50\nGin & Tonic — £7.00\nJack & Coke — £7.50\nHouse Wine — £6.00\nCocktail Special — £8.50' },
      featuredDrink: { type: 'text', label: 'Featured Drink', default: '🍹 TONIGHT\'S SPECIAL: Boots n Beats Bourbon Sour — £9' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#f59e0b' },
      background: { type: 'color', label: 'Background', default: '#0c0a09' },
      textColor: { type: 'color', label: 'Text Color', default: '#ffffff' },
    },
  },

  ticket_cta: {
    component: TicketCTA,
    meta: {
      name: 'Ticket CTA',
      description: 'Get your tickets call-to-action with price and urgency',
      category: 'event',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      headline: { type: 'text', label: 'Headline', default: 'GET YOUR TICKETS' },
      eventName: { type: 'text', label: 'Event Name', default: 'BOOTS N BEATS' },
      price: { type: 'text', label: 'Price', default: 'From £15' },
      url: { type: 'text', label: 'URL', default: 'ayrpavilion.co.uk' },
      urgency: { type: 'text', label: 'Urgency Text', default: 'LIMITED AVAILABILITY' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#ef4444' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  neon_sign: {
    component: NeonSign,
    meta: {
      name: 'Neon Sign',
      description: 'Flickering neon text with authentic glow effect',
      category: 'effects',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text: { type: 'text', label: 'Text', default: 'OPEN' },
      color: { type: 'color', label: 'Neon Color', default: '#ff00ff' },
      secondaryColor: { type: 'color', label: 'Secondary Color', default: '#00ffff' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
      fontSize: { type: 'number', label: 'Font Size', default: 160, min: 40, max: 400 },
      flickerSpeed: { type: 'number', label: 'Flicker Speed', default: 1, min: 0, max: 5 },
    },
  },

  retro_wave: {
    component: RetroWave,
    meta: {
      name: 'RetroWave',
      description: '80s synthwave sun + grid landscape — vaporwave aesthetic',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text: { type: 'text', label: 'Text (optional)', default: '' },
      sunColor: { type: 'color', label: 'Sun Color', default: '#ff006a' },
      gridColor: { type: 'color', label: 'Grid Color', default: '#ff00ff' },
      skyColor1: { type: 'color', label: 'Sky Top', default: '#0a001a' },
      skyColor2: { type: 'color', label: 'Sky Bottom', default: '#1a0040' },
      speed: { type: 'number', label: 'Speed', default: 1, min: 0.1, max: 5 },
    },
  },

  starfield: {
    component: Starfield,
    meta: {
      name: 'Starfield',
      description: 'Flying through stars — hyperspace background effect',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      starCount: { type: 'number', label: 'Star Count', default: 200, min: 50, max: 500 },
      speed: { type: 'number', label: 'Speed', default: 1, min: 0.1, max: 5 },
      color: { type: 'color', label: 'Star Color', default: '#ffffff' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  matrix_rain: {
    component: MatrixRain,
    meta: {
      name: 'Matrix Rain',
      description: 'Digital rain effect with custom characters',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      characters: { type: 'text', label: 'Characters', default: 'アイウエオカキクケコサシスセソ0123456789ABCDEF' },
      color: { type: 'color', label: 'Color', default: '#00ff41' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      density: { type: 'number', label: 'Density', default: 30, min: 10, max: 60 },
      speed: { type: 'number', label: 'Speed', default: 1, min: 0.1, max: 5 },
    },
  },

  fireworks_burst: {
    component: FireworksBurst,
    meta: {
      name: 'Fireworks Burst',
      description: 'Celebratory fireworks with launch trails and explosions',
      category: 'effects',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      burstCount: { type: 'number', label: 'Burst Count', default: 5, min: 1, max: 15 },
      background: { type: 'color', label: 'Background', default: '#000005' },
      colors: { type: 'textarea', label: 'Colors (one per line)', default: '#ff0040\n#00ff88\n#ffdd00\n#ff00ff\n#00ccff' },
    },
  },

  liquid_blob: {
    component: LiquidBlob,
    meta: {
      name: 'Liquid Blob',
      description: 'Organic morphing blob shapes with gradient fills',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      color1: { type: 'color', label: 'Color 1', default: '#ff006a' },
      color2: { type: 'color', label: 'Color 2', default: '#8b5cf6' },
      color3: { type: 'color', label: 'Color 3', default: '#06b6d4' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      speed: { type: 'number', label: 'Speed', default: 1, min: 0.1, max: 5 },
      blobCount: { type: 'number', label: 'Blob Count', default: 4, min: 2, max: 8 },
    },
  },

  glitch_overlay: {
    component: GlitchOverlay,
    meta: {
      name: 'Glitch Overlay',
      description: 'Periodic glitch/distortion effect — layer over other content',
      category: 'overlays',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      intensity: { type: 'number', label: 'Intensity', default: 3, min: 1, max: 10 },
      color1: { type: 'color', label: 'Glitch Color 1', default: '#ff0000' },
      color2: { type: 'color', label: 'Glitch Color 2', default: '#00ffff' },
      frequency: { type: 'number', label: 'Frequency', default: 2, min: 0.5, max: 10 },
      background: { type: 'color', label: 'Background', default: 'transparent' },
    },
  },

  poll_results: {
    component: PollResults,
    meta: {
      name: 'Poll Results',
      description: 'Live poll/voting results with animated bars',
      category: 'broadcast',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      question: { type: 'text', label: 'Question', default: 'BEST ACT TONIGHT?' },
      options: { type: 'textarea', label: 'Options (Name — Votes per line)', default: 'DJ Shadow — 45\nThe Headliners — 32\nMC Thunder — 18\nVocal Fire — 5' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#8b5cf6' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
      textColor: { type: 'color', label: 'Text Color', default: '#ffffff' },
    },
  },

  scoreboard: {
    component: Scoreboard,
    meta: {
      name: 'Scoreboard',
      description: 'Competition/quiz scoreboard with team names and scores',
      category: 'broadcast',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'QUIZ SCOREBOARD' },
      teams: { type: 'textarea', label: 'Teams (Name — Score per line)', default: 'Team Whisky — 42\nTeam Irn Bru — 38\nTeam Haggis — 35\nTeam Nessie — 29' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#f59e0b' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
      textColor: { type: 'color', label: 'Text Color', default: '#ffffff' },
    },
  },

  next_up: {
    component: NextUp,
    meta: {
      name: 'Next Up',
      description: 'Coming up next with artist name, time, and gradient accent',
      category: 'broadcast',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      label: { type: 'text', label: 'Label', default: 'COMING UP NEXT' },
      artistName: { type: 'text', label: 'Artist / Act', default: 'THE HEADLINERS' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Live on the Main Stage' },
      time: { type: 'text', label: 'Time', default: '10:30 PM' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#ec4899' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  brb: {
    component: BRB,
    meta: {
      name: 'BRB',
      description: 'Be Right Back screen with animated patterns',
      category: 'broadcast',
      defaultDuration: 30,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text: { type: 'text', label: 'Text', default: 'BE RIGHT BACK' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'The show continues shortly' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#6366f1' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
      style: { type: 'select', label: 'Pattern Style', default: 'geometric', options: ['geometric', 'dots'] },
    },
  },

  tech_difficulties: {
    component: TechDifficulties,
    meta: {
      name: 'Technical Difficulties',
      description: 'Retro TV static with colour bars — standby screen',
      category: 'broadcast',
      defaultDuration: 30,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text: { type: 'text', label: 'Text', default: 'TECHNICAL DIFFICULTIES' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Please stand by — we\'ll be back shortly' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#ef4444' },
      background: { type: 'color', label: 'Background', default: '#111111' },
    },
  },

  hashtag_wall: {
    component: HashtagWall,
    meta: {
      name: 'Hashtag Wall',
      description: 'Display hashtag with rotating audience posts',
      category: 'social',
      defaultDuration: 20,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      hashtag: { type: 'text', label: 'Hashtag', default: '#BootsNBeats' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Share your photos!' },
      posts: { type: 'textarea', label: 'Posts (one per line)', default: 'Having an amazing time! 🎶\nBest night out in Ayr! 🔥\nThis DJ is incredible 🎧\nLoving the vibes tonight ✨\nAyr Pavilion goes OFF 🎉' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#e1306c' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
    },
  },

  qr_overlay: {
    component: QROverlay,
    meta: {
      name: 'QR Overlay',
      description: 'Persistent QR code overlay with call-to-action',
      category: 'overlays',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      url: { type: 'text', label: 'URL', default: 'ayrpavilion.co.uk' },
      label: { type: 'text', label: 'Label', default: 'SCAN ME' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Book tickets online' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#3b82f6' },
      position: { type: 'select', label: 'Position', default: 'bottom-right', options: ['bottom-right', 'bottom-left', 'top-right', 'top-left'] },
      background: { type: 'color', label: 'Background', default: 'transparent' },
    },
  },

  wifi_info: {
    component: WifiInfo,
    meta: {
      name: 'WiFi Info',
      description: 'Display WiFi network name and password with animated icon',
      category: 'social',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      networkName: { type: 'text', label: 'Network Name', default: 'AyrPavilion-Guest' },
      password: { type: 'text', label: 'Password', default: 'BootsNBeats2026' },
      message: { type: 'text', label: 'Message', default: 'FREE WIFI' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#22d3ee' },
      background: { type: 'color', label: 'Background', default: '#0a0a0a' },
    },
  },

  country_night: {
    component: CountryNight,
    meta: {
      name: 'Country Night',
      description: 'Western themed title card — boots, guitar, warm tones',
      category: 'themed',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'BOOTS N BEATS' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Country Night at Ayr Pavilion' },
      date: { type: 'text', label: 'Date', default: 'Every Saturday' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#d97706' },
      background: { type: 'color', label: 'Background', default: '#1a0f00' },
    },
  },

  club_night: {
    component: ClubNight,
    meta: {
      name: 'Club Night',
      description: 'Pulsing neon, laser beams, equalizer — nightclub aesthetic',
      category: 'themed',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'CLUB NIGHT' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Ayr Pavilion' },
      date: { type: 'text', label: 'Date', default: 'THIS FRIDAY' },
      color1: { type: 'color', label: 'Color 1', default: '#ff00ff' },
      color2: { type: 'color', label: 'Color 2', default: '#00ffff' },
      color3: { type: 'color', label: 'Color 3', default: '#ff0066' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  comedy_night: {
    component: ComedyNight,
    meta: {
      name: 'Comedy Night',
      description: 'Spotlight, mic, brick wall — comedy club aesthetic',
      category: 'themed',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'COMEDY NIGHT' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Live at Ayr Pavilion' },
      comedian: { type: 'text', label: 'Featuring', default: 'Featuring: Top Scottish Comics' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#fbbf24' },
      background: { type: 'color', label: 'Background', default: '#1a1008' },
    },
  },

  family_fun: {
    component: FamilyFun,
    meta: {
      name: 'Family Fun Day',
      description: 'Bright, playful balloons and confetti — kids and family events',
      category: 'themed',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'FAMILY FUN DAY' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Ayr Pavilion' },
      details: { type: 'text', label: 'Details', default: 'Games • Face Painting • Live Music • Food' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#f472b6' },
      secondaryColor: { type: 'color', label: 'Secondary Color', default: '#a78bfa' },
      background: { type: 'color', label: 'Background', default: '#fef3c7' },
    },
  },
  // ═══════════════════════════════════════════════
  // NAR BRANDED COMPOSITIONS
  // ═══════════════════════════════════════════════

  nar_station_ident: {
    component: NARStationIdent,
    meta: {
      name: 'NAR Station Ident',
      description: 'Full animated NOW AYRSHIRE RADIO station ident with particles, wave visualizer and tagline',
      category: 'branded',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      tagline: { type: 'text', label: 'Tagline', default: 'Made in Ayrshire… for Ayrshire' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_show_banner: {
    component: NARShowBanner,
    meta: {
      name: 'NAR Show Banner',
      description: 'Show title card with presenter name, time, glass panel and LIVE indicator',
      category: 'branded',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      showName: { type: 'text', label: 'Show Name', default: 'Ali & Michael in the Morning' },
      presenterName: { type: 'text', label: 'Presenter', default: 'Ali & Michael' },
      showTime: { type: 'text', label: 'Show Time', default: '6AM - 10AM' },
      style: { type: 'select', label: 'Style', default: 'morning', options: ['morning', 'evening', 'weekend'] },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_now_playing: {
    component: NARNowPlaying,
    meta: {
      name: 'NAR Now Playing',
      description: 'Currently playing track with vinyl record animation and progress bar',
      category: 'branded',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      artistName: { type: 'text', label: 'Artist', default: 'Arctic Monkeys' },
      trackTitle: { type: 'text', label: 'Track', default: 'Do I Wanna Know?' },
      albumColor: { type: 'color', label: 'Album Color', default: '#F7941D' },
      progress: { type: 'number', label: 'Progress %', default: 65, min: 0, max: 100 },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_breaking_news: {
    component: NARBreakingNews,
    meta: {
      name: 'NAR Breaking News',
      description: 'Breaking news alert with red flash, stamp animation and scrolling ticker',
      category: 'branded',
      defaultDuration: 12,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      headline: { type: 'text', label: 'Headline', default: 'Major community event announced for Ayr seafront this summer' },
      category: { type: 'text', label: 'Category', default: 'LOCAL NEWS' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_weather: {
    component: NARWeather,
    meta: {
      name: 'NAR Weather',
      description: 'Weather display with animated icons, temperature and 3-day forecast',
      category: 'branded',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      temperature: { type: 'text', label: 'Temperature', default: '14' },
      condition: { type: 'text', label: 'Condition', default: 'Partly Cloudy' },
      location: { type: 'text', label: 'Location', default: 'Ayr, Scotland' },
      forecast: { type: 'text', label: 'Forecast (Day Temp|...)', default: 'Mon 12°|Tue 14°|Wed 11°' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_social_feed: {
    component: NARSocialFeed,
    meta: {
      name: 'NAR Social Feed',
      description: 'Social media callout with glassmorphism card and floating hearts',
      category: 'branded',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      platform: { type: 'select', label: 'Platform', default: 'instagram', options: ['instagram', 'twitter', 'facebook', 'tiktok'] },
      handle: { type: 'text', label: 'Handle', default: '@NowAyrshireRadio' },
      message: { type: 'text', label: 'Message', default: 'Tune in now for the best local music! 🎶 #NowAyrshireRadio' },
      username: { type: 'text', label: 'Username', default: 'ListenerMike' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  nar_countdown: {
    component: NARCountdown,
    meta: {
      name: 'NAR Countdown',
      description: 'Show countdown with animated ring, big numbers and pulsing anticipation',
      category: 'branded',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      showName: { type: 'text', label: 'Show Name', default: 'The Evening Show' },
      minutes: { type: 'number', label: 'Minutes', default: 5, min: 0, max: 60 },
      seconds: { type: 'number', label: 'Seconds', default: 0, min: 0, max: 59 },
      promoText: { type: 'text', label: 'Promo Text', default: 'With DJ Sarah — Music, Chat & Local News' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  // ═══════════════════════════════════════════════
  // PREMIUM BROADCAST COMPOSITIONS
  // ═══════════════════════════════════════════════

  cinematic_reveal: {
    component: CinematicReveal,
    meta: {
      name: 'Cinematic Reveal',
      description: 'Hollywood-grade title reveal with lens flare, light streaks and particle dust',
      category: 'titles',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      title: { type: 'text', label: 'Title', default: 'EPIC TITLE' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'The Story Begins' },
      color: { type: 'color', label: 'Text Color', default: '#ffffff' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#FFD700' },
      background: { type: 'color', label: 'Background', default: '#000000' },
    },
  },

  audio_spectrum_3d: {
    component: AudioSpectrum3D,
    meta: {
      name: 'Audio Spectrum 3D',
      description: 'Fake 3D audio spectrum with perspective bars, gradient and floor reflection',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      barCount: { type: 'number', label: 'Bar Count', default: 32, min: 8, max: 64 },
      color1: { type: 'color', label: 'Color 1', default: '#00a8ff' },
      color2: { type: 'color', label: 'Color 2', default: '#ff3366' },
      floorColor: { type: 'color', label: 'Floor Color', default: '#111' },
      background: { type: 'color', label: 'Background', default: '#000000' },
      beatSpeed: { type: 'number', label: 'Beat Speed', default: 1, min: 0.1, max: 5 },
    },
  },

  data_dashboard: {
    component: DataDashboard,
    meta: {
      name: 'Data Dashboard',
      description: 'Animated stats display with 4 KPI boxes, count-up numbers and sparklines',
      category: 'broadcast',
      defaultDuration: 10,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      kpi1Label: { type: 'text', label: 'KPI 1 Label', default: 'Listeners' },
      kpi1Value: { type: 'number', label: 'KPI 1 Value', default: 12847 },
      kpi2Label: { type: 'text', label: 'KPI 2 Label', default: 'Requests' },
      kpi2Value: { type: 'number', label: 'KPI 2 Value', default: 342 },
      kpi3Label: { type: 'text', label: 'KPI 3 Label', default: 'Songs Played' },
      kpi3Value: { type: 'number', label: 'KPI 3 Value', default: 1856 },
      kpi4Label: { type: 'text', label: 'KPI 4 Label', default: 'Hours Live' },
      kpi4Value: { type: 'number', label: 'KPI 4 Value', default: 4200 },
      title: { type: 'text', label: 'Title', default: 'LIVE STATS' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#00a8ff' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  split_screen_wipe: {
    component: SplitScreenWipe,
    meta: {
      name: 'Split Screen Wipe',
      description: 'Animated split-screen transition with diagonal wipe and VS badge',
      category: 'effects',
      defaultDuration: 6,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      leftText: { type: 'text', label: 'Left Text', default: 'BEFORE' },
      rightText: { type: 'text', label: 'Right Text', default: 'AFTER' },
      leftColor: { type: 'color', label: 'Left Color', default: '#00a8ff' },
      rightColor: { type: 'color', label: 'Right Color', default: '#ff3366' },
      barColor: { type: 'color', label: 'Bar Color', default: '#FFD700' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  parallax_slideshow: {
    component: ParallaxSlideshow,
    meta: {
      name: 'Parallax Slideshow',
      description: 'Multi-layer parallax with drifting shapes, scrolling text and foreground particles',
      category: 'backgrounds',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      text1: { type: 'text', label: 'Main Text', default: 'BROADCAST' },
      text2: { type: 'text', label: 'Sub Text', default: 'STUDIO' },
      text3: { type: 'text', label: 'Accent Text', default: 'LIVE' },
      color1: { type: 'color', label: 'Color 1', default: '#00a8ff' },
      color2: { type: 'color', label: 'Color 2', default: '#ff3366' },
      color3: { type: 'color', label: 'Color 3', default: '#FFD700' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  glassmorphism_clock: {
    component: GlassmorphismClock,
    meta: {
      name: 'Glassmorphism Clock',
      description: 'Frosted glass clock face with smooth hands, date display and animated background blobs',
      category: 'utility',
      defaultDuration: 30,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      hours: { type: 'number', label: 'Hours', default: 10, min: 0, max: 23 },
      minutes: { type: 'number', label: 'Minutes', default: 8, min: 0, max: 59 },
      seconds: { type: 'number', label: 'Seconds', default: 30, min: 0, max: 59 },
      dateText: { type: 'text', label: 'Date Text', default: 'Tuesday, 18 March 2026' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#00a8ff' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },

  electric_border: {
    component: ElectricBorder,
    meta: {
      name: 'Electric Border',
      description: 'Animated electric lightning border frame overlay with crackling energy',
      category: 'overlays',
      defaultDuration: 15,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      color: { type: 'color', label: 'Color', default: '#00a8ff' },
      intensity: { type: 'number', label: 'Intensity', default: 5, min: 1, max: 10 },
      background: { type: 'color', label: 'Background', default: 'transparent' },
    },
  },

  minimal_end_card: {
    component: MinimalEndCard,
    meta: {
      name: 'Minimal End Card',
      description: 'Clean end card with thank you message, brand logo and social links',
      category: 'broadcast',
      defaultDuration: 8,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    schema: {
      message: { type: 'text', label: 'Message', default: 'Thank you for listening' },
      brandName: { type: 'text', label: 'Brand Name', default: 'NOW AYRSHIRE RADIO' },
      socialLine: { type: 'text', label: 'Social', default: '@NowAyrshireRadio' },
      website: { type: 'text', label: 'Website', default: 'nowayrshireradio.com' },
      style: { type: 'select', label: 'Style', default: 'elegant', options: ['elegant', 'vibrant'] },
      accentColor: { type: 'color', label: 'Accent Color', default: '#00a8ff' },
      background: { type: 'color', label: 'Background', default: '#1E2A35' },
    },
  },
};

// Get all compositions as array with IDs
export function getCompositionList() {
  return Object.entries(compositions).map(([id, comp]) => ({
    id,
    ...comp.meta,
  }));
}

// Get categories
export function getCompositionCategories() {
  const cats = {};
  Object.entries(compositions).forEach(([id, comp]) => {
    const cat = comp.meta.category;
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push({ id, ...comp.meta });
  });
  return cats;
}

// Get a specific composition
export function getComposition(id) {
  return compositions[id] || null;
}

export default compositions;
