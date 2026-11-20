// 저장 파일 요청의 공통 응답: 기본은 파일 내려받기, ?save=1이면 이 컴퓨터의 exports 폴더에 저장하고 위치를 알려 준다.
import { saveExport } from "./saveFile";

export function fileResponse(request: Request, file: Uint8Array, name: string, contentType: string, asciiName: string): Response {
  if (new URL(request.url).searchParams.get("save") === "1") {
    const saved = saveExport(name, file);
    return Response.json({ savedPath: saved.path, fileName: saved.fileName }, { headers: { "Cache-Control": "no-store" } });
  }
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      // 한글 파일 이름은 UTF-8로 인코딩해서 알린다. (영문 대체 이름을 함께 둔다)
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store", // 서류 내용이 든 파일이라 브라우저에 따로 남기지 않는다
    },
  });
}
