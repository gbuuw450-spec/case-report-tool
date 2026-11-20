// 사건 전체 삭제: 올린 서류 원본(PDF)과 저장소 파일(app.db)을 이 컴퓨터에서 실제로 지운다.
// Design Ref: §5.4 삭제와 새 사건 — 휴지통 폴더로 옮기지 않는다. (개인정보가 든 서류를 남기지 않기 위해서)
// CLAUDE.md의 "trash-can으로 옮기기" 규칙은 개발 중 파일을 다루는 규칙이며 앱의 사건 삭제에는 적용하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { clearExports } from "../export/saveFile";
import { DATA_DIR, FILES_DIR, closeDb } from "./db";

export interface DeleteResult {
  deletedFiles: number; // 지운 원본 PDF 수
}

/** data/ 폴더 안에서만 지운다. 폴더 밖 경로는 지우지 않는다. */
function removeInsideData(target: string): boolean {
  const resolved = path.resolve(target);
  const root = path.resolve(DATA_DIR) + path.sep;
  if (!resolved.startsWith(root)) return false;
  fs.rmSync(resolved, { force: true });
  return true;
}

/** 사건의 모든 서류·텍스트·담은 원문·저장소 파일을 지운다. 다음에 저장소를 쓰면 빈 상태로 새로 만들어진다. */
export function deleteWholeCase(): DeleteResult {
  // 저장소를 먼저 닫아야 Windows에서 파일을 지울 수 있다.
  closeDb();

  let deletedFiles = 0;
  if (fs.existsSync(FILES_DIR)) {
    for (const name of fs.readdirSync(FILES_DIR)) {
      if (removeInsideData(path.join(FILES_DIR, name))) deletedFiles += 1;
    }
  }
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    removeInsideData(path.join(DATA_DIR, `app.db${suffix}`));
  }
  clearExports(); // 저장해 둔 워드·한글·증거 목록표 파일도 서류 내용이 들어 있으므로 함께 지운다.
  return { deletedFiles };
}
