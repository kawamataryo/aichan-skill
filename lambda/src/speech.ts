/** ホワイトリストで許可するSSMLタグ: <break time="100ms"〜"9999ms" /> のみ */
const BREAK_TAG_PATTERN = /<break\s+time="\d{1,4}ms"\s*\/>/g;

/**
 * AIが生成したテキストから <break> 以外のタグを除去する
 */
function sanitizeSsml(text: string): string {
  const preserved: string[] = [];

  // <break> タグをプレースホルダーに退避
  let result = text.replace(BREAK_TAG_PATTERN, (match) => {
    preserved.push(match);
    return `__SSML_${preserved.length - 1}__`;
  });

  // 残りの不正なタグをすべて除去
  result = result.replace(/<[^>]+>/g, "");

  // プレースホルダーを復元
  result = result.replace(/__SSML_(\d+)__/g, (_, i) => preserved[Number(i)]);

  return result;
}

export function fastSpeech(text: string): string {
  const sanitized = sanitizeSsml(text);
  return `<speak><prosody rate="130%">${sanitized}</prosody></speak>`;
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
