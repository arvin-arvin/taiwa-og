export const DEFAULT_SCENARIOS = [
  {
    id: 'cafe-restaurant',
    title: { en: 'Japanese Cafe & Dining', ja: 'カフェ・レストランで注文' },
    description: {
      en: 'Practice ordering food, asking for recommendations, and handling dietary preferences.',
      ja: '料理の注文、おすすめの質問、会計のやり取りを練習します。',
    },
    supportedFormalities: ['Teineigo (丁寧語 - Polite)', 'Keigo (敬語 - Honorific/Humble)'],
    initialMessage: {
      text: 'いらっしゃいませ！ご注文はお決まりですか？',
      translation: 'Welcome! Have you decided on your order?',
      furiganaHtml: 'いらっしゃいませ！ご<ruby>注<rt>ちゅう</rt></ruby><ruby>文<rt>もん</rt></ruby>はお<ruby>決<rt>き</rt></ruby>まりですか？',
    },
    icon: 'Utensils',
  },
  {
    id: 'convenience-store',
    title: { en: 'Convenience Store (Conbini)', ja: 'コンビニでの買い物' },
    description: {
      en: 'Handle quick checkout questions like heating food, point cards, and plastic bags.',
      ja: '温め、レジ袋、ポイントカードの確認など日常的な接客会話。',
    },
    supportedFormalities: ['Teineigo (丁寧語 - Polite)'],
    initialMessage: {
      text: 'いらっしゃいませ。温めますか？',
      translation: 'Welcome. Would you like this warmed up?',
      furiganaHtml: 'いらっしゃいませ。<ruby>温<rt>あたた</rt></ruby>めますか？',
    },
    icon: 'ShoppingBag',
  },
  {
    id: 'chatting-friend',
    title: { en: 'Chatting with a Friend', ja: '友達とのカジュアル会話' },
    description: {
      en: 'Casual chat about weekend plans, hobbies, and recent movies.',
      ja: '週末の予定や趣味、好きな食べ物について友達と気さくに話します。',
    },
    supportedFormalities: ['Casual (タメ口)'],
    initialMessage: {
      text: 'やっほー！今週末なにか予定ある？',
      translation: 'Yoohoo! Got any plans this weekend?',
      furiganaHtml: 'やっほー！<ruby>今<rt>こん</rt></ruby><ruby>週<rt>しゅう</rt></ruby><ruby>末<rt>まつ</rt></ruby>なにか<ruby>予<rt>よ</rt></ruby><ruby>定<rt>てい</rt></ruby>ある？',
    },
    icon: 'MessageCircle',
  },
  {
    id: 'asking-directions',
    title: { en: 'Asking for Directions', ja: '駅や街中で道案内を頼む' },
    description: {
      en: 'Ask locals for help finding train platforms, bus stops, or landmark spots.',
      ja: '道に迷った時に通行人や駅員に場所を尋ねる練習。',
    },
    supportedFormalities: ['Casual (タメ口)', 'Teineigo (丁寧語 - Polite)'],
    initialMessage: {
      text: 'すみません、何かお探しですか？',
      translation: 'Excuse me, are you looking for something?',
      furiganaHtml: 'すみません、<ruby>何<rt>なに</rt></ruby>かお<ruby>探<rt>さが</rt></ruby>しですか？',
    },
    icon: 'MapPin',
  },
  {
    id: 'hotel-checkin',
    title: { en: 'Hotel Check-In & Requests', ja: 'ホテルでのチェックイン' },
    description: {
      en: 'Polite interactions at the front desk, luggage holding, and amenity requests.',
      ja: 'チェックイン手続き、荷物の預かり、部屋のリクエスト対応。',
    },
    supportedFormalities: ['Keigo (敬語 - Honorific/Humble)'],
    initialMessage: {
      text: 'いらっしゃいませ、ご宿泊のお手続きでございますか？',
      translation: 'Welcome, are you checking in today?',
      furiganaHtml: 'いらっしゃいませ、ご<ruby>宿<rt>しゅく</rt></ruby><ruby>泊<rt>はく</rt></ruby>のお<ruby>手<rt>て</rt></ruby><ruby>続<rt>つづ</rt></ruby>きでございますか？',
    },
    icon: 'Hotel',
  },
];

export function getCustomScenarios() {
  const data = localStorage.getItem('custom_scenarios');
  return data ? JSON.parse(data) : [];
}

export function saveCustomScenario(scenario) {
  const current = getCustomScenarios();
  const updated = [scenario, ...current];
  localStorage.setItem('custom_scenarios', JSON.stringify(updated));
  return updated;
}

const FORMALITIES = [
  'Casual (タメ口)',
  'Teineigo (丁寧語 - Polite)',
  'Keigo (敬語 - Honorific/Humble)',
];
const MAX_IMPORT = 50;

const clip = (v, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function exportCustomScenarios() {
  return JSON.stringify(
    { app: 'taiwa', version: 1, scenarios: getCustomScenarios() },
    null,
    2
  );
}

/** Validates an imported file and adds the good scenarios. Throws a readable error. */
export function importCustomScenarios(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const list = Array.isArray(data) ? data : data?.scenarios;
  if (!Array.isArray(list)) throw new Error('No scenarios found in that file.');

  const clean = [];
  list.slice(0, MAX_IMPORT).forEach((s, i) => {
    const titleEn = clip(s?.title?.en);
    const greeting = clip(s?.initialMessage?.text, 500);
    if (!titleEn || !greeting) return;

    const formalities = Array.isArray(s.supportedFormalities)
      ? s.supportedFormalities.filter((f) => FORMALITIES.includes(f))
      : [];
    const descEn = clip(s.description?.en, 500);

    clean.push({
      id: `custom-${Date.now()}-${i}`,
      title: { en: titleEn, ja: clip(s.title.ja) || titleEn },
      description: { en: descEn, ja: clip(s.description?.ja, 500) || descEn },
      supportedFormalities: formalities.length ? formalities : [FORMALITIES[1]],
      initialMessage: {
        text: greeting,
        translation: clip(s.initialMessage.translation, 500) || greeting,
        furiganaHtml: clip(s.initialMessage.furiganaHtml, 1000) || greeting,
      },
      icon: clip(s.icon, 40) || 'Sparkles',
    });
  });

  if (clean.length === 0) throw new Error('No valid scenarios found in that file.');

  localStorage.setItem('custom_scenarios', JSON.stringify([...clean, ...getCustomScenarios()]));
  return { added: clean.length, skipped: Math.min(list.length, MAX_IMPORT) - clean.length };
}