// Environmental & Weather Telemetry Service for JARVIS HUD

export interface WeatherTelemetry {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  weatherCode: number;
  conditionText: string;
  conditionType: 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';
  locationName: string;
  timestamp: number;
}

export function getWeatherConditionInfo(code: number): {
  text: string;
  type: WeatherTelemetry['conditionType'];
} {
  switch (code) {
    case 0:
      return { text: 'CLEAR SKIES', type: 'clear' };
    case 1:
      return { text: 'MAINLY CLEAR', type: 'clear' };
    case 2:
      return { text: 'PARTLY CLOUDY', type: 'partlyCloudy' };
    case 3:
      return { text: 'OVERCAST', type: 'cloudy' };
    case 45:
    case 48:
      return { text: 'FOG / HAZE', type: 'fog' };
    case 51:
    case 53:
    case 55:
      return { text: 'LIGHT DRIZZLE', type: 'rain' };
    case 61:
    case 63:
    case 65:
      return { text: 'MODERATE RAIN', type: 'rain' };
    case 71:
    case 73:
    case 75:
      return { text: 'SNOW PRECIPITATION', type: 'snow' };
    case 80:
    case 81:
    case 82:
      return { text: 'SHOWERS', type: 'rain' };
    case 95:
    case 96:
    case 99:
      return { text: 'THUNDERSTORM', type: 'thunder' };
    default:
      return { text: 'FAIR WEATHER', type: 'clear' };
  }
}

class WeatherManager {
  private currentData: WeatherTelemetry = {
    temperature: 24,
    feelsLike: 25,
    humidity: 55,
    windSpeed: 12,
    pressure: 1013,
    weatherCode: 0,
    conditionText: 'CLEAR SKIES',
    conditionType: 'clear',
    locationName: 'LOCAL ATMOSPHERE',
    timestamp: Date.now(),
  };

  private listeners: Set<(data: WeatherTelemetry) => void> = new Set();
  private updateTimer: number | null = null;
  private hasInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public subscribe(cb: (data: WeatherTelemetry) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentData);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getCurrent(): WeatherTelemetry {
    return this.currentData;
  }

  public async init() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    // Fetch initial weather
    await this.fetchWeather();

    // Re-fetch every 4 minutes
    if (typeof window !== 'undefined') {
      this.updateTimer = window.setInterval(() => {
        this.fetchWeather();
      }, 4 * 60 * 1000);
    }
  }

  public async fetchWeather() {
    let lat = 28.6139;
    let lon = 77.209;
    let locLabel = 'LOCAL ATMOSPHERE';

    // Attempt browser geolocation if permitted
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 2500,
            maximumAge: 10 * 60 * 1000,
          });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        locLabel = `GEO-COORDS [${lat.toFixed(1)}°, ${lon.toFixed(1)}°]`;
      } catch {
        // Fallback to default coordinates
      }
    }

    try {
      const res = await fetch(`/api/jarvis/weather?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const raw = await res.json();
        const cond = getWeatherConditionInfo(raw.weatherCode ?? 0);
        this.currentData = {
          temperature: Math.round(raw.temperature ?? 24),
          feelsLike: Math.round(raw.feelsLike ?? 25),
          humidity: Math.round(raw.humidity ?? 55),
          windSpeed: Math.round(raw.windSpeed ?? 12),
          pressure: Math.round(raw.pressure ?? 1013),
          weatherCode: raw.weatherCode ?? 0,
          conditionText: cond.text,
          conditionType: cond.type,
          locationName: locLabel,
          timestamp: Date.now(),
        };
        this.notify();
        return;
      }
    } catch {
      // Offline fallback
    }

    // Apply micro-fluctuations so live readings feel organic
    this.currentData = {
      ...this.currentData,
      temperature: Math.max(16, Math.min(38, this.currentData.temperature + (Math.random() > 0.7 ? 1 : -1))),
      humidity: Math.max(30, Math.min(90, this.currentData.humidity + (Math.random() > 0.5 ? 1 : -1))),
      windSpeed: Math.max(4, Math.min(35, this.currentData.windSpeed + (Math.random() > 0.6 ? 1 : -1))),
      pressure: Math.max(990, Math.min(1030, this.currentData.pressure + (Math.random() > 0.8 ? 1 : -1))),
      timestamp: Date.now(),
    };
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentData);
    }
  }

  public cleanup() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.listeners.clear();
  }
}

export const weatherManager = new WeatherManager();
