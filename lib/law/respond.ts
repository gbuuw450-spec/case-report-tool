// 법제처 연결 오류를 화면용 응답으로 바꾼다. (인증 값·주소는 담지 않는다)
import { LawError, type LawErrorCode } from "./types";

const STATUS: Record<LawErrorCode, number> = {
  NOT_CONFIGURED: 503,
  NETWORK: 503,
  TIMEOUT: 504,
  AUTH: 502,
  BAD_RESPONSE: 502,
  BAD_INPUT: 400,
};

export function lawErrorResponse(error: unknown, what = "법령 조문을"): Response {
  if (error instanceof LawError) {
    // 입력 오류는 문구를 그대로, 연결 문제는 한 가지 안내로 통일한다.
    const message =
      error.code === "BAD_INPUT"
        ? error.message
        : `지금은 ${what} 찾을 수 없습니다. 인터넷 연결과 법제처 인증 값을 확인해 주세요.`;
    return Response.json({ error: { code: error.code, message } }, { status: STATUS[error.code] });
  }
  console.error("법제처 조회 중 알 수 없는 오류가 생겼습니다.");
  return Response.json({ error: { code: "UNKNOWN", message: `지금은 ${what} 찾을 수 없습니다.` } }, { status: 500 });
}
