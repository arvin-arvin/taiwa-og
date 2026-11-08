/**
 * Speaks the given text using the browser's native Japanese voice.
 */
export function speakJapanese(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('Text-to-speech is not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip native HTML tags if furigana HTML was passed
  const cleanText = text.replace(/<[^>]*>/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9; // Slightly slower for language learners

  // Try to pick a Japanese voice if available
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find((v) => v.lang.includes('ja') || v.lang.includes('JP'));
  if (jaVoice) {
    utterance.voice = jaVoice;
  }

  window.speechSynthesis.speak(utterance);
}