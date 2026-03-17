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
  logo: LogoModule
};

export default moduleRegistry;
