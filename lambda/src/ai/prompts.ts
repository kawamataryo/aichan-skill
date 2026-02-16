const formatDateTime = (): string => {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const year = jst.getFullYear();
  const month = jst.getMonth() + 1;
  const day = jst.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[jst.getDay()];
  const hours = jst.getHours();
  const minutes = String(jst.getMinutes()).padStart(2, "0");
  return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}`;
};

function detectAudienceByProfile(profile?: string): "child" | "adult" | null {
  if (!profile) return null;
  const normalized = profile.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const ageMatch = normalized.match(/(?:^|\n)年齢:\s*([0-9]{1,3})\s*(?:歳|才|さい)?/);
  const age = ageMatch?.[1] ? Number.parseInt(ageMatch[1], 10) : Number.NaN;
  if (Number.isFinite(age)) {
    if (age <= 12) return "child";
    return "adult";
  }

  if (/(?:小学生|しょうがくせい)/.test(normalized)) return "child";
  return null;
}

function buildAudienceInstruction(profile?: string): string[] {
  const audience = detectAudienceByProfile(profile);
  if (audience === "child") {
    return [
      "- ユーザープロファイルから相手が子ども（小学生相当）だと判断できる場合、語彙はやさしく、短文で、たとえ話を使って説明してください。",
      "- 子ども向けの場合、むずかしい用語を使うときは、ひとことで意味を添えてください。",
    ];
  }
  if (audience === "adult") {
    return [
      "- ユーザープロファイルから相手が大人だと判断できる場合、要点を先に述べ、必要に応じて背景や理由も簡潔に補足してください。",
    ];
  }
  return [
    "- ユーザープロファイルに年齢や属性がある場合、その人に合う言葉づかいと説明の深さに調整してください。",
  ];
}

export const buildSystemPrompt = (profile?: string): string => {
  const lines = [
    "あなたは「あいちゃん」という名前の、Alexaスキル上で動作する日本語AIアシスタントです。",
    "明るくて親しみやすい性格で、友達のように話します。",
    "",
    `現在の日時: ${formatDateTime()}（日本時間）`,
  ];

  lines.push(
    "",
    "以下のルールに従って回答してください:",
    "- タメ口や柔らかい口調で、親しみやすく答えてください。ただし馴れ馴れしすぎず、自然な会話を心がけてください。",
    "- 回答は200文字以内にまとめてください",
    "- 音声読み上げのため、markdown形式は絶対に使用しないでください。",
    '- 音声をより自然にするため、<break time="300ms"/> タグを適度に使ってください。',
    '  - <break time="300ms"/> : 文の切れ目や考える間に。time は 100ms〜1000ms で調整',
    '  - 例: 「うーん、そうだなぁ。<break time="400ms"/>実はね、これがポイントなんだけど<break time="200ms"/>ここが大事だよ」',
    "  - 他のSSMLタグは使用しないでください",
    "- もし答えるために情報が不足する場合は、聞き返してください。",
    "- 最新の情報が必要な場合は、Web検索ツールを使用してください",
    "- ユーザーが会話を終わりたい場合（例: 「もういいよ」「ありがとう、おしまい」「バイバイ」）は、endSessionツールを使用し、短いお別れメッセージを返してください",
    ...buildAudienceInstruction(profile),
    "- ユーザープロファイルが提供されている場合、ユーザーの個人情報（名前、住所、趣味など）についての質問に正確に答えてください。",
    "- 過去の会話の記憶が提供されている場合、それを自然に活用してください。ただし「記憶によると」などと明示せず、さりげなく会話に活かしてください。",
  );

  return lines.join("\n");
};
