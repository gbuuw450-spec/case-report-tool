// 초안을 워드 문서(.docx)로 만든다.
// Design Ref: §5.3 담기와 초안, 저장 — [워드로 저장]
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { EDITED_MARK, EMPTY_SECTION_TEXT, UNCERTAIN_MARK, type DraftModel } from "./draftModel";

// 한글 윈도우에 기본으로 있는 글꼴. 영문·숫자와 한글 모두 같은 글꼴로 지정한다.
const FONT = { ascii: "맑은 고딕", hAnsi: "맑은 고딕", eastAsia: "맑은 고딕" };
const BODY_SIZE = 22; // 11pt (docx는 반 포인트 단위)
const SMALL_SIZE = 18; // 9pt
const GRAY = "666666";

/** 글을 줄바꿈 그대로 이어서 TextRun 목록으로 만든다. (서류의 줄바꿈을 그대로 둔다) */
function lineRuns(text: string, options: { size?: number; color?: string; italics?: boolean; bold?: boolean }): TextRun[] {
  return text.split("\n").map(
    (line, index) =>
      new TextRun({
        text: line,
        break: index > 0 ? 1 : 0,
        font: FONT,
        size: options.size ?? BODY_SIZE,
        color: options.color,
        italics: options.italics,
        bold: options.bold,
      })
  );
}

/** 초안 모양(DraftModel)을 .docx 파일 내용(바이트)으로 만든다. */
export async function buildDocx(model: DraftModel): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: lineRuns(model.title, { size: 36, bold: true }),
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: lineRuns(model.dateLabel, { size: SMALL_SIZE + 2 }),
    })
  );
  for (const notice of model.notices) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: lineRuns(`※ ${notice}`, { size: SMALL_SIZE, color: GRAY }),
      })
    );
  }

  model.sections.forEach((section, sectionIndex) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        // 워드의 기본 제목 색(파랑) 대신 검은색으로 둔다.
        children: lineRuns(`${sectionIndex + 1}. ${section.title}`, { size: 26, bold: true, color: "000000" }),
      })
    );

    if (section.items.length === 0) {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          children: lineRuns(EMPTY_SECTION_TEXT, { color: GRAY }),
        })
      );
      return;
    }

    section.items.forEach((item, itemIndex) => {
      // 본문: "1) 글 (수정됨) [인식 불확실]"
      const bodyRuns = lineRuns(`${itemIndex + 1}) ${item.text}`, {});
      if (item.edited) bodyRuns.push(new TextRun({ text: ` ${EDITED_MARK}`, font: FONT, size: BODY_SIZE, bold: true }));
      if (item.uncertain) bodyRuns.push(new TextRun({ text: ` ${UNCERTAIN_MARK}`, font: FONT, size: BODY_SIZE, bold: true }));

      children.push(
        new Paragraph({ indent: { left: 360 }, spacing: { before: 120, after: 40 }, children: bodyRuns }),
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 120 },
          children: lineRuns(`(${item.sourceLine})`, { size: SMALL_SIZE, color: GRAY }),
        })
      );
    });
  });

  const doc = new Document({
    creator: "사건조사서 작성 툴",
    title: model.title,
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      {
        // A4 세로, 여백 약 2.5cm
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
