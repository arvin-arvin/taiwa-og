import React from 'react';
import { WORD_LISTS } from '../constants/wordlists';
import { BookOpen } from 'lucide-react';

const TEXT = {
  en: {
    title: 'Word source',
    anki: 'Anki',
    builtin: 'Built-in lists',
    list: 'Word list',
    count: 'Words to practise',
    reshuffle: 'Reshuffle',
    note: 'Ready-made vocabulary for each scenario. No Anki needed.',
    ankiOff: 'Anki is not connected',
  },
  ja: {
    title: '単語の取得元',
    anki: 'Anki',
    builtin: '内蔵リスト',
    list: '単語リスト',
    count: '練習する単語数',
    reshuffle: 'シャッフル',
    note: 'シナリオ別のすぐ使える単語です。Ankiは不要です。',
    ankiOff: 'Ankiに接続されていません',
  },
};

export default function WordListPanel({
  lang = 'en',
  wordSource,
  onSourceChange,
  ankiReady,
  listId,
  onListChange,
  count,
  onCountChange,
  onReshuffle,
}) {
  const tt = TEXT[lang] || TEXT.en;
  return (
    <div className="panel-box">
      <h2 className="panel-title">
        <BookOpen style={{ width: 16, height: 16, color: 'var(--shu-500)' }} />
        {tt.title}
      </h2>
      <div className="source-toggle">
        <button
          type="button"
          className={`media-chip ${wordSource === 'anki' ? 'active' : ''}`}
          onClick={() => onSourceChange('anki')}
          disabled={!ankiReady}
          title={ankiReady ? '' : tt.ankiOff}
        >
          {tt.anki}
        </button>
        <button
          type="button"
          className={`media-chip ${wordSource === 'builtin' ? 'active' : ''}`}
          onClick={() => onSourceChange('builtin')}
        >
          {tt.builtin}
        </button>
      </div>

      {wordSource === 'builtin' && (
        <div style={{ marginTop: '0.75rem' }}>
          <label className="source-label">{tt.list}</label>
          <select value={listId} onChange={(e) => onListChange(e.target.value)} className="select-input">
            {WORD_LISTS.map((l) => (
              <option key={l.id} value={l.id}>
                {(l.title[lang] || l.title.en)} ({l.level})
              </option>
            ))}
          </select>
          <label className="source-label">{tt.count}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={Math.min(count, 12)}
              onChange={(e) => onCountChange(Number(e.target.value))}
              className="select-input"
            >
              {[5, 8, 10, 12].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button type="button" className="secondary-btn" onClick={onReshuffle}>{tt.reshuffle}</button>
          </div>
          <p className="media-empty" style={{ marginTop: '0.6rem' }}>{tt.note}</p>
        </div>
      )}
    </div>
  );
}