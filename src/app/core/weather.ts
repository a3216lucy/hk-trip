import { Injectable, signal } from '@angular/core';
import { DAYS } from './seed';

export interface DayWeather { label: string; icon: string; min: number; max: number }

/** 各日期的天氣預報（Open-Meteo，免費、不用金鑰）。抓不到就是空的，畫面不顯示。 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly data = signal<Record<string, { code: number; min: number; max: number } | undefined>>({});

  constructor() {
    void this.load();
  }

  private async load() {
    const dates = DAYS.filter((d) => d.date !== 'pool').map((d) => d.date);
    try {
      // 只送出香港座標與日期區間，不含任何個人資料。距離出發超過約 16 天時，服務不會回傳預報。
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=22.3193&longitude=114.1694' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FHong_Kong' +
        `&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const j = (await res.json()) as {
        daily?: { time: string[]; weather_code: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] };
      };
      const d = j.daily;
      if (!d) return;
      const out: Record<string, { code: number; min: number; max: number }> = {};
      d.time.forEach((t, i) => {
        const code = d.weather_code[i], max = d.temperature_2m_max[i], min = d.temperature_2m_min[i];
        if (code != null && max != null && min != null) out[t] = { code, max: Math.round(max), min: Math.round(min) };
      });
      this.data.set(out);
    } catch {
      /* 沒網路或服務失敗：不顯示天氣 */
    }
  }

  of(date: string): DayWeather | null {
    const w = this.data()[date];
    if (!w) return null;
    const c = w.code;
    const [label, icon] =
      c === 0 ? ['晴', 'sun'] : c <= 2 ? ['晴時多雲', 'weather'] : c === 3 ? ['陰', 'cloud']
      : c <= 48 ? ['有霧', 'fog'] : c <= 67 ? ['雨', 'rain'] : c <= 77 ? ['雪', 'snow']
      : c <= 82 ? ['陣雨', 'rain'] : ['雷雨', 'storm'];
    return { label, icon, min: w.min, max: w.max };
  }
}
