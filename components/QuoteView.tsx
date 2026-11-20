// 원문을 보여 주되, 글자 인식이 불확실한 글자는 점선 밑줄로 표시한다.
// ③ 담은 원문과 초안 화면이 함께 쓴다.

interface Props {
  text: string;
  /** text 안에서 글자 인식이 불확실한 구간 */
  uncertain: { start: number; end: number }[];
}

export default function QuoteView({ text, uncertain }: Props) {
  const len = text.length;
  const points = new Set<number>([0, len]);
  for (const r of uncertain) {
    points.add(r.start);
    points.add(r.end);
  }
  const cuts = [...points].filter((p) => p >= 0 && p <= len).sort((a, b) => a - b);

  return (
    <>
      {cuts.slice(0, -1).map((start, i) => {
        const end = cuts[i + 1];
        const piece = text.slice(start, end);
        const isUncertain = uncertain.some((r) => start >= r.start && end <= r.end);
        return isUncertain ? (
          <span key={start} className="underline decoration-dotted decoration-amber-600 underline-offset-4">
            {piece}
          </span>
        ) : (
          <span key={start}>{piece}</span>
        );
      })}
    </>
  );
}
