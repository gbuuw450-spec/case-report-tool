// 글자 인식(OCR) 결과를 쪽 글자로 만들고, 인식이 불확실한 단어의 위치를 기록한다.
// Design Ref: §5.1 서류 올리기와 텍스트화 — 인식이 불확실한 단어에 "[인식 불확실]" 표시
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

/** 단어 인식 확신도가 이 값(0~100) 미만이면 "[인식 불확실]"로 표시한다. (설계 기본값, 시험 후 조정) */
export const UNCERTAIN_BELOW = 80;

// 글자 인식 결과 중 필요한 부분만 정의한다. (tesseract.js의 결과 모양과 호환)
export interface OcrWord {
  text: string;
  confidence: number;
}
export interface OcrLine {
  words: OcrWord[];
}
export interface OcrParagraph {
  lines: OcrLine[];
}
export interface OcrBlock {
  paragraphs: OcrParagraph[];
}

export interface BuiltPageText {
  text: string;
  uncertain: { start: number; end: number }[]; // text 안에서 확신도가 낮은 단어의 구간
  wordCount: number;
}

/**
 * 글자 인식 결과(블록 → 문단 → 줄 → 단어)를 한 쪽의 글자로 이어 붙인다.
 * - 단어는 공백으로, 줄은 줄바꿈으로 잇는다. 글자를 고치거나 요약하지 않는다.
 * - 확신도가 기준 미만인 단어의 구간을 함께 돌려준다.
 */
export function buildPageText(
  blocks: OcrBlock[] | null | undefined,
  uncertainBelow: number = UNCERTAIN_BELOW
): BuiltPageText {
  let text = "";
  const uncertain: { start: number; end: number }[] = [];
  let wordCount = 0;

  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        let lineHasWord = false;
        for (const word of line.words ?? []) {
          const wordText = word.text.trim();
          if (wordText === "") continue;

          if (lineHasWord) text += " ";
          else if (text !== "") text += "\n"; // 새 줄 시작
          lineHasWord = true;

          const start = text.length;
          text += wordText;
          wordCount++;
          if (word.confidence < uncertainBelow) uncertain.push({ start, end: text.length });
        }
      }
    }
  }
  return { text, uncertain, wordCount };
}
