/**
 * Built-in word lists for the "No-Anki" mode.
 * Each list matches a scenario. Levels are approximate (JLPT has no official word list).
 */
export const WORD_LISTS = [
  {
    id: 'daily',
    title: { en: 'Daily life', ja: '日常生活' },
    level: 'N5',
    words: [
      ['毎日', 'まいにち', 'every day'],
      ['友達', 'ともだち', 'friend'],
      ['勉強', 'べんきょう', 'study'],
      ['仕事', 'しごと', 'work; job'],
      ['家族', 'かぞく', 'family'],
      ['天気', 'てんき', 'weather'],
      ['時間', 'じかん', 'time'],
      ['電車', 'でんしゃ', 'train'],
      ['買い物', 'かいもの', 'shopping'],
      ['料理', 'りょうり', 'cooking; dish'],
      ['休み', 'やすみ', 'day off; rest'],
      ['電話', 'でんわ', 'telephone'],
    ],
  },
  {
    id: 'cafe',
    title: { en: 'Cafe & dining', ja: 'カフェ・食事' },
    level: 'N5–N4',
    words: [
      ['注文', 'ちゅうもん', 'order'],
      ['おすすめ', 'おすすめ', 'recommendation'],
      ['メニュー', 'メニュー', 'menu'],
      ['水', 'みず', 'water'],
      ['温かい', 'あたたかい', 'warm (food, drink)'],
      ['冷たい', 'つめたい', 'cold (to the touch)'],
      ['砂糖', 'さとう', 'sugar'],
      ['お会計', 'おかいけい', 'the bill; checkout'],
      ['席', 'せき', 'seat'],
      ['美味しい', 'おいしい', 'delicious'],
      ['食べ物', 'たべもの', 'food'],
      ['飲み物', 'のみもの', 'drink'],
    ],
  },
  {
    id: 'conbini',
    title: { en: 'Convenience store', ja: 'コンビニ' },
    level: 'N5–N4',
    words: [
      ['袋', 'ふくろ', 'bag'],
      ['温める', 'あたためる', 'to heat up'],
      ['お弁当', 'おべんとう', 'boxed meal'],
      ['レシート', 'レシート', 'receipt'],
      ['現金', 'げんきん', 'cash'],
      ['支払い', 'しはらい', 'payment'],
      ['割り箸', 'わりばし', 'disposable chopsticks'],
      ['小銭', 'こぜに', 'small change; coins'],
      ['おつり', 'おつり', 'change (money back)'],
      ['商品', 'しょうひん', 'product; goods'],
      ['切手', 'きって', 'postage stamp'],
      ['払う', 'はらう', 'to pay'],
    ],
  },
  {
    id: 'friend',
    title: { en: 'Chatting with a friend', ja: '友達との会話' },
    level: 'N5–N4',
    words: [
      ['週末', 'しゅうまつ', 'weekend'],
      ['趣味', 'しゅみ', 'hobby'],
      ['映画', 'えいが', 'movie'],
      ['最近', 'さいきん', 'recently'],
      ['暇', 'ひま', 'free time; not busy'],
      ['楽しい', 'たのしい', 'fun; enjoyable'],
      ['約束', 'やくそく', 'promise; appointment'],
      ['誘う', 'さそう', 'to invite'],
      ['旅行', 'りょこう', 'trip; travel'],
      ['疲れる', 'つかれる', 'to get tired'],
      ['面白い', 'おもしろい', 'interesting; funny'],
      ['久しぶり', 'ひさしぶり', 'it has been a while'],
    ],
  },
  {
    id: 'directions',
    title: { en: 'Asking for directions', ja: '道案内' },
    level: 'N5–N4',
    words: [
      ['駅', 'えき', 'station'],
      ['道', 'みち', 'road; way'],
      ['右', 'みぎ', 'right'],
      ['左', 'ひだり', 'left'],
      ['まっすぐ', 'まっすぐ', 'straight ahead'],
      ['交差点', 'こうさてん', 'intersection'],
      ['信号', 'しんごう', 'traffic light'],
      ['曲がる', 'まがる', 'to turn'],
      ['渡る', 'わたる', 'to cross'],
      ['角', 'かど', 'corner'],
      ['迷う', 'まよう', 'to get lost'],
      ['橋', 'はし', 'bridge'],
    ],
  },
  {
    id: 'hotel',
    title: { en: 'Hotel check-in', ja: 'ホテルのチェックイン' },
    level: 'N4–N3',
    words: [
      ['予約', 'よやく', 'reservation'],
      ['宿泊', 'しゅくはく', 'lodging; stay'],
      ['荷物', 'にもつ', 'luggage'],
      ['預かる', 'あずかる', 'to look after; to hold'],
      ['鍵', 'かぎ', 'key'],
      ['朝食', 'ちょうしょく', 'breakfast'],
      ['部屋', 'へや', 'room'],
      ['手続き', 'てつづき', 'procedure; formalities'],
      ['延長', 'えんちょう', 'extension'],
      ['禁煙', 'きんえん', 'non-smoking'],
      ['領収書', 'りょうしゅうしょ', 'receipt (official)'],
      ['滞在', 'たいざい', 'stay'],
    ],
  },
];

/** Which list goes with which built-in scenario */
export const LIST_FOR_SCENARIO = {
  'cafe-restaurant': 'cafe',
  'convenience-store': 'conbini',
  'chatting-friend': 'friend',
  'asking-directions': 'directions',
  'hotel-checkin': 'hotel',
};

/** Turns a list into the same card shape that Anki cards use in the app */
export function listToCards(listId) {
  const list = WORD_LISTS.find((l) => l.id === listId) || WORD_LISTS[0];
  return list.words.map(([expression, reading, english], i) => ({
    id: `builtin-${list.id}-${i}`,
    expression,
    reading,
    english,
    exampleHtml: '',
    displayHtml:
      reading && reading !== expression
        ? `<ruby>${expression}<rt>${reading}</rt></ruby>`
        : expression,
  }));
}