import { StopType, TravelMode } from '../../core/models';
import { DAYS } from '../../core/seed';

export type DayInfo = (typeof DAYS)[number];

// bg/fg：節點圓圈；bg2/fg2：卡片上的小標籤（顏色取自設計稿）
export interface TypeMeta { label: string; icon: string; bg: string; fg: string; bg2: string; fg2: string }
export const TYPES: Record<StopType, TypeMeta> = {
  flight: { label: '航班', icon: 'plane', bg: '#E7E2D2', fg: '#283845', bg2: '#FBE0CC', fg2: '#F29559' },
  hotel: { label: '住宿', icon: 'hotel', bg: '#DDEADF', fg: '#5B8C6E', bg2: '#DDEADF', fg2: '#5B8C6E' },
  food: { label: '美食', icon: 'food', bg: '#FBE0CC', fg: '#F29559', bg2: '#FBEFCB', fg2: '#B98900' },
  place: { label: '景點', icon: 'pin', bg: '#FBEFCB', fg: '#B98900', bg2: '#E7E2D2', fg2: '#283845' },
  shop: { label: '購物', icon: 'bag', bg: '#FBE0CC', fg: '#F29559', bg2: '#FBE0CC', fg2: '#F29559' },
  transit: { label: '交通', icon: 'train', bg: '#E7E2D2', fg: '#283845', bg2: '#E7E2D2', fg2: '#283845' },
  other: { label: '其他', icon: 'star', bg: '#E7E2D2', fg: '#5C6775', bg2: '#E7E2D2', fg2: '#5C6775' },
};
export const MODES: Record<Exclude<TravelMode, ''>, { label: string; icon: string }> = {
  mrt: { label: '港鐵', icon: 'train' },
  walk: { label: '步行', icon: 'footprints' },
  bus: { label: '巴士', icon: 'bus' },
  tram: { label: '叮叮', icon: 'tram' },
  taxi: { label: '計程車', icon: 'taxi' },
  ferry: { label: '渡輪', icon: 'ship' },
  train: { label: '機場快線/火車', icon: 'train' },
  other: { label: '其他（自行輸入）', icon: 'navigation' },
};

export const TYPE_OPTIONS = (Object.keys(TYPES) as StopType[]).map((id) => ({ id, label: TYPES[id].label }));
export const MODE_OPTIONS = (Object.keys(MODES) as Exclude<TravelMode, ''>[]).map((id) => ({ id, label: MODES[id].label }));

export const metaOf = (t: StopType): TypeMeta => TYPES[t] ?? TYPES.other;
export const modeIcon = (m: TravelMode) => (m ? MODES[m].icon : 'navigation');
export const modeLabel = (m: TravelMode, custom?: string) =>
  m === 'other' ? custom?.trim() || '其他' : m ? MODES[m].label : '交通';
export const dur = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} 小時${min % 60 ? ' ' + (min % 60) + ' 分' : ''}` : `${min} 分`;
export const stayShort = (min: number) => (min < 60 ? `${min}m` : `${String(+(min / 60).toFixed(1))}h`);

/** 展開卡片裡的一行：營業時間、地址、備註、店家 */
export type RowKind = 'note' | 'hours' | 'address' | 'sub';
export interface DetailRow { kind: RowKind; idx: number | null; icon: string; title: string; sub: string }
