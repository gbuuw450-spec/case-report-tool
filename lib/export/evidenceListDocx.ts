// 증거 목록표를 워드 문서(.docx)로 만든다.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { EvidenceListModel } from "./evidenceList";

const FONT = { ascii: "맑은 고딕", hAnsi: "맑은 고딕", eastAsia: "맑은 고딕" };
const BODY_SIZE = 20; // 10pt
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

// 열 이름과 너비(전체 100%) — 번호, 증거 이름, 파일명, 제출 측, 쪽수, 담은 횟수, 비고
const COLUMNS: { label: string; width: number; align: (typeof AlignmentType)[keyof typeof AlignmentType] }[] = [
  { label: "번호", width: 6, align: AlignmentType.CENTER },
  { label: "증거 이름", width: 18, align: AlignmentType.LEFT },
  { label: "파일명", width: 28, align: AlignmentType.LEFT },
  { label: "제출 측", width: 11, align: AlignmentType.CENTER },
  { label: "쪽수", width: 8, align: AlignmentType.CENTER },
  { label: "담은 횟수", width: 10, align: AlignmentType.CENTER },
  { label: "비고", width: 19, align: AlignmentType.LEFT },
];

function cell(text: string, width: number, align: (typeof COLUMNS)[number]["align"], header = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    shading: header ? { fill: "E5E7EB" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, font: FONT, size: BODY_SIZE, bold: header })],
      }),
    ],
  });
}

/** 증거 목록표 내용(EvidenceListModel)을 .docx 파일 내용(바이트)으로 만든다. */
export async function buildEvidenceListDocx(model: EvidenceListModel): Promise<Buffer> {
  const header = new TableRow({
    tableHeader: true,
    children: COLUMNS.map((c) => cell(c.label, c.width, AlignmentType.CENTER, true)),
  });
  const body = model.rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(String(r.no), COLUMNS[0].width, COLUMNS[0].align),
          cell(r.evidenceName, COLUMNS[1].width, COLUMNS[1].align),
          cell(r.fileName, COLUMNS[2].width, COLUMNS[2].align),
          cell(r.side, COLUMNS[3].width, COLUMNS[3].align),
          cell(String(r.pageCount), COLUMNS[4].width, COLUMNS[4].align),
          cell(String(r.pickCount), COLUMNS[5].width, COLUMNS[5].align),
          cell("", COLUMNS[6].width, COLUMNS[6].align),
        ],
      })
  );

  const doc = new Document({
    creator: "사건조사서 작성 툴",
    title: model.title,
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      {
        // A4 세로, 여백 약 2cm
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: model.title, font: FONT, size: 36, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [new TextRun({ text: model.dateLabel, font: FONT, size: 20 })],
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }),
          new Paragraph({
            spacing: { before: 160 },
            children: [
              new TextRun({
                text: "※ 담은 횟수는 그 증거서류에서 사건조사서 초안에 담은 원문의 수입니다. 비고 칸은 직접 적어 넣으세요.",
                font: FONT,
                size: 18,
                color: "666666",
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
