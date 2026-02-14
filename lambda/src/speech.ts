export function fastSpeech(text: string): string {
  return `<speak><prosody rate="135%">${text}</prosody></speak>`;
}
