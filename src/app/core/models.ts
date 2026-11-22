export type SplitMode = 'equal' | 'ratio' | 'custom';

export type StopType = 'flight' | 'hotel' | 'place' | 'food' | 'shop' | 'transit' | 'other';
export type TravelMode = '' | 'mrt' | 'walk' | 'bus' | 'tram' | 'taxi' | 'ferry' | 'train' | 'other';

/** 站點裡的小清單（例如「灣仔美食」裡的 5 家店） */
export interface Sub {
  name: string;
  hours: string;
  note: string;
  done: boolean;
  photo?: string; // 招牌菜圖片網址（選填）
}

export interface Item {
  id: string;
  day: string; // 'YYYY-MM-DD' 或 'pool'（備選）
  type: StopType;
  title: string;
  time: string; // 'HH:mm' 或空字串（航班＝起飛時間）
  endTime: string; // 航班抵達時間，其他站留空
  stay: number; // 預計停留（分鐘），0＝不填
  hours: string; // 營業時間
  address: string;
  note: string;
  done: boolean;
  order: number;
  travelMode: TravelMode; // 從「上一站」過來的交通
  travelMin: number; // 交通時間（分鐘），0＝不填
  travelNote?: string; // 這段交通的說明（搭哪條線、哪個出口、走多遠），顯示在時間軸的交通列下面
  travelLabel?: string; // travelMode 是 'other' 時，使用者自己輸入的交通方式名稱
  subs: Sub[];
  photos?: string[]; // 招牌菜或門面圖片網址（選填，外部連結）
}

export interface Expense {
  id: string;
  payer: string;
  item: string;
  time: string; // ISO 字串
  amount: number; // HKD（外幣會換算成港幣後存這裡，所有結算都用它）
  currency?: string; // 付款時的幣別代碼（HKD、TWD、USD、CNY…），沒有＝HKD
  orig?: number; // 付款幣別的原始金額（currency 不是 HKD 時才有）
  rate?: number; // 1 單位該幣別＝多少港幣（記帳當下使用的匯率）
  category?: string; // food / transport / stay / ticket / shop / other；沒有＝依品名猜
  mode: SplitMode;
  participants: string[];
  weights: Record<string, number>; // ratio 用：比例；custom 用：自填金額
  shares: Record<string, number>; // 每人實際分攤金額（已算好）
}

/** 筆記卡片裡的一列。kind：check 勾選、line 標題＋說明、place 名稱＋備註＋電話、kv 欄位＋內容、alert 彩色圓形圖示的提醒、rate 黃色橫條（欄位＋內容） */
export type NoteRowKind = 'check' | 'line' | 'place' | 'kv' | 'alert' | 'rate';
export interface NoteRow {
  kind: NoteRowKind;
  a: string; // check/line/place：主文字；kv：欄位名
  b: string; // line：說明；place：地區·備註；kv：內容
  c: string; // place：電話
  done: boolean; // check 用
  icon?: string; // line/alert 用：左側小圖示
  url?: string; // line 用：有的話，標題會變成連結
}

export interface Note {
  id: string;
  title: string;
  category?: string; // 卡片上的小標籤，例如「住宿」
  icon?: string; // 卡片標題旁的圖示
  wide?: boolean; // 整排寬卡片（顯示在最上方）
  rows?: NoteRow[]; // 新版卡片內容
  content: string; // 舊版純文字（沒有 rows 時才顯示）
  url: string;
  order: number;
}

/** 行李清單：每位成員各自一份，用 owner 區分 */
export interface PackItem {
  id: string;
  owner: string;
  category: string;
  label: string;
  qty?: number; // 數量，例如衣服 ×4
  note?: string; // 右側小字，例如「香港 G 型」
  done: boolean;
  order: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}
