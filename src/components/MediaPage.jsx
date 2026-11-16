import React, { useState, useEffect } from 'react';
import { parseMediaText, MAX_MEDIA_LINES } from '../services/media';
import { explainMediaLine } from '../services/ai';
import { speakJapanese } from '../services/speech';
import { sanitizeFurigana } from '../services/sanitize';
import { Upload, Trash2, Volume2, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'taiwa.media.v1';
const RANK = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };

const TEXT = {
  en: {
    title: 'Media Study',
    subtitle:
      'Study lines from anime subtitles or song lyrics. Paste text or load your own .srt, .vtt, .ass or .lrc file. Nothing is uploaded: your text stays in this browser.',
    placeholder: 'Paste lyrics or subtitle lines here...',
    addLines: 'Use this text',
    loadFile: 'Load file',
    clear: 'Clear all',
    lines: 'Lines',
    empty: 'No lines yet. Paste some text or load a file.',
    noJapanese: 'No Japanese lines were found in that text.',
    tooBig: 'That file is too large (2 MB maximum).',
    capped: `Only the first ${MAX_MEDIA_LINES} lines were kept.`,
    pick: 'Pick a line from the list to study it.',
    explainAt: 'Explain at',
    casual: 'Casual',
    formal: 'Formal',
    respectful: 'Respectful',
    explain: 'Explain this line',
    explaining: 'Explaining...',
    translation: 'Translation',
    register: 'Original style',
    level: 'Estimated level',
    above: 'Above your level',
    within: 'Within your level',
    rewrite: 'In your chosen style',
    words: 'Key words',
    grammar: 'Grammar',
    note: 'Note',
    noKey: 'Add your API key in Settings first.',
  },
  ja: {
    title: 'メディア学習',
    subtitle:
      'アニメの字幕や歌詞の一行を学習します。テキストを貼り付けるか、.srt / .vtt / .ass / .lrc ファイルを読み込んでください。テキストはこのブラウザの外には送られません。',
    placeholder: '歌詞や字幕をここに貼り付け...',
    addLines: 'このテキストを使う',
    loadFile: 'ファイルを読み込む',
    clear: 'すべて消去',
    lines: '行',
    empty: 'まだ行がありません。テキストを貼り付けるかファイルを読み込んでください。',
    noJapanese: '日本語の行が見つかりませんでした。',
    tooBig: 'ファイルが大きすぎます(最大2MB)。',
    capped: `最初の${MAX_MEDIA_LINES}行のみ保持しました。`,
    pick: 'リストから学習する行を選んでください。',
    explainAt: '解説の丁寧さ',
    casual: 'カジュアル',
    formal: '丁寧',
    respectful: '敬語',
    explain: 'この行を解説',
    explaining: '解説中...',
    translation: '英訳',
    register: '元の文体',
    level: '推定レベル',
    above: 'あなたのレベルより上',
    within: 'あなたのレベル内',
    rewrite: '選んだ文体で',
    words: '重要語',
    grammar: '文法',
    note: '補足',
    noKey: '先に設定でAPIキーを追加してください。',
  },
};

const REGISTER_LABEL = { casual: 'Casual', polite: 'Polite', keigo: 'Keigo', neutral: 'Neutral' };

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.lines)) return saved;
  } catch {
    // ignore a broken save
  }
  return { lines: [], selectedId: null, formality: 'formal' };
}

export default function MediaPage({ systemLang = 'en', jlptLevel = 'N4' }) {
  const tt = TEXT[systemLang] || TEXT.en;
  const [saved] = useState(loadSaved);
  const [raw, setRaw] = useState('');
  const [lines, setLines] = useState(saved.lines);
  const [selectedId, setSelectedId] = useState(saved.selectedId);
  const [formality, setFormality] = useState(saved.formality || 'formal');
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, selectedId, formality }));
    } catch {
      // storage full or blocked: the page still works for this visit
    }
  }, [lines, selectedId, formality]);

  const index = lines.findIndex((l) => l.id === selectedId);
  const selected = index >= 0 ? lines[index] : null;
  const cacheKey = selected ? [selected.id, formality, systemLang, jlptLevel].join('|') : '';
  const result = cacheKey ? cache[cacheKey] : null;

  const useLines = (parsed) => {
    setCache({});
    setSelectedId(null);
    setLines(parsed);
    if (parsed.length === 0) setMessage(tt.noJapanese);
    else if (parsed.length >= MAX_MEDIA_LINES) setMessage(tt.capped);
    else setMessage('');
  };

  const handleUseText = () => {
    useLines(parseMediaText(raw));
    setRaw('');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage(tt.tooBig);
      return;
    }
    useLines(parseMediaText(await file.text(), file.name));
  };

  const handleClear = () => {
    setCache({});
    setSelectedId(null);
    setLines([]);
    setMessage('');
  };

  const handleExplain = async () => {
    if (!selected || loading || result) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await explainMediaLine({
        line: selected.text,
        before: lines[index - 1]?.text || '',
        after: lines[index + 1]?.text || '',
        formality,
        jlptLevel,
        systemLang,
      });
      setCache((c) => ({ ...c, [cacheKey]: res }));
    } catch (err) {
      setMessage(err.message === 'NO_API_KEY' ? tt.noKey : err.message);
    } finally {
      setLoading(false);
    }
  };

  const aboveLevel = result?.jlpt && RANK[result.jlpt] > RANK[jlptLevel];

  return (
    <div className="media-container">
      <div className="media-header">
        <h1 className="scenarios-title">{tt.title}</h1>
        <p className="scenarios-sub">{tt.subtitle}</p>
      </div>

      <div className="media-layout">
        {/* Left: input and line list */}
        <div className="media-col">
          <div className="panel-box">
            <textarea
              className="media-textarea"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={tt.placeholder}
              rows={5}
            />
            <div className="media-actions">
              <button type="button" className="secondary-btn" onClick={handleUseText} disabled={!raw.trim()}>
                {tt.addLines}
              </button>
              <label className="secondary-btn">
                <Upload style={{ width: 16, height: 16 }} />
                {tt.loadFile}
                <input
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </label>
              {lines.length > 0 && (
                <button type="button" className="secondary-btn" onClick={handleClear}>
                  <Trash2 style={{ width: 16, height: 16 }} />
                  {tt.clear}
                </button>
              )}
            </div>
            {message && <p className="media-message">{message}</p>}
          </div>

          <div className="panel-box media-lines-box">
            <h2 className="panel-title">
              {tt.lines} ({lines.length})
            </h2>
            {lines.length === 0 ? (
              <p className="media-empty">{tt.empty}</p>
            ) : (
              <div className="media-lines">
                {lines.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`media-line ${l.id === selectedId ? 'active' : ''}`}
                    onClick={() => setSelectedId(l.id)}
                  >
                    <span className="media-line-no">{l.id + 1}</span>
                    <span>{l.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: explanation */}
        <div className="media-col">
          <div className="panel-box">
            {!selected ? (
              <p className="media-empty">{tt.pick}</p>
            ) : (
              <>
                <div className="media-selected">
                  <div className="media-selected-text">
                    {result?.furiganaHtml ? (
                      <span dangerouslySetInnerHTML={{ __html: sanitizeFurigana(result.furiganaHtml) }} />
                    ) : (
                      selected.text
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => speakJapanese(selected.text)}
                    title="Speak"
                  >
                    <Volume2 style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                <div className="media-style-row">
                  <span className="media-label">{tt.explainAt}</span>
                  {['casual', 'formal', 'respectful'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`media-chip ${formality === f ? 'active' : ''}`}
                      onClick={() => setFormality(f)}
                    >
                      {tt[f]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-btn media-explain-btn"
                  onClick={handleExplain}
                  disabled={loading || Boolean(result)}
                >
                  <Sparkles style={{ width: 16, height: 16 }} />
                  {loading ? tt.explaining : tt.explain}
                </button>

                {result && (
                  <div className="media-result">
                    <div className="media-badges">
                      {result.register && (
                        <span className="media-badge">
                          {tt.register}: {REGISTER_LABEL[result.register] || result.register}
                        </span>
                      )}
                      {result.jlpt && (
                        <span className={`media-badge ${aboveLevel ? 'warn' : 'ok'}`}>
                          {tt.level}: {result.jlpt} · {aboveLevel ? tt.above : tt.within}
                        </span>
                      )}
                    </div>

                    <h3 className="media-label">{tt.translation}</h3>
                    <p>{result.translation}</p>

                    <h3 className="media-label">{tt.rewrite}</h3>
                    <div className="media-rewrite">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: result.rewrite.furiganaHtml
                            ? sanitizeFurigana(result.rewrite.furiganaHtml)
                            : '',
                        }}
                      />
                      {!result.rewrite.furiganaHtml && result.rewrite.text}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => speakJapanese(result.rewrite.text)}
                        title="Speak"
                      >
                        <Volume2 style={{ width: 16, height: 16 }} />
                      </button>
                    </div>

                    {result.words.length > 0 && (
                      <>
                        <h3 className="media-label">{tt.words}</h3>
                        <ul className="media-words">
                          {result.words.map((w, i) => (
                            <li key={`${w.word}-${i}`}>
                              <strong>{w.word}</strong>
                              {w.reading && <span className="media-reading"> {w.reading}</span>}
                              <span> — {w.meaning}</span>
                              {w.jlpt && <span className="media-badge small">{w.jlpt}</span>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {result.grammar.length > 0 && (
                      <>
                        <h3 className="media-label">{tt.grammar}</h3>
                        <ul className="media-words">
                          {result.grammar.map((g, i) => (
                            <li key={`${g.pattern}-${i}`}>
                              <strong>{g.pattern}</strong>
                              <span> — {g.explanation}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {result.note && (
                      <>
                        <h3 className="media-label">{tt.note}</h3>
                        <p>{result.note}</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}