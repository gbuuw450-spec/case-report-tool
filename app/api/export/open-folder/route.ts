// 저장한 파일이 있는 exports 폴더를 탐색기로 여는 요청 — 이 컴퓨터 안에서만 사용
// 열 폴더는 고정되어 있고, 요청에서 경로를 받지 않는다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import { connection } from "next/server";
import { EXPORT_DIR } from "@/lib/export/saveFile";

export async function POST() {
  await connection();
  try {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const child = spawn("explorer.exe", [EXPORT_DIR], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return Response.json({ opened: true });
  } catch (error) {
    console.error("폴더를 열지 못했습니다.", error);
    return Response.json({ error: { code: "OPEN_ERROR", message: "폴더를 열지 못했습니다." } }, { status: 500 });
  }
}
