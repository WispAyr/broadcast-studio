import ClockModule from './ClockModule';
import PavilionNowNextModule from './PavilionNowNextModule';
import PavilionTimelineModule from './PavilionTimelineModule';
import PavilionNext90Module from './PavilionNext90Module';
import PavilionWelcomeModule from './PavilionWelcomeModule';
import PavilionSafetyModule from './PavilionSafetyModule';
import PavilionSponsorModule from './PavilionSponsorModule';
import CountdownModule from './CountdownModule';
import ImageModule from './ImageModule';
import VideoModule from './VideoModule';
import TextModule from './TextModule';
import TickerModule from './TickerModule';
import IframeModule from './IframeModule';
import ColorModule from './ColorModule';
import WeatherModule from './WeatherModule';
import LogoModule from './LogoModule';
import AutocueModule from './AutocueModule';
import SocialModule from './SocialModule';
import BreakingNewsModule from './BreakingNewsModule';
import TravelModule from './TravelModule';
import WeatherRadarModule from './WeatherRadarModule';
import AircraftTrackerModule from './AircraftTrackerModule';
import CameraFeedModule from './CameraFeedModule';
import AlertTickerModule from './AlertTickerModule';
import TimeModule from './TimeModule';
import RSSModule from './RSSModule';
import NewsTickerModule from './NewsTickerModule';
import SocialEmbedModule from './SocialEmbedModule';
import WebSourceModule from './WebSourceModule';
import YouTubeModule from './YouTubeModule';
import NewsTVModule from './NewsTVModule';
import NARScheduleModule from './NARScheduleModule';
import NARNewsModule from './NARNewsModule';
import NARPartnersModule from './NARPartnersModule';
import TravelTimesModule from './TravelTimesModule';
import TravelScreenModule from './TravelScreenModule';
import SlideshowModule from './SlideshowModule';
import LiveTextModule from './LiveTextModule';
import QRCodeModule from './QRCodeModule';
import VisualizerModule from './VisualizerModule';
import RemotionModule from './RemotionModule';
import CanvaModule from './CanvaModule';
import TemplateModule from './TemplateModule';
import SurfaceCarouselModule from './SurfaceCarouselModule';


import KiltwalkerCounterModule from './KiltwalkerCounterModule';
import KiltwalkSponsorModule from './KiltwalkSponsorModule';
import KiltwalkRouteModule from './KiltwalkRouteModule';
import KiltwalkStatsModule from './KiltwalkStatsModule';
import KiltwalkTickerModule from './KiltwalkTickerModule';
import KiltwalkWeatherModule from './KiltwalkWeatherModule';
import KiltwalkCourseMapModule from './KiltwalkCourseMapModule';
import KiltwalkBumperModule from './KiltwalkBumperModule';
import KiltwalkLogoAnimModule from './KiltwalkLogoAnimModule';
import SiphonDataModule from './SiphonDataModule';
import PrismLensModule from './PrismLensModule';
import EMGlobeModule from './EMGlobeModule';
import Go2rtcFeedModule from './Go2rtcFeedModule';
import IngestFeedModule from './IngestFeedModule';
import IngestGridModule from './IngestGridModule';
import CallGuestModule from './CallGuestModule';
import CallGridModule from './CallGridModule';
import TrafficAyrshireModule from './TrafficAyrshireModule';
import NARNowPlayingModule from './NARNowPlayingModule';
import NARFuelModule from './NARFuelModule';
import NARTrainsModule from './NARTrainsModule';
import NARWarningsModule from './NARWarningsModule';
import QuizModule from './QuizModule';
import AudioModule from './AudioModule';

const moduleRegistry = {
  clock: ClockModule,
  countdown: CountdownModule,
  image: ImageModule,
  video: VideoModule,
  text: TextModule,
  ticker: TickerModule,
  iframe: IframeModule,
  color: ColorModule,
  weather: WeatherModule,
  logo: LogoModule,
  autocue: AutocueModule,
  social: SocialModule,
  breaking_news: BreakingNewsModule,
  travel: TravelModule,
  weather_radar: WeatherRadarModule,
  aircraft_tracker: AircraftTrackerModule,
  camera_feed: CameraFeedModule,
  alert_ticker: AlertTickerModule,
  // New modules
  time_local: TimeModule,
  rss_feed: RSSModule,
  news_ticker: NewsTickerModule,
  social_embed: SocialEmbedModule,
  web_source: WebSourceModule,
  youtube_player: YouTubeModule,
  // Aliases for flexibility
  media: VideoModule,
  youtube: YouTubeModule,
  travel_screen: TravelScreenModule,
  news_tv: NewsTVModule,
  nar_schedule: NARScheduleModule,
  nar_news: NARNewsModule,
  nar_sport: NARNewsModule,     // Same module, different default config
  nar_partners: NARPartnersModule,
  travel_times: TravelTimesModule,
  slideshow: SlideshowModule,
  live_text: LiveTextModule,
  qrcode: QRCodeModule,
  visualizer: VisualizerModule,
  remotion: RemotionModule,
  canva: CanvaModule,
  template: TemplateModule,    // Live template composition player
  surface_carousel: SurfaceCarouselModule,  // Rotating iframe carousel — office wall views from live.wispayr.online
  // Kiltwalk event modules
  kiltwalk_finish: KiltwalkerCounterModule,
  'kiltwalk-finisher-counter': KiltwalkerCounterModule,
  'kiltwalk-sponsor-rotation': KiltwalkSponsorModule,
  'kiltwalk-route-progress': KiltwalkRouteModule,
  'kiltwalk-hourly-stats': KiltwalkStatsModule,
  'kiltwalk-charity-ticker': KiltwalkTickerModule,
  'kiltwalk-weather-compact': KiltwalkWeatherModule,
  'kiltwalk-live-camera': CameraFeedModule,
  'kiltwalk-course-map': KiltwalkCourseMapModule,
  'kiltwalk-bumper': KiltwalkBumperModule,
  'kiltwalk-logo-anim': KiltwalkLogoAnimModule,
  'kiltwalk-ident': KiltwalkLogoAnimModule,
  'siphon-data': SiphonDataModule,
  'siphon-weather': SiphonDataModule,
  'siphon-aqi': SiphonDataModule,
  'siphon-marine': SiphonDataModule,
  'siphon-radiation': SiphonDataModule,
  'siphon-grid': SiphonDataModule,
  'siphon-proton': SiphonDataModule,
  // Generic prism lens consumer — one module, configurable endpoint+display.
  // Use this instead of bespoke per-source modules.
  'prism-lens': PrismLensModule,
  // EM Globe embed (em.wispayr.online) with preset / layer / cam URL params.
  'em-globe': EMGlobeModule,
  'em-globe-space-weather': EMGlobeModule,
  'em-globe-aurora': EMGlobeModule,
  'em-globe-solar-wind': EMGlobeModule,
  'em-globe-satellites': EMGlobeModule,
  'em-globe-near-earth': EMGlobeModule,
  'em-globe-seismic': EMGlobeModule,
  'em-globe-flare-ops': EMGlobeModule,
  'em-globe-cycle': EMGlobeModule,
  // go2rtc feed (WebRTC / MSE / MP4) — defaults to localhost:1984 for on-host displays (e.g. bravo)
  go2rtc: Go2rtcFeedModule,
  'go2rtc-feed': Go2rtcFeedModule,
  'go2rtc-bravo': Go2rtcFeedModule,
  // Ingest Centre — phone, YouTube, HLS, RTMP, iframe
  'ingest-feed': IngestFeedModule,
  ingest: IngestFeedModule,
  // Live mosaic of all active ingest slots
  'ingest-grid': IngestGridModule,
  'fanzone-grid': IngestGridModule,
  // studio-call — two-way remote video callers (LiveKit SFU)
  'call-guest': CallGuestModule,
  'call-grid': CallGridModule,
  // Pavilion Festival 2026
  pavilion_now_next: PavilionNowNextModule,
  pavilion_timeline: PavilionTimelineModule,
  pavilion_next_90: PavilionNext90Module,
  pavilion_welcome: PavilionWelcomeModule,
  pavilion_safety: PavilionSafetyModule,
  pavilion_sponsor: PavilionSponsorModule,
  // NAR Travel — embedded studio view
  traffic_ayrshire: TrafficAyrshireModule,
  // NAR live now-playing (broadcast.radio station 7719) — spinning vinyl + history
  nar_nowplaying: NARNowPlayingModule,
  now_playing: NARNowPlayingModule,
  // Cheapest fuel in Ayrshire (fuel.wispayr.online) — drivetime content
  nar_fuel: NARFuelModule,
  // Live ScotRail Ayr departures (trains.wispayr.online)
  nar_trains: NARTrainsModule,
  // Met Office weather warnings for Ayrshire (live.wispayr.online/api/wx/warnings)
  nar_warnings: NARWarningsModule,
  // QuizCast — live audience quiz (quiz.wispayr.online). screen=game view, join=scan-to-join card
  quiz: QuizModule,
  quizcast: QuizModule,
  // Audio bed / playout player — music bed, ducks under stings
  audio: AudioModule,
  audio_bed: AudioModule,
  music_bed: AudioModule,
};

export default moduleRegistry;
