/**
 * Speaks Japanese text via local Vite proxy (bypasses CORS/ORB blocking).
 */
export function speakJapanese(text) {
  if (!text) return;

  // Strip native HTML tags if furigana HTML was passed
  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  const encodedText = encodeURIComponent(cleanText);

  // Call through Vite local server proxy
  const audioUrl = `/api/tts?ie=UTF-8&q=${encodedText}&tl=ja&client=tw-ob`;

  const audio = new Audio(audioUrl);
  
  audio.play().catch((err) => {
    console.error("Audio playback error:", err);
  });
}