import ClockModule from './ClockModule';
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
};

export default moduleRegistry;
