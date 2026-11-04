import type { Pack, Rule, TestCase } from "./types"

function rule(partial: Pick<Rule, "id" | "label" | "pattern" | "replacement"> & Partial<Rule>): Rule {
  return {
    enabled: true,
    flags: "gu",
    literal: false,
    dictionary: "",
    ...partial,
  }
}

function test(partial: TestCase): TestCase {
  return partial
}

export const SAMPLE_SOURCE = [
  "納期 2026-11-03  担当  山田",
  "予備 2025/12/24",
  "メモ 2024.1.5 の分",
].join("\n")

const SEED: Pack[] = [
  {
    id: "pack-date",
    name: "日付を和式に",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-date",
        label: "年月日",
        pattern: String.raw`(?<y>\d{4})[./-](?<m>\d{1,2})[./-](?<d>\d{1,2})`,
        replacement: "$<y>年$<m>月$<d>日",
      }),
    ],
    tests: [
      test({
        id: "test-date-hyphen",
        name: "ハイフン",
        input: "納期は2026-11-03です",
        expected: "納期は2026年11月03日です",
      }),
      test({
        id: "test-date-slash",
        name: "スラッシュ",
        input: "2025/7/1",
        expected: "2025年7月1日",
      }),
    ],
  },
  {
    id: "pack-space",
    name: "余白を畳む",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-trim",
        label: "行の端",
        pattern: String.raw`^[ \t　]+|[ \t　]+$`,
        flags: "gmu",
        replacement: "",
      }),
      rule({
        id: "rule-collapse",
        label: "連続する空白",
        pattern: String.raw`[ \t　]{2,}`,
        replacement: " ",
      }),
    ],
    tests: [
      test({
        id: "test-space",
        name: "全角と半角",
        input: "  山田　　太郎  ",
        expected: "山田 太郎",
      }),
    ],
  },
  {
    id: "pack-html",
    name: "タグを外す",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-script",
        label: "script",
        pattern: String.raw`<script\b[^>]*>[\s\S]*?</script>`,
        flags: "giu",
        replacement: "",
      }),
      rule({
        id: "rule-tags",
        label: "タグ",
        pattern: String.raw`<[^>]+>`,
        replacement: "",
      }),
      rule({
        id: "rule-amp",
        label: "アンパサンド",
        pattern: "&",
        replacement: "&",
      }),
    ],
    tests: [
      test({
        id: "test-html",
        name: "段落",
        input: "<p>魚&肉</p>",
        expected: "魚&肉",
      }),
    ],
  },
  {
    id: "pack-kana",
    name: "かなと絵文字",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-hira",
        label: "ひらがな",
        pattern: "あ-ん+",
        replacement: "「$&」",
      }),
      rule({
        id: "rule-emoji",
        label: "絵文字",
        pattern: String.raw`\p{絵文字}`,
        replacement: "★",
      }),
    ],
    tests: [
      test({
        id: "test-kana-emoji",
        name: "かなと絵文字",
        input: "こんにちは😀",
        expected: "「こんにちは」★",
      }),
    ],
  },
  {
    id: "pack-dict",
    name: "辞書の完全一致",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-dict-line",
        label: "行の完全一致",
        pattern: "^(?:山田|佐藤|鈴木)$",
        flags: "gmu",
        replacement: "${辞書($&)}",
        dictionary: "山田\tYamada\n佐藤\tSato\n鈴木\tSuzuki",
      }),
      rule({
        id: "rule-dict-group",
        label: "グループの完全一致",
        pattern: "品番(?<code>[A-Z]+-\\d+)",
        replacement: "品番${辞書($<code>)}",
        dictionary: "AB-001\tりんご\nCD-2\tみかん",
      }),
    ],
    tests: [
      test({
        id: "test-dict-line",
        name: "行だけ",
        input: "山田\n佐藤です\n鈴木",
        expected: "Yamada\n佐藤です\nSuzuki",
      }),
      test({
        id: "test-dict-group",
        name: "品番",
        input: "品番AB-001と品番ZZ-9",
        expected: "品番りんごと品番ZZ-9",
      }),
    ],
  },
  {
    id: "pack-formula",
    name: "式で揃える",
    updatedAt: 0,
    rules: [
      rule({
        id: "rule-formula-pad",
        label: "桁と計算",
        pattern: "(?<n>\\d+)個",
        replacement: "${桁($<n> + 1, 3)}個",
      }),
      rule({
        id: "rule-formula-nth",
        label: "通し番号",
        pattern: "^(?!時刻$).+$",
        flags: "gmu",
        replacement: "$回 $&",
      }),
      rule({
        id: "rule-formula-clock",
        label: "今日の日時",
        pattern: "^時刻$",
        flags: "gmu",
        replacement: "$日付 $時刻",
      }),
    ],
    tests: [
      test({
        id: "test-formula-pad",
        name: "個数",
        input: "3個と12個",
        expected: "1 004個と013個",
      }),
      test({
        id: "test-formula-nth",
        name: "行番号",
        input: "りんご\nみかん",
        expected: "1 りんご\n2 みかん",
      }),
    ],
  },
]

export function seedPacks(): Pack[] {
  return structuredClone(SEED)
}
