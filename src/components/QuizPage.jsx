import React, { useState } from 'react';
import { generateQuiz } from '../services/ai';
import DrawPad from './DrawPad';
import { Check, X, RotateCcw } from 'lucide-react';

const MEDIA_KEY = 'taiwa.media.v1';
const KANJI = /[\u3400-\u9fff々]/;

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
    kanji: 'Kanji writing',
    kanjiHint: (n) => `${n} cards with kanji in the side panel`,
    noKanji: 'None of the selected cards contain kanji. Pick another deck in the side panel.',
    writeThis: 'Write this word',
    showAnswer: 'Show answer',
    gotIt: 'I wrote it correctly',
    notYet: 'Not yet',
    clear: 'Clear',
    selfCheck: 'Compare with your writing, then mark yourself.',
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
    kanji: '漢字の書き取り',
    kanjiHint: (n) => `サイドパネルの漢字を含むカード: ${n}枚`,
    noKanji: '選択中のカードに漢字がありません。サイドパネルで別のデッキを選んでください。',
    writeThis: 'この言葉を書いてください',
    showAnswer: '答えを見る',
    gotIt: '正しく書けた',
    notYet: 'まだ',
    clear: '消す',
    selfCheck: '自分の字と見比べて、自己採点してください。',
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
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .toLowerCase();
}

function questionText(q) {
  if (q.type === 'mcq') return q.question;
  if (q.type === 'fill') return q.sentence;
  return [q.reading, q.english].filter(Boolean).join(' · ');
}

function answerText(q) {
  if (q.type === 'mcq') return q.options[q.answer];
  if (q.type === 'fill') return q.answer;
  return q.expression;
}

function shuffleList(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // { question, correct, given }

  const mediaLines = phase === 'setup' ? readSavedLines() : [];
  const kanjiCards = cards.filter((c) => KANJI.test(c.expression || ''));
  const sourceReady =
    kind === 'kanji'
      ? kanjiCards.length > 0
      : sourceType === 'anki'
        ? cards.length > 0
        : mediaLines.length > 0;

  const resetRun = (list) => {
    setQuestions(list);
    setIndex(0);
    setPicked(null);
    setTyped('');
    setChecked(false);
    setRevealed(false);
    setResults([]);
    setPhase('running');
  };

  const handleStart = async () => {
    if (!sourceReady || loading) return;
    setLoading(true);
    setMessage('');
    try {
      if (kind === 'kanji') {
        resetRun(
          shuffleList(kanjiCards)
            .slice(0, count)
            .map((c) => ({
              type: 'kanji',
              expression: c.expression,
              reading: c.reading || '',
              english: c.english || '',
            }))
        );
        return;
      }
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
    if (given === '') return false;
    const accepted = [q.answer, q.reading, ...(q.alternatives || [])].filter(Boolean).map(normalise);
    return accepted.includes(given);
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

  const goNext = () => {
    if (index + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setTyped('');
    setChecked(false);
    setRevealed(false);
  };

  const handleNext = goNext;

  // Kanji writing is marked by the learner after seeing the answer
  const handleGrade = (correct) => {
    setResults((r) => [...r, { question: q, correct, given: '' }]);
    goNext();
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
          {kind !== 'kanji' && (
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
          )}

          <div className="quiz-group">
            <span className="media-label">{tt.type}</span>
            <div className="quiz-choices">
              {['mixed', 'mcq', 'fill', 'kanji'].map((k) => (
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
            {kind === 'kanji' && (
              <p className="media-empty">
                {kanjiCards.length > 0 ? tt.kanjiHint(kanjiCards.length) : tt.noKanji}
              </p>
            )}
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

          {q.type === 'kanji' ? (
            <>
              <p className="media-label" style={{ margin: 0 }}>{tt.writeThis}</p>
              <p className="quiz-question">
                {q.reading && <span>{q.reading}</span>}
                {q.reading && q.english && <span className="media-reading"> · </span>}
                {q.english && <span className="media-reading">{q.english}</span>}
              </p>
              <DrawPad key={index} cells={Math.min(Math.max(q.expression.length, 1), 6)} clearLabel={tt.clear} />
              {revealed && (
                <div className="quiz-feedback">
                  <div className="quiz-answer-big">{q.expression}</div>
                  <p>{tt.selfCheck}</p>
                </div>
              )}
            </>
          ) : q.type === 'mcq' ? (
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

          {q.type !== 'kanji' && checked && (
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

          {q.type === 'kanji' ? (
            <div className="media-actions">
              {!revealed ? (
                <button
                  type="button"
                  className="secondary-btn media-explain-btn"
                  onClick={() => setRevealed(true)}
                >
                  {tt.showAnswer}
                </button>
              ) : (
                <>
                  <button type="button" className="secondary-btn media-explain-btn" onClick={() => handleGrade(true)}>
                    {tt.gotIt}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => handleGrade(false)}>
                    {tt.notYet}
                  </button>
                </>
              )}
            </div>
          ) : (
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
          )}
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
                  <div>{questionText(r.question)}</div>
                  <div className="media-reading">
                    {r.correct
                      ? answerText(r.question)
                      : `${r.given ? `${tt.yourAnswer} ${r.given} · ` : ''}${tt.answerIs} ${answerText(r.question)}`}
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