import React, { useState, useEffect } from 'react';
import { invokeAnki, sanitizeCard } from './services/anki';
import { generateRoleplayResponse, generateReplyHints } from './services/ai'; // <--- Import generateReplyHints
import { speakJapanese } from './services/speech';
import { translations } from './constants/translations';
import {
  DEFAULT_SCENARIOS,
  getCustomScenarios,
  saveCustomScenario,
  updateCustomScenario,
  deleteCustomScenario,
  exportCustomScenarios,
  importCustomScenarios,
} from './constants/scenarios';
import { loadSettings, saveSettings, isAiConfigured } from './services/settings';
import { sanitizeFurigana } from './services/sanitize';
import { 
  Layers, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Sliders,
  Volume2,
  AlertCircle,
  Cpu,
  Settings,
  X,
  Globe,
  MessageSquare,
  Compass,
  Search,
  Plus,
  ArrowRight,
  Utensils,
  Coffee,
  ShoppingBag,
  Store,
  MessageCircle,
  MapPin,
  Hotel,
  Train,
  Plane,
  Briefcase,
  Heart,
  Sparkles,
  Building,
  Lightbulb,
  Sun,
  Moon,
  BookOpen,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Pencil

} from 'lucide-react';
import './App.css';
const MAX_PICKED = 30;

const CHAT_KEY = 'taiwa.chat.v1';

function loadChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_KEY));
    if (!saved || !Array.isArray(saved.messages) || saved.messages.length === 0) return null;
    return saved;
  } catch {
    return null;
  }
}

const SCENARIO_ICONS = {
  Utensils,
  Coffee,
  ShoppingBag,
  Store,
  MessageCircle,
  MapPin,
  Hotel,
  Train,
  Plane,
  Briefcase,
  Heart,
  Sparkles,
  Building,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [ankiStatus, setAnkiStatus] = useState('connecting');
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [deckCards, setDeckCards] = useState([]);
  const [cardCount, setCardCount] = useState(10);
  const [cardMode, setCardMode] = useState('random'); // 'random' | 'top'
  const [shuffleKey, setShuffleKey] = useState(0);
  const [pickedCards, setPickedCards] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [usedWords, setUsedWords] = useState(new Set());
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'dark');
  // Settings & System State
  const [systemLang, setSystemLang] = useState(() => localStorage.getItem('systemLang') || 'en');
  const [showSettings, setShowSettings] = useState(false);
  const [ankiBannerHidden, setAnkiBannerHidden] = useState(false);
  const [settingsTab, setSettingsTab] = useState('appearance');

    const [display, setDisplay] = useState(() => {
    const defaults = {
      translationMode: 'always', // 'always' | 'hover' | 'off'
      furiganaMode: 'always',
      highlightKanji: false,
      highlightTarget: false,
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('taiwa.display.v1')) };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('taiwa.display.v1', JSON.stringify(display));
    } catch {
      // storage unavailable, ignore
    }
  }, [display]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) return saved === 'true';
    } catch {
      // storage unavailable, fall through
    }
    return window.innerWidth < 720;
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    } catch {
      // storage unavailable, ignore
    }
  }, [sidebarCollapsed]);
  const [usedCardIds, setUsedCardIds] = useState(() => new Set());
    const [aiSettings, setAiSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(aiSettings);
  }, [aiSettings]);

  // Scenario Management State
  const [scenarios, setScenarios] = useState([]);
    const [activeScenario, setActiveScenario] = useState(() => {
    const saved = loadChat();
    const all = [...DEFAULT_SCENARIOS, ...getCustomScenarios()];
    return all.find((s) => s.id === saved?.scenarioId) || DEFAULT_SCENARIOS[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [formalityFilter, setFormalityFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // New Scenario Form State
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleJa, setNewTitleJa] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGreeting, setNewGreeting] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newFormalities, setNewFormalities] = useState(['Teineigo (丁寧語 - Polite)']);
  const [newIcon, setNewIcon] = useState('Sparkles');

  // Chat Config
  const [jlptLevel, setJlptLevel] = useState(() => loadChat()?.jlptLevel || 'N4');
  const [formality, setFormality] = useState(
    () => loadChat()?.formality || 'Teineigo (丁寧語 - Polite)'
  );
  const [loading, setLoading] = useState(false);
  const [isHintGlowing, setIsHintGlowing] = useState(false);

  // Hint Assistant State
  const [hints, setHints] = useState([]);
  const [loadingHints, setLoadingHints] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const t = translations[systemLang];

  useEffect(() => {
    const custom = getCustomScenarios();
    setScenarios([...DEFAULT_SCENARIOS, ...custom]);
  }, []);

  useEffect(() => {
    localStorage.setItem('systemLang', systemLang);
  }, [systemLang]);

  useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('appTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };


  useEffect(() => {
    async function initAnki() {
      try {
        const deckList = await invokeAnki('deckNames');
        setDecks(deckList);
        if (deckList.length > 0) setSelectedDeck(deckList[0]);
        setAnkiStatus('ready');
      } catch (err) {
        setAnkiStatus('error');
      }
    }
    initAnki();
  }, []);

  

      useEffect(() => {
    if (!selectedDeck || ankiStatus !== 'ready' || cardMode === 'select') return;

    async function loadCards() {
      try {
        const cardIds = await invokeAnki('findCards', { query: `deck:"${selectedDeck}"` });
        setUsedWords(new Set());
        if (cardIds.length > 0) {
          const picked =
            cardMode === 'random'
              ? [...cardIds].sort(() => Math.random() - 0.5).slice(0, cardCount)
              : cardIds.slice(0, cardCount);
          const rawCards = await invokeAnki('cardsInfo', { cards: picked });
          setDeckCards(rawCards.map(sanitizeCard));
        } else {
          setDeckCards([]);
        }
      } catch (e) {
        console.error("Card fetch failed", e);
      }
    }
    loadCards();
  }, [selectedDeck, ankiStatus, cardCount, cardMode, shuffleKey]);

  // In "select" mode the practice words are the cards you ticked
  useEffect(() => {
    if (cardMode === 'select') setDeckCards(pickedCards);
  }, [cardMode, pickedCards]);

  // A different deck means old picks and search results no longer apply
  useEffect(() => {
    setPickedCards([]);
    setSearchResults([]);
  }, [selectedDeck]);

  const [messages, setMessages] = useState(
    () =>
      loadChat()?.messages || [
        {
          sender: 'ai',
          text: activeScenario.initialMessage.text,
          translation: activeScenario.initialMessage.translation,
          furiganaHtml: activeScenario.initialMessage.furiganaHtml,
        },
      ]
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_KEY,
        JSON.stringify({ scenarioId: activeScenario.id, messages, jlptLevel, formality })
      );
    } catch {
      // storage unavailable, ignore
    }
  }, [messages, activeScenario, jlptLevel, formality]);
  const [input, setInput] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchText.trim().replace(/"/g, '');
    const query = q
      ? `deck:"${selectedDeck}" "${q}"`
      : `deck:"${selectedDeck}"`;
    try {
      const ids = await invokeAnki('findCards', { query });
      const raw = ids.length > 0
        ? await invokeAnki('cardsInfo', { cards: ids.slice(0, 20) })
        : [];
      setSearchResults(raw.map(sanitizeCard));
    } catch (err) {
      console.error('Card search failed', err);
    }
  };

  const togglePick = (card) => {
    setPickedCards((prev) =>
      prev.some((c) => c.id === card.id)
        ? prev.filter((c) => c.id !== card.id)
        : prev.length >= MAX_PICKED
          ? prev
          : [...prev, card]
    );
  };

  const handleNewChat = () => {
    if (messages.length > 1 && !window.confirm('Start a new chat? The current conversation will be cleared.')) {
      return;
    }
    setMessages([
      {
        sender: 'ai',
        text: activeScenario.initialMessage.text,
        translation: activeScenario.initialMessage.translation,
        furiganaHtml: activeScenario.initialMessage.furiganaHtml,
      },
    ]);
    setUsedWords(new Set());
    setShowHints(false);
    setHints([]);
  };

  const handleLaunchScenario = (scenario) => {
    setActiveScenario(scenario);
    setFormality(scenario.supportedFormalities[0]);
    setMessages([
      {
        sender: 'ai',
        text: scenario.initialMessage.text,
        translation: scenario.initialMessage.translation,
        furiganaHtml: scenario.initialMessage.furiganaHtml,
      }
    ]);
    setShowHints(false);
    setHints([]);
    setActiveTab('chat');
  };


useEffect(() => {
  setIsHintGlowing(false);

  // Check if it's currently the user's turn to reply (last message from AI)
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.sender === 'ai') {
    const timer = setTimeout(() => {
      setIsHintGlowing(true);
    }, 60000); // 60,000ms = 1 minute

    return () => clearTimeout(timer);
  }
}, [messages, input]);

  const handleExportScenarios = () => {
    if (getCustomScenarios().length === 0) {
      window.alert('You have no custom scenarios to export yet.');
      return;
    }
    const blob = new Blob([exportCustomScenarios()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taiwa-scenarios.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('That file is too large.');
      const { added, skipped } = importCustomScenarios(await file.text());
      setScenarios([...DEFAULT_SCENARIOS, ...getCustomScenarios()]);
      window.alert(`Imported ${added} scenario(s).${skipped ? ` Skipped ${skipped} invalid.` : ''}`);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const resetScenarioForm = () => {
    setEditingId(null);
    setNewTitleEn('');
    setNewTitleJa('');
    setNewDesc('');
    setNewGreeting('');
    setNewTranslation('');
    setNewFormalities(['Teineigo (丁寧語 - Polite)']);
    setNewIcon('Sparkles');
  };

  const openCreateModal = () => {
    resetScenarioForm();
    setShowCreateModal(true);
  };

  const openEditModal = (scen) => {
    setEditingId(scen.id);
    setNewTitleEn(scen.title.en);
    setNewTitleJa(scen.title.ja === scen.title.en ? '' : scen.title.ja);
    setNewDesc(scen.description?.en || '');
    setNewGreeting(scen.initialMessage.text);
    setNewTranslation(
      scen.initialMessage.translation === scen.initialMessage.text
        ? ''
        : scen.initialMessage.translation
    );
    setNewFormalities(scen.supportedFormalities);
    setNewIcon(scen.icon || 'Sparkles');
    setShowCreateModal(true);
  };

  const handleCreateScenario = (e) => {
    e.preventDefault();
    if (!newTitleEn || !newGreeting) return;

    const original = editingId ? scenarios.find((s) => s.id === editingId) : null;
    const built = {
      id: editingId || `custom-${Date.now()}`,
      title: { en: newTitleEn, ja: newTitleJa || newTitleEn },
      description: { en: newDesc, ja: newDesc },
      supportedFormalities: newFormalities,
      initialMessage: {
        text: newGreeting,
        translation: newTranslation || newGreeting,
        furiganaHtml:
          original && original.initialMessage.text === newGreeting
            ? original.initialMessage.furiganaHtml
            : newGreeting,
      },
      icon: newIcon,
    };

    const updated = editingId ? updateCustomScenario(built) : saveCustomScenario(built);
    setScenarios([...DEFAULT_SCENARIOS, ...updated]);
    if (editingId && activeScenario.id === editingId) setActiveScenario(built);
    setShowCreateModal(false);
    resetScenarioForm();
  };

  const handleDeleteScenario = () => {
    if (!editingId) return;
    if (!window.confirm('Delete this scenario? This cannot be undone.')) return;

    const updated = deleteCustomScenario(editingId);
    setScenarios([...DEFAULT_SCENARIOS, ...updated]);

    // If the open chat uses this scenario, fall back to the first built-in one
    if (activeScenario.id === editingId) {
      const fallback = DEFAULT_SCENARIOS[0];
      setActiveScenario(fallback);
      setFormality(fallback.supportedFormalities[0]);
      setMessages([
        {
          sender: 'ai',
          text: fallback.initialMessage.text,
          translation: fallback.initialMessage.translation,
          furiganaHtml: fallback.initialMessage.furiganaHtml,
        },
      ]);
    }

    setShowCreateModal(false);
    resetScenarioForm();
  };
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { sender: 'user', text: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setShowHints(false);
    setLoading(true);

    try {
      const aiReply = await generateRoleplayResponse({
        scenarioContext: activeScenario.title.en,
        messages: updatedMessages,
        cards: deckCards,
        jlptLevel,
        formality,
        systemLang,
      });

      setUsedWords((prev) => {
        const newSet = new Set(prev);
        if (aiReply.usedWords) aiReply.usedWords.forEach((word) => newSet.add(word));
        deckCards.forEach((c) => {
          if (aiReply.text.includes(c.expression)) newSet.add(c.expression);
        });
        return newSet;
      });

      setMessages((prev) => {
        const msgs = [...prev];
        const lastUserIndex = msgs.length - 1;

        if (aiReply.userFeedback?.hasIssues && msgs[lastUserIndex]?.sender === 'user') {
          msgs[lastUserIndex] = { ...msgs[lastUserIndex], feedback: aiReply.userFeedback };
        }

        return [
          ...msgs,
          {
            sender: 'ai',
            text: aiReply.text,
            translation: aiReply.translation,
            furiganaHtml: aiReply.furiganaHtml,
          },
        ];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Hint Generation
  const handleGetHints = async () => {
    if (loadingHints) return;
    setLoadingHints(true);
    setShowHints(true);

    try {
      const generated = await generateReplyHints({
        scenarioContext: activeScenario.title.en,
        messages,
        cards: deckCards,
        jlptLevel,
        formality,
        systemLang,
      });

      setHints(generated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHints(false);
    }
  };

  // Click a hint to autofill text input
  const handleSelectHint = (text) => {
    setInput(text);
    setShowHints(false);
  };

  const filteredScenarios = scenarios.filter((s) => {
    const titleMatch = s.title.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       s.title.ja.includes(searchQuery);
    const formalityMatch = formalityFilter === 'ALL' || s.supportedFormalities.includes(formalityFilter);
    return titleMatch && formalityMatch;
  });

  return (
    <div
      className={`app-container ${
        display.furiganaMode === 'off'
          ? 'hide-furigana'
          : display.furiganaMode === 'hover'
            ? 'furigana-on-hover'
            : ''
      }`}
    >
      {/* 1. Header fixed at the very top */}
            {/* Sidebar + main area */}
      <div className="dashboard-grid">
        <aside className={`side-panel ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-top">
            <div className="brand">
              <div className="brand-icon">話</div>
              <div className="brand-title sidebar-label">Taiwa</div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight style={{ width: 18, height: 18 }} />
              ) : (
                <ChevronLeft style={{ width: 18, height: 18 }} />
              )}
            </button>
          </div>

          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
              title={t?.navChat || 'Chat Practice'}
            >
              <MessageSquare style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="sidebar-label">{t?.navChat || 'Chat Practice'}</span>
            </button>
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'scenarios' ? 'active' : ''}`}
              onClick={() => setActiveTab('scenarios')}
              title={t?.navScenarios || 'Scenarios'}
            >
              <Compass style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="sidebar-label">{t?.navScenarios || 'Scenarios'}</span>
            </button>
          </nav>

          <div className="sidebar-scroll">
  {/* 1. Anki Deck Selection */}
  <div className="panel-box">
    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Layers style={{ width: 16, height: 16, color: 'var(--shu-500)' }} />
      {t?.deckSelection || 'Anki Deck'}
    </h2>
    <select
      value={selectedDeck}
      onChange={(e) => setSelectedDeck(e.target.value)}
      disabled={ankiStatus !== 'ready'}
      className="select-input"
    >
      {decks && decks.length > 0 ? (
        decks.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))
      ) : (
        <option>{t?.noDecks || 'No Decks Available'}</option>
      )}
    </select>
  </div>

  {/* 2 card selection mode and count */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
      <select
        value={cardMode}
        onChange={(e) => setCardMode(e.target.value)}
        disabled={ankiStatus !== 'ready'}
        className="select-input"
        aria-label={t?.cardMode || 'Card selection'}
      >
        <option value="random">{t?.modeRandom || 'Random'}</option>
        <option value="top">{t?.modeTop || 'Top of deck'}</option>
        <option value="select">{t?.modeSelect || 'Select cards'}</option>
      </select>
      <select
        value={cardCount}
        onChange={(e) => setCardCount(Number(e.target.value))}
                disabled={ankiStatus !== 'ready' || cardMode === 'select'}
        className="select-input"
        aria-label={t?.cardCount || 'Cards to practise'}
      >
        {[5, 10, 15, 20, 30].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
    {cardMode === 'random' && (
      <button
        type="button"
        onClick={() => setShuffleKey((k) => k + 1)}
        disabled={ankiStatus !== 'ready'}
        style={{ marginTop: '0.5rem' }}
      >
        {t?.reshuffle || 'Reshuffle'}
      </button>
    )}
        {cardMode === 'select' && (
      <div style={{ marginTop: '0.75rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t?.searchCards || 'Search cards (blank = browse)'}
            className="select-input"
          />
<button type="submit">{t?.search || 'Search'}</button>
        </form>
        <div style={{ marginTop: '0.5rem', maxHeight: '12rem', overflowY: 'auto' }}>
          {searchResults.map((card) => (
            <label
              key={card.id}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0' }}
            >
              <input
                type="checkbox"
                checked={pickedCards.some((c) => c.id === card.id)}
                onChange={() => togglePick(card)}
              />
                            <ruby>
                              <span dangerouslySetInnerHTML={{ __html: card.displayHtml }} />
              </ruby>
            </label>
          ))}
        </div>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          {pickedCards.length} / {MAX_PICKED} {t?.selectedCards || 'selected'}
        </p>
      </div>
    )}

  {/* 3. Scenario Controls (JLPT & Formality Level) */}
  <div className="panel-box">
    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Sliders style={{ width: 16, height: 16, color: 'var(--shu-500)' }} />
      {t?.scenarioControls || 'Scenario Controls'}
    </h2>

    {/* JLPT Level Picker */}
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
        {t?.jlptLevel || 'JLPT Level'}
      </label>
      <div className="jlpt-grid">
        {['N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setJlptLevel(lvl)}
            className={`jlpt-btn ${jlptLevel === lvl ? 'active' : ''}`}
          >
            {lvl}
          </button>
        ))}
      </div>
    </div>

    {/* Formality Level Picker */}
    <div>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
        {t?.formalityLevel || 'Formality Level'}
      </label>
      <select 
        value={formality}
        onChange={(e) => setFormality(e.target.value)}
        className="select-input"
      >
        {(activeScenario?.supportedFormalities || [
          'Casual (タメ口)',
          'Teineigo (丁寧語 - Polite)',
          'Keigo (敬語 - Honorific/Humble)'
        ]).map((f) => (
          <option key={f} value={f}>
            {f.includes('Casual') 
              ? (t?.casual || 'Casual (タメ口)') 
              : f.includes('Teineigo') 
              ? (t?.polite || 'Polite (丁寧語)') 
              : (t?.keigo || 'Keigo (敬語)')}
          </option>
        ))}
      </select>
    </div>
  </div>

  {/* 4. Target Vocabulary & Deck Tracker */}
  <div className="panel-box">
    <div className="card-tracker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <h2 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <BookOpen style={{ width: 16, height: 16, color: 'var(--matcha-500)' }} />
        {t?.targetVocab || 'Deck Vocabulary'}
      </h2>
      <span className="vocab-progress-badge">
        {(usedWords?.size || 0)} / {(deckCards?.length || 0)} {t?.practiced || 'Practiced'}
      </span>
    </div>

    <div className="card-list">
      {deckCards && deckCards.length > 0 ? (
        deckCards.map((card, idx) => {
          const isUsed = usedWords && typeof usedWords.has === 'function' ? usedWords.has(card.expression) : false;
          return (
            <div key={card.id || idx} className={`card-item ${isUsed ? 'used' : ''}`}>
              <div>
                  <div
                  className="card-expression"
                  dangerouslySetInnerHTML={{ __html: card.displayHtml }}
                />
                {isUsed && (
                  <div className="card-status-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem' }}>
                    <Check style={{ width: 10, height: 10 }} /> {t?.usedInChat || 'Used'}
                  </div>
                )}
              </div>
              <div className="card-english">{card.english || card.meaning}</div>
            </div>
          );
        })
      ) : (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {t?.noDecks || 'No deck cards loaded.'}
        </p>
      )}
    </div>
  </div>
          </div>

          <div className="sidebar-bottom">
            <button
              type="button"
              className="sidebar-nav-btn"
              onClick={() => setShowSettings(true)}
              title={t?.settings || 'Settings'}
            >
              <Settings style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="sidebar-label">{t?.settings || 'Settings'}</span>
            </button>
          </div>
        </aside>

        {/* 3. Main Centered Chat Container Area */}
        <main className="main-chat-area">
          {activeTab === 'chat' ? (
            <div className="chat-container">
            <div className="chat-header">
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {activeScenario.title[systemLang] || activeScenario.title.en}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.role}: {t.customer} | Level: {jlptLevel} | Formality: {formality}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={handleNewChat}
                title="New chat"
              >
                <RotateCcw style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {!isAiConfigured(aiSettings) && (
              <div className="notice-banner">
                <div>
                  <strong>Add an AI key to start chatting.</strong>
                  <span>Open settings, and add your own AI key, proxy is available</span>
                </div>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    setSettingsTab('system');
                    setShowSettings(true);
                  }}
                >
                  Open Settings
                </button>
              </div>
            )}
            {ankiStatus === 'error' && !ankiBannerHidden && (
                <div className="notice-banner anki-banner">
                  <div>
                    <strong>Anki isn't connected.</strong>
                    <span> Open Anki with AnkiConnect running. You can still chat without it.</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setAnkiBannerHidden(true)}
                    title="Dismiss"
                    aria-label="Dismiss"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            <div className="chat-messages">
              
              {messages.map((msg, idx) => (
                <div key={idx} className={`message-row ${msg.sender}`}>
                  <div className={`chat-bubble ${msg.sender}`}>
                    <div className="chat-bubble-header">
                      {msg.furiganaHtml ? (
                                              <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeFurigana(msg.furiganaHtml, {
                              highlightKanji: display.highlightKanji,
                              targets: display.highlightTarget
                                ? deckCards.map((c) => c.expression)
                                : [],
                            }),
                          }}
                        />
                      ) : (
                        <div>{msg.text}</div>
                      )}

                      <button
                        onClick={() => speakJapanese(msg.text)}
                        className="speech-btn"
                        title="Listen"
                        type="button"
                      >
                        <Volume2 style={{ width: 16, height: 16 }} />
                      </button>
                    </div>

                    {msg.translation && display.translationMode !== 'off' && (
                      <div
                        className={`translation-text ${
                          display.translationMode === 'hover' ? 'on-hover' : ''
                        }`}
                      >
                        {msg.translation}
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && msg.feedback && (
                    <div className="user-feedback-box">
                      <div className="feedback-header">
                        <AlertCircle style={{ width: 14, height: 14 }} /> {t.grammarHint}
                      </div>
                      <div className="corrected-text">
                        {t.better}: 「{msg.feedback.correctedText}」
                      </div>
                      <div className="feedback-explanation">
                        {msg.feedback.explanation}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="message-row ai">
                  <div className="chat-bubble ai" style={{ opacity: 0.6 }}>
                    {t.thinking}
                  </div>
                </div>
              )}
            </div>

            {/* HINTS OVERLAY PANEL */}
            {showHints && (
              <div className="hints-overlay-panel">
                <div className="hints-panel-header">
                  <div className="hints-title">
                    <Lightbulb style={{ width: 16, height: 16, color: 'var(--shu-500)' }} />
                    {t.hintTitle}
                  </div>
                  <button onClick={() => setShowHints(false)} className="icon-btn" type="button">
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {loadingHints ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    {t.generatingHints}
                  </div>
                ) : hints.length > 0 ? (
                  <div className="hints-grid">
                    {hints.map((hint, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectHint(hint.japanese)}
                        className="hint-card"
                      >
                        <div className="hint-japanese">{hint.japanese}</div>
                        <div className="hint-reading">{hint.reading}</div>
                        <div className="hint-english">{hint.english}</div>
                        {hint.explanation && (
                          <div className="hint-explanation">{hint.explanation}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t.noHintsFound}
                  </div>
                )}
              </div>
            )}

            {/* CHAT INPUT FORM WITH HINT BUTTON */}
            <form onSubmit={handleSend} className="chat-input-area">
              <button
  type="button"
  onClick={() => {
    setIsHintGlowing(false);
    handleGetHints();
  }}
  disabled={loadingHints || loading}
  className={`hint-toggle-btn ${isHintGlowing ? 'glowing' : ''}`}
  title={t?.getHint || 'Get Hint'}
>
  <Lightbulb style={{ width: 16, height: 16, color: 'var(--shu-500)', flexShrink: 0 }} />
  <span className="hint-btn-text">{t?.getHint || 'Help Reply'}</span>
</button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.inputPlaceholder}
                className="text-input"
                disabled={loading}
              />
              <button type="submit" className="send-btn" disabled={loading}>
                <Send style={{ width: 18, height: 18 }} />
              </button>
            </form>
          </div>
          ) : (
        <div className="scenarios-container">
          <div className="scenarios-header">
            <div>
              <h1 className="scenarios-title">{t.scenariosTitle}</h1>
              <p className="scenarios-sub">{t.scenariosSubtitle}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="secondary-btn" onClick={handleExportScenarios}>
                <Download style={{ width: 16, height: 16 }} />
                Export
              </button>
              <label className="secondary-btn">
                <Upload style={{ width: 16, height: 16 }} />
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                onClick={openCreateModal}
                className="primary-btn"
                type="button"
              >
                <Plus style={{ width: 18, height: 18 }} />
                {t.createScenarioBtn}
              </button>
            </div>
          </div>

          <div className="scenarios-filter-bar">
            <div className="search-wrapper">
              <Search style={{ width: 16, height: 16 }} />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={formalityFilter}
              onChange={(e) => setFormalityFilter(e.target.value)}
              className="select-input"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="ALL">{t.allFormalities}</option>
              <option value="Casual (タメ口)">{t.casual}</option>
              <option value="Teineigo (丁寧語 - Polite)">{t.polite}</option>
              <option value="Keigo (敬語 - Honorific/Humble)">{t.keigo}</option>
            </select>
          </div>

          {/* Scenario Cards Grid */}
          <div className="scenarios-grid">
            {filteredScenarios.map((scen) => {
              const cleanIconKey = (scen.icon || '').trim();
              const IconComponent = SCENARIO_ICONS[cleanIconKey] || Sparkles;

              return (
                <div key={scen.id} className="scenario-card">
                  <div>
                    <div className="scenario-card-header">
                      <div className="scenario-icon-box">
                        <IconComponent style={{ width: 20, height: 20 }} />
                      </div>
                      <div className="scenario-card-title">
                        {scen.title[systemLang] || scen.title.en}
                      </div>
                      {String(scen.id).startsWith('custom-') && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => openEditModal(scen)}
                          title="Edit scenario"
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                    <p className="scenario-card-desc" style={{ marginTop: '0.75rem' }}>
                      {scen.description[systemLang] || scen.description.en}
                    </p>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      {t.supportedFormalities}
                    </div>
                    <div className="formality-tags-group">
                      {scen.supportedFormalities.map((f) => (
                        <span key={f} className="formality-chip">
                          {f.includes('Casual') ? 'タメ口' : f.includes('Teineigo') ? '丁寧語' : '敬語'}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleLaunchScenario(scen)}
                      className="primary-btn"
                      style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
                      type="button"
                    >
                      {t.startPractice} <ArrowRight style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE SCENARIO MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus style={{ width: 18, height: 18, color: 'var(--shu-500)' }} />
                {editingId ? 'Edit scenario' : t.createTitle}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="icon-btn" type="button">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="modal-body">
              <div className="form-group">
                <label className="form-label">{t.selectIcon || "Choose Scenario Icon"}</label>
                <div className="icon-picker-grid">
                  {Object.keys(SCENARIO_ICONS).map((iconKey) => {
                    const BtnIcon = SCENARIO_ICONS[iconKey];
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setNewIcon(iconKey)}
                        className={`icon-choice-btn ${newIcon === iconKey ? 'selected' : ''}`}
                        title={iconKey}
                      >
                        <BtnIcon style={{ width: 18, height: 18 }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.scenarioNameEn}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asking for a refund at a clothing store"
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.scenarioNameJa}</label>
                <input
                  type="text"
                  placeholder="例：服屋での返品依頼"
                  value={newTitleJa}
                  onChange={(e) => setNewTitleJa(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.descriptionEn}</label>
                <input
                  type="text"
                  placeholder="Short description of the scenario"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.initialGreetingText}</label>
                <input
                  type="text"
                  required
                  placeholder="例：いらっしゃいませ。どのようなご用件でしょうか？"
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.initialGreetingTranslation}</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome. How can I help you today?"
                  value={newTranslation}
                  onChange={(e) => setNewTranslation(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.selectFormalities}</label>
                <div className="checkbox-group">
                  {[
                    'Casual (タメ口)',
                    'Teineigo (丁寧語 - Polite)',
                    'Keigo (敬語 - Honorific/Humble)',
                  ].map((f) => (
                    <label key={f} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newFormalities.includes(f)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewFormalities([...newFormalities, f]);
                          } else if (newFormalities.length > 1) {
                            setNewFormalities(newFormalities.filter((item) => item !== f));
                          }
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="primary-btn" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
                {editingId ? 'Save changes' : t.saveScenario}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleDeleteScenario}
                  style={{ justifyContent: 'center', color: '#e5484d', borderColor: '#e5484d' }}
                >
                  Delete scenario
                </button>
              )}
            </form>
          </div>
        </div>
      )}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
  <div 
    className="modal-overlay" 
    onClick={() => setShowSettings(false)}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}
  >
    <div 
      className="modal-content" 
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '1.25rem',
        width: '90%',
        maxWidth: '420px',
        padding: '1.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}
    >
      {/* Modal Header */}
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t?.settings || 'Settings'}
        </h3>
        <button 
          className="icon-btn" 
          onClick={() => setShowSettings(false)} 
          type="button"
          aria-label="Close settings"
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

            {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          ['appearance', 'Appearance'],
          ['system', 'System'],
          ['chat', 'Chat'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`lang-btn ${settingsTab === key ? 'active' : ''}`}
            onClick={() => setSettingsTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Settings Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Appearance / Theme */}
        {settingsTab === 'appearance' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Appearance / テーマ
          </label>
          <div className="lang-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className={`lang-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Moon style={{ width: 15, height: 15 }} />
              Dark
            </button>
            <button
              type="button"
              className={`lang-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Sun style={{ width: 15, height: 15 }} />
              Light
            </button>
          </div>
                </div>
        )}

        {settingsTab === 'system' && (
        <>
        {/* AI Provider */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            AI Provider / AIプロバイダー
          </label>
          <div className="lang-toggle-grid">
            <button
              type="button"
              className={`lang-btn ${aiSettings.provider === 'gemini' ? 'active' : ''}`}
              onClick={() => setAiSettings((s) => ({ ...s, provider: 'gemini' }))}
            >
              Gemini
            </button>
            <button
              type="button"
              className={`lang-btn ${aiSettings.provider === 'custom' ? 'active' : ''}`}
              onClick={() => setAiSettings((s) => ({ ...s, provider: 'custom' }))}
            >
              Custom (OpenAI-compatible)
            </button>
          </div>

          {aiSettings.provider === 'gemini' ? (
            <div className="settings-fields">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Gemini API key"
                value={aiSettings.gemini.apiKey}
                onChange={(e) =>
                  setAiSettings((s) => ({ ...s, gemini: { ...s.gemini, apiKey: e.target.value } }))
                }
                className="settings-input"
              />
              <select
                value={aiSettings.gemini.model}
                onChange={(e) =>
                  setAiSettings((s) => ({ ...s, gemini: { ...s.gemini, model: e.target.value } }))
                }
                className="select-input"
              >
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
              </select>
              <p className="settings-hint">
                Get a free key at{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/apikey
                </a>
                . It is stored only in this browser.
              </p>
            </div>
          ) : (
            <div className="settings-fields">
              <input
                type="text"
                spellCheck={false}
                placeholder="Base URL, e.g. https://api.example.com/v1"
                value={aiSettings.custom.baseUrl}
                onChange={(e) =>
                  setAiSettings((s) => ({ ...s, custom: { ...s.custom, baseUrl: e.target.value } }))
                }
                className="settings-input"
              />
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="API key"
                value={aiSettings.custom.apiKey}
                onChange={(e) =>
                  setAiSettings((s) => ({ ...s, custom: { ...s.custom, apiKey: e.target.value } }))
                }
                className="settings-input"
              />
              <input
                type="text"
                spellCheck={false}
                placeholder="Model name"
                value={aiSettings.custom.model}
                onChange={(e) =>
                  setAiSettings((s) => ({ ...s, custom: { ...s.custom, model: e.target.value } }))
                }
                className="settings-input"
              />
              <p className="settings-hint">
                Works with services that follow the OpenAI chat format. The service must allow requests
                from a browser. Stored only in this browser.
              </p>
            </div>
          )}
        </div>

        {/* Interface Language */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Interface Language / 言語
          </label>
          <div className="lang-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
              type="button"
              className={`lang-btn ${systemLang === 'en' ? 'active' : ''}`}
              onClick={() => setSystemLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`lang-btn ${systemLang === 'ja' ? 'active' : ''}`}
              onClick={() => setSystemLang('ja')}
            >
              日本語
            </button>
          </div>
        </div>
        </>
        )}
        {settingsTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              ['translationMode', 'English translation / 英訳'],
              ['furiganaMode', 'Furigana / ふりがな'],
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {label}
                </label>
                <select
                  value={display[key]}
                  onChange={(e) => setDisplay((d) => ({ ...d, [key]: e.target.value }))}
                  className="select-input"
                >
                  <option value="always">Always show / 常に表示</option>
                  <option value="hover">Show on hover / ホバーで表示</option>
                  <option value="off">Hide / 非表示</option>
                </select>
              </div>
            ))}

            <div className="checkbox-group">
              {[
                ['highlightKanji', 'Highlight kanji / 漢字を強調'],
                ['highlightTarget', 'Highlight target words / 目標単語を強調'],
              ].map(([key, label]) => (
                <label key={key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={display[key]}
                    onChange={(e) => setDisplay((d) => ({ ...d, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}


    </div>
  );
}

