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
  // Aliases for flexibility
  media: VideoModule,
  youtube: IframeModule
};

export default moduleRegistry;
