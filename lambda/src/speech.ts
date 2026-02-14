export function fastSpeech(text: string): string {
  return `<speak><prosody rate="130%">${text}</prosody></speak>`;
}

function pickRandom(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)];
}

const GREETINGS = [
  "はーい、あいちゃんだよ。何でも聞いてね。",
  "呼んだ？あいちゃんだよ。今日は何が知りたい？",
  "やっほー、あいちゃんだよ。何か気になることある？",
  "あいちゃん参上！何でも聞いて。",
  "はいはーい。あいちゃんだよ。どうしたの？",
  "おっ、来たね！あいちゃんだよ。何話す？",
  "あいちゃんだよー。今日も張り切っていくよ！",
  "はいはい、あいちゃんでーす。なんでも聞いてね。",
  "あいちゃん、スタンバイOK！何でもどうぞ。",
  "おまたせ！あいちゃんだよ。何か聞きたいことある？",
  "あいちゃんだよ。今日はどんなこと話す？",
  "はーい！あいちゃん、準備万端だよ。",
  "あいちゃんだよ。何でも気軽に聞いてね。",
  "よんだ？あいちゃんだよー。どんな質問でもOK！",
  "あいちゃんでーす。いつでも聞いてね。",
  "はーい、あいちゃん登場！何かある？",
  "あいちゃんだよ。今日も一緒に楽しくやろう！",
  "お、久しぶり？あいちゃんだよ。何でも聞いて。",
  "あいちゃんだよー。調べものでも雑談でもOKだよ。",
  "はいはーい、あいちゃんだよ。何でもどうぞ！",
];

const FAREWELLS = [
  "ばいばーい、またね！",
  "またいつでも呼んでね。ばいばい！",
  "おつかれさま。また話そうね！",
  "じゃあね、また来てね！",
  "はーい、またね！いつでも待ってるよ。",
  "ばいばい！楽しかったよ。",
  "またね。いつでも気軽に呼んでね！",
  "おしまい！また遊ぼうね。",
  "じゃあまたね。良い一日を！",
  "ばいばーい。次も楽しみにしてるね！",
];

export function randomGreeting(): string {
  return pickRandom(GREETINGS);
}

export function randomFarewell(): string {
  return pickRandom(FAREWELLS);
}
