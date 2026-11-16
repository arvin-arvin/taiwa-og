import React, { useState } from 'react';
import { generateQuiz } from '../services/ai';
import { Check, X, RotateCcw } from 'lucide-react';

const MEDIA_KEY = 'taiwa.media.v1';

const TEXT = {
  en: {
    title: 'Quiz',
    subtitle: 'Practise with questions made from your Anki words or from the media lines you loaded.',
    source: 'Questions from',
    anki: 'My Anki words',
    media: 'Media lines',
    ankiHint: (n) => `${n} cards selected in the side panel`,
    mediaHint: (n) => `${n} saved lines`,
    noCards: 'Pick a deck in the side panel first.',
    noLines: 'Load some lines in Media Study first.',
    type: 'Question type',
    mcq: 'Multiple choice',
    fill: 'Fill in the blank',
    mixed: 'Mixed',
    howMany: 'Number of questions',
    start: 'Start quiz',
    making: 'Making your quiz...',
    noKey: 'Add your API key in Settings first.',
    question: 'Question',
    typeAnswer: 'Type the missing word',
    check: 'Check',
    next: 'Next',
    finish: 'See results',
    correct: 'Correct!',
    wrong: 'Not quite.',
    answerIs: 'Answer:',
    score: 'Score',
    review: 'Review',
    again: 'Same questions again',
    newQuiz: 'New quiz',
    yourAnswer: 'Your answer:',
  },
  ja: {
    title: 'クイズ',
    subtitle: 'Ankiの単語や読み込んだメディアの行から作った問題で練習します。',
    source: '出題元',
    anki: 'Ankiの単語',
    media: 'メディアの行',
    ankiHint: (n) => `サイドパネルで選択中: ${n}枚`,
    mediaHint: (n) => `保存済み: ${n}行`,
    noCards: '先にサイドパネルでデッキを選んでください。',
    noLines: '先にメディア学習で行を読み込んでください。',
    type: '問題の種類',
    mcq: '選択式',
    fill: '穴埋め',
    mixed: 'ミックス',
    howMany: '問題数',
    start: 'クイズ開始',
    making: 'クイズを作成中...',
    noKey: '先に設定でAPIキーを追加してください。',
    question: '問題',
    typeAnswer: '空欄に入る言葉を入力',
    check: '答え合わせ',
    next: '次へ',
    finish: '結果を見る',
    correct: '正解!',
    wrong: '残念。',
    answerIs: '答え:',
    score: 'スコア',
    review: '復習',
    again: '同じ問題をもう一度',
    newQuiz: '新しいクイズ',
    yourAnswer: 'あなたの答え:',
  },
};

function readSavedLines() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDIA_KEY) || 'null');
    return Array.isArray(saved?.lines) ? saved.lines.map((l) => l.text).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Katakana to hiragana, so "アメ" and "あめ" count the same
function normalise(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .toLowerCase();
}

export default function QuizPage({ cards = [], jlptLevel = 'N4', systemLang = 'en' }) {
  const tt = TEXT[systemLang] || TEXT.en;
  const [phase, setPhase] = useState('setup'); // setup | running | done
  const [sourceType, setSourceType] = useState('anki');
  const [kind, setKind] = useState('mixed');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState([]); // { question, correct, given }

  const mediaLines = phase === 'setup' ? readSavedLines() : [];
  const sourceReady = sourceType === 'anki' ? cards.length > 0 : mediaLines.length > 0;

  const resetRun = (list) => {
    setQuestions(list);
    setIndex(0);
    setPicked(null);
    setTyped('');
    setChecked(false);
    setResults([]);
    setPhase('running');
  };

  const handleStart = async () => {
    if (!sourceReady || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const source =
        sourceType === 'anki'
          ? { type: 'anki', cards }
          : { type: 'media', lines: mediaLines };
      resetRun(await generateQuiz({ source, kind, count, jlptLevel, systemLang }));
    } catch (err) {
      setMessage(err.message === 'NO_API_KEY' ? tt.noKey : err.message);
    } finally {
      setLoading(false);
    }
  };

  const q = questions[index];

  const isCorrect = () => {
    if (!q) return false;
    if (q.type === 'mcq') return picked === q.answer;
    const given = normalise(typed);
    return given !== '' && (given === normalise(q.answer) || (q.reading && given === normalise(q.reading)));
  };

  const handleCheck = () => {
    if (checked || !q) return;
    if (q.type === 'mcq' && picked === null) return;
    if (q.type === 'fill' && !typed.trim()) return;
    const correct = isCorrect();
    setChecked(true);
    setResults((r) => [
      ...r,
      { question: q, correct, given: q.type === 'mcq' ? q.options[picked] : typed.trim() },
    ]);
  };

  const handleNext = () => {
    if (index + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setTyped('');
    setChecked(false);
  };

  const correctCount = results.filter((r) => r.correct).length;

  return (
    <div className="media-container">
      <div className="media-header">
        <h1 className="scenarios-title">{tt.title}</h1>
        <p className="scenarios-sub">{tt.subtitle}</p>
      </div>

      {phase === 'setup' && (
        <div className="panel-box quiz-setup">
          <div className="quiz-group">
            <span className="media-label">{tt.source}</span>
            <div className="quiz-choices">
              {['anki', 'media'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`media-chip ${sourceType === s ? 'active' : ''}`}
                  onClick={() => setSourceType(s)}
                >
                  {tt[s]}
                </button>
              ))}
            </div>
            <p className="media-empty">
              {sourceType === 'anki'
                ? cards.length > 0
                  ? tt.ankiHint(cards.length)
                  : tt.noCards
                : mediaLines.length > 0
                  ? tt.mediaHint(mediaLines.length)
                  : tt.noLines}
            </p>
          </div>

          <div className="quiz-group">
            <span className="media-label">{tt.type}</span>
            <div className="quiz-choices">
              {['mixed', 'mcq', 'fill'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`media-chip ${kind === k ? 'active' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {tt[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-group">
            <span className="media-label">{tt.howMany}</span>
            <div className="quiz-choices">
              {[5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`media-chip ${count === n ? 'active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="secondary-btn media-explain-btn"
            onClick={handleStart}
            disabled={!sourceReady || loading}
          >
            {loading ? tt.making : tt.start}
          </button>
          {message && <p className="media-message">{message}</p>}
        </div>
      )}

      {phase === 'running' && q && (
        <div className="panel-box quiz-card">
          <div className="quiz-progress">
            {tt.question} {index + 1} / {questions.length}
          </div>

          {q.type === 'mcq' ? (
            <>
              <p className="quiz-question">{q.question}</p>
              <div className="quiz-options">
                {q.options.map((opt, i) => {
                  let state = '';
                  if (checked && i === q.answer) state = 'right';
                  else if (checked && i === picked) state = 'wrong';
                  else if (!checked && i === picked) state = 'picked';
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`quiz-option ${state}`}
                      disabled={checked}
                      onClick={() => setPicked(i)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="quiz-question">{q.sentence}</p>
              {q.hint && <p className="media-empty">{q.hint}</p>}
              <input
                className="quiz-input"
                type="text"
                value={typed}
                disabled={checked}
                placeholder={tt.typeAnswer}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCheck();
                }}
              />
            </>
          )}

          {checked && (
            <div className={`quiz-feedback ${results[results.length - 1]?.correct ? 'right' : 'wrong'}`}>
              <strong>{results[results.length - 1]?.correct ? tt.correct : tt.wrong}</strong>
              {q.type === 'fill' && (
                <span>
                  {' '}
                  {tt.answerIs} {q.answer}
                  {q.reading && q.reading !== q.answer ? ` (${q.reading})` : ''}
                </span>
              )}
              {q.explanation && <p>{q.explanation}</p>}
            </div>
          )}

          <div className="media-actions">
            {!checked ? (
              <button
                type="button"
                className="secondary-btn media-explain-btn"
                onClick={handleCheck}
                disabled={q.type === 'mcq' ? picked === null : !typed.trim()}
              >
                {tt.check}
              </button>
            ) : (
              <button type="button" className="secondary-btn media-explain-btn" onClick={handleNext}>
                {index + 1 >= questions.length ? tt.finish : tt.next}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="panel-box quiz-card">
          <h2 className="panel-title">
            {tt.score}: {correctCount} / {results.length}
          </h2>
          <h3 className="media-label">{tt.review}</h3>
          <ul className="quiz-review">
            {results.map((r, i) => (
              <li key={i} className={r.correct ? 'right' : 'wrong'}>
                {r.correct ? (
                  <Check style={{ width: 16, height: 16, flexShrink: 0 }} />
                ) : (
                  <X style={{ width: 16, height: 16, flexShrink: 0 }} />
                )}
                <div>
                  <div>{r.question.type === 'mcq' ? r.question.question : r.question.sentence}</div>
                  <div className="media-reading">
                    {r.correct
                      ? r.question.type === 'mcq'
                        ? r.question.options[r.question.answer]
                        : r.question.answer
                      : `${tt.yourAnswer} ${r.given} · ${tt.answerIs} ${
                          r.question.type === 'mcq'
                            ? r.question.options[r.question.answer]
                            : r.question.answer
                        }`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="media-actions">
            <button type="button" className="secondary-btn" onClick={() => resetRun(questions)}>
              <RotateCcw style={{ width: 16, height: 16 }} />
              {tt.again}
            </button>
            <button type="button" className="secondary-btn media-explain-btn" onClick={() => setPhase('setup')}>
              {tt.newQuiz}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}