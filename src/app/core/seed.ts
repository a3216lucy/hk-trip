import { Item, Note, NoteRow, StopType, Sub, TravelMode } from './models';
import { applyInfo } from './place-info';

type S<T> = Omit<T, 'id'>;
let o = 0;

interface Opt {
  time?: string;
  endTime?: string;
  stay?: number;
  hours?: string;
  address?: string;
  note?: string;
  mode?: TravelMode;
  min?: number;
  subs?: Sub[];
  photos?: string[];
}
const stop = (day: string, type: StopType, title: string, p: Opt = {}): S<Item> => ({
  day,
  type,
  title,
  time: p.time ?? '',
  endTime: p.endTime ?? '',
  stay: p.stay ?? 0,
  hours: p.hours ?? '',
  address: p.address ?? '',
  note: p.note ?? '',
  done: false,
  order: ++o,
  travelMode: p.mode ?? '',
  travelMin: p.min ?? 0,
  subs: p.subs ?? [],
  ...(p.photos ? { photos: p.photos } : {}),
});
const sub = (name: string, hours = '', note = '', photo = ''): Sub => ({ name, hours, note, done: false, ...(photo ? { photo } : {}) });

/** 每位成員第一次打開行李清單時建立的預設清單（內容取自你的設計稿）。 */
export const PACK_DEFAULT: {
  category: string;
  items: { label: string; qty?: number; note?: string }[];
}[] = [
  {
    category: '隨身包（登機）',
    items: [
      { label: '護照 / 台胞證' },
      { label: '錢包 ・ 現金 HK$' },
      { label: '手機 + 充電線' },
      { label: '行動電源', note: '只能隨身帶，不可託運' },
      { label: '耳機', note: '含鋰電池，建議隨身帶' },
      { label: '口罩 ・ 濕紙巾' },
      { label: '行程表（截圖）' },
      { label: '信用卡 ・ 提款卡' },
      { label: '面紙' }, { label: '行李秤' },
    ],
  },
  {
    category: '電子用品',
    items: [
      { label: '萬用轉接頭', note: '香港 G 型' },
      { label: '充電器 ・ 線材' },
      { label: '相機 + 記憶卡' },
    ],
  },
  {
    category: '衣物',
    items: [
      { label: '外套', qty: 1 },
      { label: '上衣', qty: 4 },
      { label: '褲子', qty: 2 },
      { label: '內衣褲 ・ 襪', qty: 4 },
      { label: '薄圍巾' },
      { label: '帽子' },
      { label: '睡衣 ・ 拖鞋' },
      { label: '太陽眼鏡' },
    ],
  },
  {
    category: '證件文件',
    items: [
      { label: '護照（效期 6 個月）' },
      { label: '台胞證' },
      { label: '機票訂位代號' },
      { label: '飯店訂房確認' },
      { label: '旅遊平安險' },
      { label: '護照影本（或電子檔）' },
      { label: 'eSIM（QR code 截圖）' },
    ],
  },
  {
    category: '盥洗保養',
    items: [
      { label: '牙刷 ・ 牙膏' },
      { label: '保養品（分裝）' },
      { label: '隱形眼鏡 ・ 藥水' },
      { label: '防曬乳' },
      { label: '保濕乳液 ・ 護唇膏' },
      { label: '洗臉巾' },
      { label: '梳子 ・ 髮圈' },
      { label: '旅行用蓮蓬頭' },
      { label: '擦髮巾' },
    ],
  },
  {
    category: '藥品雜物',
    items: [
      { label: '個人常備藥' },
      { label: '胃藥 ・ 止痛藥' },
      { label: 'OK 繃' },
      { label: '折疊傘' },
      { label: '購物袋（可折）' },
      { label: '密封袋' },
      { label: '行李鎖 ・ 行李標籤' },
    ],
  },
];

export const HOTEL_ADDR = '43 Heung Yip Road, Wong Chuk Hang, 港島南區';

export const DAYS: {
  date: string;
  short: string;
  md: string;
  wk: string;
  tag: string;
  blurb: string;
}[] = [
  {
    date: '2026-11-24',
    md: '11/24',
    wk: '（二）',
    short: '11/24 二',
    tag: '抵達日',
    blurb: '第 1 天 · 桃園 → 香港，下午抵達',
  },
  {
    date: '2026-11-25',
    md: '11/25',
    wk: '（三）',
    short: '11/25 三',
    tag: '港島日',
    blurb: '第 2 天 · 港島',
  },
  {
    date: '2026-11-26',
    md: '11/26',
    wk: '（四）',
    short: '11/26 四',
    tag: '九龍日',
    blurb: '第 3 天 · 九龍',
  },
  {
    date: '2026-11-27',
    md: '11/27',
    wk: '（五）',
    short: '11/27 五',
    tag: '回程日',
    blurb: '第 4 天 · 香港 → 桃園',
  },
  {
    date: 'pool',
    md: '備選',
    wk: '未排',
    short: '備選',
    tag: '備選',
    blurb: '還沒決定放哪一天的點',
  },
];

const D1 = '2026-11-24',
  D2 = '2026-11-25',
  D3 = '2026-11-26',
  D4 = '2026-11-27',
  POOL = 'pool';
const ADDR_HOTEL = '43 Heung Yip Road, Wong Chuk Hang, 港島南區';
const FROM_POST = '營業時間來自貼文';

// 交通時間都是估計值，出發前請用 Google Maps 或 MTR Mobile 確認。
const RAW_ITEMS: S<Item>[] = [
  // 11/24 抵達日
  stop(D1, 'flight', 'HX253 台北 → 香港', {
    time: '11:45',
    endTime: '13:55',
    note: '桃園 TPE → 香港 HKG，飛行約 2 小時 10 分。每人托運 1 件（23 公斤）。',
  }),
  stop(D1, 'hotel', '入住 雅格飯店', {
    address: ADDR_HOTEL,
    mode: 'train',
    min: 80,
    note: '三人房 · 入住 11/24（二）→ 退房 11/27（五）\n機場快線到香港站 → 港鐵到金鐘 → 南港島線到黃竹坑。行李多可考慮計程車。純住宿不含餐，放完行李稍作休息再出門。',
  }),
  stop(D1, 'food', "Owl's 泡芙（尖沙咀）*", {
    photos: ['https://prod-pics.guide.michelin.com/api/public/content/93183fdba8dc493f872630fc383d35a8.jpeg?format=jpeg&w=600&h=600'],
    stay: 30,
    hours: '15:00–21:00',
    address: '尖沙咀麼地道 32 號地下',
    mode: 'mrt',
    min: 60,
    note: '* 同伴想去。只外帶，現做限量，約 19–20 點就賣完，傍晚前買最保險。11/24 是週二，有營業。放完行李直接來尖沙咀。',
  }),
  stop(D1, 'place', '維多利亞港（搭張保仔號）*', {
    photos: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Hong_Kong_%2826379549654%29.jpg/1280px-Hong_Kong_%2826379549654%29.jpg'],
    stay: 75,
    address: '尖沙咀 1 號碼頭',
    mode: 'walk',
    min: 10,
    note: '第一天傍晚到晚上去，晚間場次約 17:30–20:30 出發，登船點多數來源寫尖沙咀 1 號碼頭。先訂票。累了就跳過。\n* 同伴的攻略：搭船前後可以走尖沙咀海濱長廊、星光大道（免費，有麥兜雕像），也可以看夕陽與夜景。',
  }),
  stop(D1, 'food', '尖沙咀海濱散步與街邊小吃', {
    stay: 60,
    mode: 'walk',
    min: 5,
    note: '少量多餐：隨意買魚蛋、雞蛋仔或茶餐廳輕食墊胃，不排大餐，保留體力。',
  }),
  stop(D1, 'hotel', '回飯店休息', {
    address: ADDR_HOTEL,
    mode: 'mrt',
    min: 50,
    note: '吃完早點回飯店休息，隔天 11/25 要走比較多路。',
  }),

  // 11/25 港島日
  stop(D2, 'hotel', '從雅格飯店出發', {
    time: '11:00',
    address: ADDR_HOTEL,
    note: '港鐵黃竹坑站（南港島線），轉港島線到上環。睡晚一點再出門。',
  }),
  stop(D2, 'food', '龍邦燒味小廚茶餐廳*', {
    photos: ['https://itin-dev.wanderlogstatic.com/freeImageSmall/p2XgqQjLEPVY1MuP0ZMggOmywkcrRlqj'],
    stay: 45,
    hours: '07:00–22:00',
    address: '上環文咸東街 38 號地下 B 鋪',
    mode: 'mrt',
    min: 35,
    note: '* 同伴想去。燒臘；上環站 A2 出口步行約 1 分。少量多餐：兩人合點一盤招牌燒味拼盤（不點飯）加熱飲。',
  }),
  stop(D2, 'food', '中環街市*', {
    stay: 50,
    hours: '約 10:00–22:00，各店不同',
    address: '中環皇后大道中 93 號',
    mode: 'walk',
    min: 12,
    note: '* 同伴想去。舊街市改建的室內空間，可以逛文創小店，也可以吃，中環站旁。',
  }),
  stop(D2, 'food', '沾仔記*（必比登）', {
    photos: ['https://prod-pics.guide.michelin.com/api/public/content/26eff06bfd524b2a918e84a5205c5afc.jpeg?format=jpeg&w=600&h=600'],
    stay: 45,
    hours: '11:00–21:30',
    address: '中環威靈頓街 98 號',
    mode: 'walk',
    min: 8,
    note: '* 同伴想去。雲吞、鯪魚球、鮮牛肉；午市要排隊拼桌。少量多餐：兩人合吃一碗雲吞麵加一盤燙青菜。',
  }),
  stop(D2, 'place', 'PMQ 元創方*', {
    stay: 60,
    mode: 'walk',
    min: 12,
    note: '* 同伴想去。中環/上環的藝文空間，高挑整齊的白色建築，從沾仔記往上坡走。',
  }),
  stop(D2, 'food', 'Soft Thunder Bakery（蛋塔）*', {
    photos: ['https://static5.orstatic.com/userphoto3/photo/2X/2BBE/0GGH6C5444CD6C96DAEA9Flv.jpg'],
    stay: 20,
    hours: '09:00–20:00',
    address: '灣仔皇后大道東 31 號',
    mode: 'tram',
    min: 25,
    note: '* 同伴想去。搭復古叮叮車（中環往銅鑼灣方向）到灣仔下車，後門上車、前門刷八達通下車，不會報站，自己看站牌。灣仔店可刷卡、八達通，不收現金。',
  }),
  stop(D2, 'food', '華姐清湯腩*（必比登）', {
    stay: 45,
    hours: '11:00–22:45',
    address: '天后電氣道 13 號 A1 號舖',
    mode: 'tram',
    min: 25,
    note: '* 同伴想去。清湯牛腩粉、腩汁蘿蔔；不接受訂位，午餐高峰要排隊。少量多餐：兩人分食一碗清湯腩河粉。',
  }),
  stop(D2, 'food', '甜姨姨*', {
    stay: 40,
    hours: '13:00–24:00（最後點單 23:30）',
    address: '銅鑼灣耀華街 11 號地舖',
    mode: 'mrt',
    min: 15,
    note: '* 同伴想去。楊枝甘露、冰店；常排隊，可能不收現金，備信用卡或手機支付。',
  }),
  stop(D2, 'shop', '銅鑼灣 MINISO 蒙奇奇*（選擇性）', {
    stay: 20,
    mode: 'walk',
    min: 10,
    note: '* 同伴想去，看體力決定去不去。蒙奇奇（Monchhichi）周邊。店址與營業時間未查證，出發前再確認。',
  }),
  stop(D2, 'place', '賽馬：MB3 Members Box (Home Straight)（跑馬地）*', {
    time: '18:30',
    stay: 210,
    address: '跑馬地黃泥涌道',
    mode: 'tram',
    min: 20,
    note: '* 同伴想去。11/25（三）跑馬地有夜賽。MB3 是馬會會員專用包廂，旅客不能直接買，要會員或會員賓客；一般旅客可買公眾席約 HK$10，要年滿 18 歲、帶護照。服裝建議 Smart Casual（不穿拖鞋、短褲、背心）。夜賽日 18:00 起馬場周邊封路。先打馬會 1814 確認。',
  }),
  stop(D2, 'hotel', '回飯店休息', {
    address: ADDR_HOTEL,
    mode: 'taxi',
    min: 30,
    note: '當天最後回飯店休息。晚上收場人多，交通時間是估計值，出發前用「查路線」確認。',
  }),

  // 11/26 九龍日
  stop(D3, 'hotel', '從雅格飯店出發', {
    time: '10:30',
    address: ADDR_HOTEL,
    note: '港鐵黃竹坑站（南港島線）。睡飽再出門。',
  }),
  stop(D3, 'place', '九龍城寨公園南門*', {
    stay: 120,
    address: '九龍城寨公園 南門',
    mode: 'bus',
    min: 45,
    note: '* 同伴想去，免費，預計逛 2 小時。交通時間是估計值，出發前用 Google Maps 確認。',
  }),
  stop(D3, 'food', '一點心（太子）*', {
    photos: ['https://static6.orstatic.com/userphoto2/photo/25/1P80/0C3CY969BC4FF4DEBD0118lv.jpg?og=1'],
    stay: 60,
    hours: '09:30–24:00',
    address: '九龍太子通菜街 209A-209B 號地舖',
    mode: 'bus',
    min: 25,
    note: '* 同伴想去。少量多餐：點 2–3 籠招牌點心墊胃（蟹黃燒賣、薄皮鮮蝦餃等）。官網的分店有三間：太子通菜街 209A-209B 號地舖（這站排的）、中環擺花街 44 號地下、尖沙咀赫德道 4 號地下。哪一天順路都可以換分店吃。營業時間各分店我沒逐間核對，出發前查官網。',
  }),
  stop(D3, 'shop', 'SG 秘密花園（旺角始創中心 1 樓）*', {
    stay: 45,
    address: '旺角始創中心 1 樓',
    mode: 'walk',
    min: 15,
    note: '* 同伴想去。蒙奇奇周邊。我查不到這家店，營業時間未查證，出發前再確認是哪一間。',
  }),
  stop(D3, 'place', '旺角', {
    stay: 90,
    mode: 'walk',
    min: 5,
    note: '女人街、波鞋街、花墟、金魚街。\n* 同伴的攻略：彌敦道可以拍老式紅的士、名人牆廣告、雙層巴士，人多注意隨身物品。\n* 同伴的攻略（旺角 Citywalk）：從旺角站走，不走回頭路：618 上海街（復古文創）→ 朗豪坊（購物、拍照、超長手扶梯）→ 彌敦道 → 星際城市（數碼、相機與相紙，便宜）→ 女人街 → 信和中心（黑膠唱片、谷子）→ T.O.P（日系雜貨玩具）→ 網紅天橋（旺角站 B3 出口）→ 金魚街。這站只有 90 分鐘，挑 3–4 個就好。逛完買杯凍檸茶休息。',
  }),
  stop(D3, 'shop', '超市買伴手禮', {
    stay: 45,
    mode: 'mrt',
    min: 30,
    note: '在銅鑼灣／灣仔一帶的惠康（Wellcome）、百佳（PARKnSHOP）或 Market Place 採買，也可以回飯店附近的超市買，少提重物搭港鐵。實際店址與營業時間未查證。醬類（辣椒醬、XO 醬）超過 100ml 要放託運；XO 醬可能含肉類成分，台灣入境規定請先查。',
  }),
  stop(D3, 'food', '鵝頸橋四季火鍋*', {
    stay: 120,
    hours: '11:30–14:30、17:30–02:00',
    address: '銅鑼灣謝斐道 414-424 號中望商業中心地下',
    mode: 'walk',
    min: 10,
    note: '* 同伴想去。晚上去才有火鍋（晚市 17:30 起）；可線上訂位（OpenRice）或電話 2553 9718，建議先訂。',
  }),
  stop(D3, 'hotel', '回飯店休息', {
    address: ADDR_HOTEL,
    mode: 'mrt',
    min: 35,
    note: '當天最後回飯店整理行李。交通時間是估計值，出發前用「查路線」確認。',
  }),

  // 11/27 回程日
  stop(D4, 'hotel', '退房，從雅格飯店出發', {
    time: '09:00',
    address: ADDR_HOTEL,
    note: '退房，帶著行李出發。飯店純住宿、不供餐，三餐自理。',
  }),
  stop(D4, 'transit', '香港站：市區預辦登機', {
    stay: 20,
    hours: '06:00–19:00',
    mode: 'mrt',
    min: 40,
    note: '先託運大件行李，再空手去買蛋塔。香港航空市區預辦登機最晚起飛前 90 分鐘辦理（13:30 的班機約 12:00 前要辦完）。',
  }),
  stop(D4, 'food', '早餐：買蛋塔（中環）*', {
    photos: ['https://static5.orstatic.com/userphoto2/photo/26/1QD4/0CBHECE0456C61C664C6C0lv.jpg'],
    stay: 40,
    hours: '每天 08:00–21:00',
    address: '中環士丹頓街 5 號嘉彩閣地舖（Bakehouse）',
    mode: 'mrt',
    min: 10,
    note: '* 同伴想去：Bakehouse 蛋塔。備案：泰昌餅家（中環擺花街 35 號地下，09:30 開）。',
  }),
  stop(D4, 'flight', 'HX262 香港 → 台北', {
    time: '13:30',
    endTime: '15:30',
    mode: 'train',
    min: 40,
    note: '香港站搭機場快線到機場約 24 分，另加安檢時間。蛋塔手提登機。',
  }),

  // 備選
  stop(POOL, 'food', '香港仔晚餐', {
    stay: 90,
    note: '漁港、海鮮、老字號。第一晚輕鬆就好，店家等當天再選。',
  }),
  stop(POOL, 'food', '祥興咖啡室（跑馬地）*', {
    photos: ['https://static5.orstatic.com/userphoto2/photo/25/1OZ5/0C1LWWC04847376EB621F8lv.jpg'],
    hours: '07:00–17:00',
    address: '香港島跑馬地奕蔭街 9 號',
    note: '* 同伴想去，但新行程沒排。熱門品項下午很早賣完，要去建議上午，離賽馬場近。',
  }),
  stop(POOL, 'place', '昂坪 360 + 天壇大佛', {
    stay: 240,
    note: '要半天以上，會取代某天的一半行程。',
  }),
  stop(POOL, 'food', '海連茶樓（荃灣）', {
    hours: '05:00–14:30',
    address: '荃灣海壩街福來邨永嘉樓',
    note: `位置偏遠。${FROM_POST}。`,
  }),
  stop(POOL, 'place', '蘭桂坊夜生活'),
  stop(POOL, 'place', '凌霄閣摩天台 428'),
  stop(POOL, 'place', '堅尼地城海邊散步', {
    note: '* 同伴的攻略：從中環搭叮叮車（後門上車、前門下車，不會報站，自己看站牌）到堅尼地城，海邊有 % Arabica 咖啡店，吹海風散步；那邊有人推薦吃快樂蜂（Jollibee）。',
  }),
  stop(POOL, 'place', '怪獸大廈（鰂魚涌益昌大廈一帶）', {
    stay: 30,
    note: '* 同伴的攻略圖：銅鑼灣搭港鐵約 23 分鐘到鰂魚涌，拍密集的老式住宅外觀。是住宅區，安靜拍照、不要打擾居民。我沒查證開放或限制，信心低。',
  }),
  stop(POOL, 'place', '中環摩天輪（香港觀景輪）', {
    stay: 30,
    note: '* 同伴的貼文：港幣 20 元坐三圈（貼文寫的，我沒查證）。中環海濱，貼文建議搭完再去搭叮叮車到堅尼地城。',
  }),
  stop(POOL, 'place', '親手做霓虹燈'),
  stop(POOL, 'transit', '搭落日飛車看夜景'),
  // 雨天備案（室內）
  stop(POOL, 'shop', '太古廣場（雨天備案）', {
    stay: 90,
    note: '金鐘站直達的室內商場，離飯店出發的路線最近。下雨時逛街、吃飯都方便。',
  }),
  stop(POOL, 'shop', '時代廣場 / 崇光（銅鑼灣）（雨天備案）', {
    stay: 90,
    note: '銅鑼灣站旁的大型室內商場。港島日下雨時可以改來這裡。',
  }),
  stop(POOL, 'shop', '海港城（尖沙咀）（雨天備案）', {
    stay: 120,
    note: '尖沙咀的大型室內商場，離星光大道和維港很近。九龍日下雨時可以替代戶外行程。',
  }),
  stop(POOL, 'place', '香港歷史博物館（尖沙咀）（雨天備案）', {
    stay: 120,
    note: '常設展「香港故事」，適合下雨天看。香港的公立博物館多半週二休館，去之前請確認開放日和票價（11/26 是週四）。',
  }),
  // 我推薦的景點（資料見 place-info.ts）
  stop(POOL, 'place', '天星小輪', { stay: 30 }),
  stop(POOL, 'place', '中環半山自動扶梯', { stay: 30 }),
  stop(POOL, 'place', '大館（舊中區警署）', { stay: 60 }),
  stop(POOL, 'place', '文武廟（上環）', { stay: 30 }),
  stop(POOL, 'place', '黃大仙祠', { stay: 60 }),
  stop(POOL, 'place', '南蓮園池', { stay: 60 }),
  stop(POOL, 'place', '赤柱市集', { stay: 120 }),
  stop(POOL, 'place', '淺水灣', { stay: 60 }),
];

/** 套用地點資料（營業時間、門票、交通提醒）後的預設行程 */
export const SEED_ITEMS: S<Item>[] = RAW_ITEMS.map(applyInfo);

const R = (kind: NoteRow['kind'], a: string, b = '', extra: Partial<NoteRow> = {}): NoteRow => ({
  kind,
  a,
  b,
  c: '',
  done: false,
  ...extra,
});

/** 預設筆記：訂單號碼、航班、地址、提醒來自你原本的筆記；機場快線/八達通/退稅/必買清單取自設計稿，價格與店家請出發前再確認。 */
export const SEED_NOTES: S<Note>[] = [
  {
    order: 1,
    wide: true,
    category: '必讀',
    icon: 'info',
    title: '重要資訊',
    content: '',
    url: '',
    rows: [
      R('line', '機場快線', '機場 → 香港站，約 24 分直達；八達通 HK$120、單程票 HK$130（2025–26 年，出發前再確認）', { icon: 'train' }),
      R('line', '八達通', '搭車、購物通用。成人卡約 HK$150–200（含 HK$50 按金，買時確認）、觀光版 HK$39（不可退）；iPhone 可用 Octopus App for Tourists 加值，Android 建議買實體卡', { icon: 'card' }),
      R('line', '退稅', '香港購物不含銷售稅，標價即最終價', { icon: 'receipt' }),
    ],
  },
  {
    order: 2,
    category: '航班',
    icon: 'plane',
    title: '航班',
    content: '',
    url: '',
    rows: [
      R('kv', '去程 11/24（二）', 'HX253 11:45 → 13:55'),
      R('kv', '回程 11/27（五）', 'HX262 13:30 → 15:30'),
      R('kv', '訂單號碼', 'NE2607242120322898'),
      R('kv', '行李', '每人 1 件（23 公斤）'),
      R('line', '香港航空行程單（PDF）', '', {
        icon: 'external',
        url: 'http://new.hongkongairlines.com/hxair/ibe/profile/pdfjump.do?pdfItinerary=TkUyNjA3MjQyMTIwMzIyODk4I0RJTkdZVUFOI0xBSSNlbWFpbFJldHJpZXZlQm9va2luZyM1MTIzMDEwNiMyNjA3MjQyMQ==',
      }),
    ],
  },
  {
    order: 3,
    category: '住宿',
    icon: 'bed',
    title: '訂房與入住',
    content: '',
    url: '',
    rows: [
      R('line', '雅格飯店', '港島南區 黃竹坑 · 三人房', { icon: 'building' }),
      R('kv', '入住', '11/24（二）'),
      R('kv', '退房', '11/27（五）'),
      R('kv', '訂房確認', '（待填）'),
      R('kv', '餐食', '純住宿，三餐自理'),
      R('line', '43 Heung Yip Road, Wong Chuk Hang', '港鐵南港島線：黃竹坑站，到金鐘兩站', {
        icon: 'pin',
      }),
    ],
  },
  {
    order: 4,
    category: '實用',
    icon: 'plug',
    title: '換錢與插頭',
    content: '',
    url: '',
    rows: [
      R('line', '插頭 Type G（英式三腳）', '記得帶萬用轉接頭，酒店不一定借到', { icon: 'plug' }),
      R('line', '換錢：重慶大廈 / 旺角找換店', '匯率比機場好，認明掛牌價、先問清楚', {
        icon: 'swap',
      }),
      R('rate', '參考匯率', '1 HKD ≈ 4.1 TWD（概估）'),
    ],
  },
  {
    order: 5,
    category: '購物',
    icon: 'bag',
    title: '必買清單',
    content: '',
    url: '',
    rows: [
      R('check', '珍妮曲奇 小熊曲奇（人氣手信）'),
      R('check', '位元堂 / 余仁生 保健品'),
      R('check', '藥房面膜、保養品'),
      R('check', '莎莎 / 卓悅 彩妝'),
      R('check', '嘉頓 / 米通餅乾'),
      R('check', '超市辣椒醬、XO 醬'),
    ],
  },
  {
    order: 6,
    category: '提醒',
    icon: 'bell',
    title: '提醒事項',
    content: '',
    url: '',
    rows: [
      R('alert', '準備港幣現金約 HK$3,000，的士和街市多收現金', '', { icon: 'cash' }),
      R('alert', '落機先買 4G 電話卡或開通漫遊', '', { icon: 'phone' }),
      R('alert', '11 月底約 18–24°C，早晚涼，帶一件薄外套', '', { icon: 'weather' }),
      R('alert', '行程裡的交通時間是估計值，出發前用 Google Maps / MTR Mobile 再確認', '', {
        icon: 'info',
      }),
      R(
        'alert',
        '行動電源只能隨身帶、不可託運：每人最多 2 個、單個不超過 100Wh；2025-04-07 起不能放行李架，要放前座椅下或座椅口袋，飛行中不能使用或充電（香港航空）',
        '',
        { icon: 'luggage' },
      ),
      R(
        'alert',
        '建議隨身帶：護照證件、現金、必要藥品、相機、藍牙耳機（含鋰電池）、筆電、貴重物品',
        '',
        { icon: 'luggage' },
      ),
      R(
        'alert',
        '隨身的液體、膏狀、噴霧：每瓶不超過 100ml，全部裝進一個 1 公升的透明夾鏈袋（免稅品也一樣）；超過的放託運',
        '',
        { icon: 'drops' },
      ),
    ],
  },
  {
    order: 0,
    category: '待辦',
    icon: 'cal-clock',
    title: '出發前待辦',
    content: '',
    url: '',
    rows: [
      R('line', '入境證件：台胞證', '持效期內的台胞證可直接入境', {
        icon: 'external',
        url: 'https://www.immd.gov.hk/hkt/services/visas/pre-arrival_registration_for_taiwan_residents.html',
      }),
      R('check', '確認台胞證在效期內，並放進隨身包'),
      R('check', '確認護照效期，回台報到時要用'),
      R('check', '買好 eSIM，把 QR code 截圖存手機'),
      R('check', '準備港幣現金（約 HK$3,000）'),
      R('check', '確認八達通怎麼買（到港購買或手機綁定）'),
      R('check', '下載 Google Maps 離線地圖（香港）與 MTR Mobile'),
      R('check', '熱門餐廳或景點需要的先訂位'),
      R('check', '線上報到，確認託運行李規定'),
      R('check', '行李秤重（每人 1 件 23 公斤），伴手禮留空間'),
      R('check', '確認旅遊平安險'),
    ],
  },
  {
    order: 8,
    category: '交通',
    icon: 'train',
    title: '路線速查',
    content: '',
    url: '',
    rows: [
      R('line', '南港島線｜飯店在黃竹坑站', '往金鐘方向，約 2 站到金鐘，在金鐘轉乘其他線', {
        icon: 'train',
      }),
      R(
        'line',
        '荃灣線｜金鐘 → 九龍',
        '金鐘搭往荃灣方向，依序經尖沙咀、佐敦、油麻地、旺角、太子、深水埗',
        { icon: 'train' },
      ),
      R('line', '港鐵島線｜港島北岸', '金鐘 → 灣仔 → 銅鑼灣；往西是中環、上環', { icon: 'train' }),
      R('line', '機場快線｜回程', '香港站到機場約 24 分；香港站可辦香港航空市區預辦登機（06:00–19:00，最晚起飛前 90 分鐘）', { icon: 'train' }),
      R('line', '港鐵官方路線圖', '出發前截圖存手機，下車前也可以用 MTR Mobile 查', {
        icon: 'external',
        url: 'https://www.mtr.com.hk/en/customer/services/system_map.html',
      }),
    ],
  },
  {
    order: 9,
    category: '行程',
    icon: 'map',
    title: '一天一區對照',
    content: '',
    url: '',
    rows: [
      R('line', '11/24（二）抵達日', '機場 → 黃竹坑住宿 → Owl 泡芙 → 維港搭張保仔號 → 尖沙咀小吃 → 回飯店', { icon: 'pin' }),
      R('line', '11/25（三）港島', '龍邦燒味 → 中環街市 → 沾仔記 → PMQ → 叮叮車到灣仔（Soft Thunder）→ 華姐清湯腩 → 甜姨姨（MINISO 選擇性）→ 賽馬夜賽', { icon: 'pin' }),
      R('line', '11/26（四）九龍', '九龍城寨公園 → 一點心 → SG 秘密花園 → 旺角 → 超市買伴手禮 → 鵝頸橋火鍋', { icon: 'pin' }),
      R('line', '11/27（五）回程日', '退房出發 → 香港站預辦登機 → 中環買蛋塔（Bakehouse）→ 機場快線 → 機場', { icon: 'pin' }),
    ],
  },
];
