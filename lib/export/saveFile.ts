// 만든 저장 파일(워드·한글·증거 목록표)을 이 컴퓨터의 exports 폴더에 직접 저장한다.
// 앱 안의 브라우저 창처럼 내려받기가 저장되지 않는 화면에서도 파일을 받을 수 있게 한다.
// 서류 내용이 든 파일이므로 exports 폴더는 Git에 올리지 않고, 사건 삭제 때 함께 지운다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOSTED_DEMO } from "../store/db";

export const EXPORT_DIR = HOSTED_DEMO ? path.join(os.tmpdir(), "case-exports") : path.join(process.cwd(), "exports");

/** 파일 이름에 쓸 수 없는 글자를 뺀다. (폴더 밖으로 나가는 경로도 막는다) */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120);
}

/** 같은 이름이 있으면 (2), (3)을 붙여 덮어쓰지 않고 저장한다. 저장한 파일의 전체 경로와 이름을 돌려준다. */
export function saveExport(fileName: string, data: Uint8Array): { path: string; fileName: string } {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const clean = safeName(fileName);
  const ext = path.extname(clean);
  const base = clean.slice(0, clean.length - ext.length);

  let candidate = clean;
  for (let n = 2; fs.existsSync(path.join(EXPORT_DIR, candidate)); n += 1) {
    candidate = `${base} (${n})${ext}`;
  }
  const full = path.join(EXPORT_DIR, candidate);
  fs.writeFileSync(full, data);
  return { path: full, fileName: candidate };
}

/** exports 폴더의 파일을 모두 지운다. (사건 삭제 때) */
export function clearExports(): void {
  fs.rmSync(EXPORT_DIR, { recursive: true, force: true });
}
