// 한 사건의 서류 쪽수 합계가 상한을 넘는지 검사한다.
// Design Ref: PRD 6번 분량 제한 — 넘으면 업로드를 막고 현재 쪽수와 초과 쪽수를 알린다.
// 일부만 처리하고 답하는 일은 하지 않는다.
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

export type PageLimitCheck =
  | { ok: true; total: number }
  | { ok: false; code: "OVER_LIMIT"; total: number; over: number; message: string };

/**
 * @param current 이미 올려 둔 서류의 쪽수 합계
 * @param adding 지금 올리려는 서류의 쪽수
 * @param max 합계 상한 (100쪽)
 */
export function checkPageLimit(current: number, adding: number, max: number): PageLimitCheck {
  const total = current + adding;
  if (total <= max) return { ok: true, total };

  const over = total - max;
  return {
    ok: false,
    code: "OVER_LIMIT",
    total,
    over,
    message:
      `한 사건의 서류는 합계 ${max}쪽까지만 올릴 수 있습니다. ` +
      `현재 ${current}쪽이고 이 서류는 ${adding}쪽이라 합계 ${total}쪽으로 ${over}쪽 초과합니다.`,
  };
}
