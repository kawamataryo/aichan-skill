/**
 * ホワイトリストで許可するSSMLタグのパターン
 * - <break time="100ms"〜"9999ms" />
 * - <prosody rate="slow|fast"> / </prosody>
 * - <emphasis level="strong|moderate"> / </emphasis>
 */
const VALID_SSML_PATTERNS: RegExp[] = [
  /<break\s+time="\d{1,4}ms"\s*\/>/g,
  /<prosody\s+rate="(?:slow|fast)"\s*>/g,
  /<\/prosody>/g,
  /<emphasis\s+level="(?:strong|moderate)"\s*>/g,
  /<\/emphasis>/g,
];

/**
 * 開きタグ・閉じタグのネストが正しいか検証する
 */
function isProperlyNested(text: string): boolean {
  const stack: string[] = [];
  const tagPattern = /<(\/?)(?:prosody|emphasis)(?:\s[^>]*)?\s*>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(text)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[0].match(/<\/?(\w+)/)?.[1];
    if (!tagName) continue;

    if (isClosing) {
      if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
        return false;
      }
      stack.pop();
    } else {
      stack.push(tagName);
    }
  }

  return stack.length === 0;
}

/**
 * AIが生成したテキストからホワイトリスト外のタグを除去し、
 * ネストが壊れていればプレーンテキストにフォールバックする
 */
function sanitizeSsml(text: string): string {
  const preserved: string[] = [];

  // ホワイトリストに合致するタグをプレースホルダーに退避
  let result = text;
  for (const pattern of VALID_SSML_PATTERNS) {
    // exec の lastIndex をリセットするため new RegExp でコピー
    const re = new RegExp(pattern.source, pattern.flags);
    result = result.replace(re, (match) => {
      preserved.push(match);
      return `__SSML_${preserved.length - 1}__`;
    });
  }

  // 残りの不正なタグをすべて除去
  result = result.replace(/<[^>]+>/g, "");

  // プレースホルダーを復元
  result = result.replace(/__SSML_(\d+)__/g, (_, i) => preserved[Number(i)]);

  // ネスト整合性チェック — 壊れていたら全タグ除去
  if (!isProperlyNested(result)) {
    return result.replace(/<[^>]+>/g, "");
  }

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
