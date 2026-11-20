// 초안을 한글 표준 문서(.hwpx)로 만든다. (.hwpx는 XML 파일 묶음을 zip으로 압축한 형식)
// Design Ref: §5.3 담기와 초안, 저장 — [한글로 저장]
// 워드 저장(docx.ts)과 같은 공통 모양(DraftModel)을 쓰므로, 글·출처·"(수정됨)"·"[인식 불확실]" 규칙이 똑같다.
import JSZip from "jszip";
import { EDITED_MARK, EMPTY_SECTION_TEXT, UNCERTAIN_MARK, type DraftModel } from "./draftModel";

const NS = {
  hh: "http://www.hancom.co.kr/hwpml/2011/head",
  hc: "http://www.hancom.co.kr/hwpml/2011/core",
  hp: "http://www.hancom.co.kr/hwpml/2011/paragraph",
  hs: "http://www.hancom.co.kr/hwpml/2011/section",
  ha: "http://www.hancom.co.kr/hwpml/2011/app",
  hv: "http://www.hancom.co.kr/hwpml/2011/version",
  hpf: "http://www.hancom.co.kr/schema/2011/hpf",
  opf: "http://www.idpf.org/2007/opf/",
};
const XML_DECL = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>`;
const FONT_FACE = "맑은 고딕";

// 글자 모양(charPr) 번호
const CHAR = { body: 0, title: 1, small: 2, heading: 3, bold: 4, empty: 5 } as const;
// 문단 모양(paraPr) 번호
const PARA = { body: 0, title: 1, date: 2, notice: 3, heading: 4, item: 5, source: 6 } as const;

/** XML 글자로 안전하게 바꾼다. (XML에 쓸 수 없는 제어문자는 뺀다) */
function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 글을 줄바꿈 그대로 <hp:t> 안에 넣을 내용으로 만든다. (서류의 줄바꿈을 그대로 둔다) */
function textContent(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(esc)
    .join("<hp:lineBreak/>");
}

function run(charPr: number, text: string): string {
  return `<hp:run charPrIDRef="${charPr}"><hp:t>${textContent(text)}</hp:t></hp:run>`;
}

let paragraphId = 1000;
/** 문단 하나. runs는 이미 만들어진 <hp:run> 조각들이다. */
function paragraph(paraPr: number, runs: string, first = ""): string {
  paragraphId += 1;
  return `<hp:p id="${paragraphId}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${first}${runs}</hp:p>`;
}

const FIRST_RUN_SETUP =
  `<hp:run charPrIDRef="0">` +
  `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">` +
  `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
  `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
  `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
  `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
  // A4 세로(landscape="WIDELY"가 세로 방향을 뜻한다), 여백 약 3cm·2cm
  `<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">` +
  `<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>` +
  `</hp:pagePr>` +
  `</hp:secPr>` +
  `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>` +
  `</hp:run>`;

function buildSection(model: DraftModel): string {
  const paragraphs: string[] = [];

  // 첫 문단은 쪽 설정을 담는 문서 맨 앞 문단이며, 제목을 겸한다.
  paragraphs.push(paragraph(PARA.title, run(CHAR.title, model.title), FIRST_RUN_SETUP));
  paragraphs.push(paragraph(PARA.date, run(CHAR.small, model.dateLabel)));
  for (const notice of model.notices) {
    paragraphs.push(paragraph(PARA.notice, run(CHAR.small, `※ ${notice}`)));
  }

  model.sections.forEach((section, sectionIndex) => {
    paragraphs.push(paragraph(PARA.heading, run(CHAR.heading, `${sectionIndex + 1}. ${section.title}`)));

    if (section.items.length === 0) {
      paragraphs.push(paragraph(PARA.item, run(CHAR.empty, EMPTY_SECTION_TEXT)));
      return;
    }

    section.items.forEach((item, itemIndex) => {
      // 본문: "1) 글 (수정됨) [인식 불확실]"
      let runs = run(CHAR.body, `${itemIndex + 1}) ${item.text}`);
      if (item.edited) runs += run(CHAR.bold, ` ${EDITED_MARK}`);
      if (item.uncertain) runs += run(CHAR.bold, ` ${UNCERTAIN_MARK}`);
      paragraphs.push(paragraph(PARA.item, runs));
      paragraphs.push(paragraph(PARA.source, run(CHAR.small, `(${item.sourceLine})`)));
    });
  });

  return (
    `${XML_DECL}<hs:sec xmlns:hs="${NS.hs}" xmlns:hp="${NS.hp}" xmlns:hc="${NS.hc}" xmlns:hh="${NS.hh}">` +
    paragraphs.join("") +
    `</hs:sec>`
  );
}

function charPr(id: number, height: number, color: string, bold: boolean): string {
  const all = (v: number | string) =>
    `hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"`;
  return (
    `<hh:charPr id="${id}" height="${height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">` +
    `<hh:fontRef ${all(0)}/><hh:ratio ${all(100)}/><hh:spacing ${all(0)}/><hh:relSz ${all(100)}/><hh:offset ${all(0)}/>` +
    (bold ? `<hh:bold/>` : ``) +
    `<hh:underline type="NONE" shape="SOLID" color="#000000"/>` +
    `<hh:strikeout shape="NONE" color="#000000"/>` +
    `<hh:outline type="NONE"/>` +
    `<hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/>` +
    `</hh:charPr>`
  );
}

function paraPr(id: number, align: string, left: number, prev: number, next: number, lineSpacing = 160): string {
  const unit = (name: string, v: number) => `<hc:${name} value="${v}" unit="HWPUNIT"/>`;
  return (
    `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">` +
    `<hh:align horizontal="${align}" vertical="BASELINE"/>` +
    `<hh:heading type="NONE" idRef="0" level="0"/>` +
    `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>` +
    `<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>` +
    `<hh:margin>${unit("intent", 0)}${unit("left", left)}${unit("right", 0)}${unit("prev", prev)}${unit("next", next)}</hh:margin>` +
    `<hh:lineSpacing type="PERCENT" value="${lineSpacing}" unit="HWPUNIT"/>` +
    `<hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>` +
    `</hh:paraPr>`
  );
}

function buildHeader(): string {
  const langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
  const fontfaces = langs
    .map(
      (lang) =>
        `<hh:fontface lang="${lang}" fontCnt="1"><hh:font id="0" face="${FONT_FACE}" type="TTF" isEmbedded="0"/></hh:fontface>`
    )
    .join("");
  const none = (tag: string) => `<hh:${tag} type="NONE" width="0.1 mm" color="#000000"/>`;
  const borderFill =
    `<hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `${none("leftBorder")}${none("rightBorder")}${none("topBorder")}${none("bottomBorder")}${none("diagonal")}` +
    `</hh:borderFill>`;

  const charPrs = [
    charPr(CHAR.body, 1100, "#000000", false),
    charPr(CHAR.title, 1800, "#000000", true),
    charPr(CHAR.small, 900, "#666666", false),
    charPr(CHAR.heading, 1300, "#000000", true),
    charPr(CHAR.bold, 1100, "#000000", true),
    charPr(CHAR.empty, 1100, "#666666", false),
  ];
  const paraPrs = [
    paraPr(PARA.body, "JUSTIFY", 0, 0, 0),
    paraPr(PARA.title, "CENTER", 0, 0, 600),
    paraPr(PARA.date, "RIGHT", 0, 0, 1000, 130),
    paraPr(PARA.notice, "LEFT", 0, 0, 400, 130),
    paraPr(PARA.heading, "LEFT", 0, 1800, 800),
    paraPr(PARA.item, "LEFT", 1800, 600, 200),
    paraPr(PARA.source, "LEFT", 1800, 0, 600, 130),
  ];

  return (
    `${XML_DECL}<hh:head xmlns:hh="${NS.hh}" xmlns:hc="${NS.hc}" xmlns:hp="${NS.hp}" xmlns:hs="${NS.hs}" version="1.4" secCnt="1">` +
    `<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>` +
    `<hh:refList>` +
    `<hh:fontfaces itemCnt="${langs.length}">${fontfaces}</hh:fontfaces>` +
    `<hh:borderFills itemCnt="1">${borderFill}</hh:borderFills>` +
    `<hh:charProperties itemCnt="${charPrs.length}">${charPrs.join("")}</hh:charProperties>` +
    `<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>` +
    `<hh:paraProperties itemCnt="${paraPrs.length}">${paraPrs.join("")}</hh:paraProperties>` +
    `<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>` +
    `</hh:refList>` +
    `<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>` +
    `<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>` +
    `<hh:trackchageConfig flags="56"/>` +
    `</hh:head>`
  );
}

/** 초안 모양(DraftModel)을 .hwpx 파일 내용(바이트)으로 만든다. */
export async function buildHwpx(model: DraftModel): Promise<Buffer> {
  const zip = new JSZip();
  // 폴더 항목은 따로 만들지 않는다. (한글이 만든 파일처럼 파일 항목만 둔다)
  const add = (name: string, data: string, compression: "STORE" | "DEFLATE" = "DEFLATE") =>
    zip.file(name, data, { createFolders: false, compression });

  // 한글은 첫 파일이 압축하지 않은 mimetype이기를 기대한다.
  add("mimetype", "application/hwp+zip", "STORE");
  add(
    "version.xml",
    `${XML_DECL}<hv:HCFVersion xmlns:hv="${NS.hv}" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="11, 0, 0, 0 WIN32LEWindows_10"/>`
  );
  add(
    "META-INF/container.xml",
    `${XML_DECL}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="${NS.hpf}"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>`
  );
  add(
    "META-INF/manifest.xml",
    `${XML_DECL}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`
  );
  add(
    "Contents/content.hpf",
    `${XML_DECL}<opf:package xmlns:opf="${NS.opf}" xmlns:hpf="${NS.hpf}" xmlns:hh="${NS.hh}" version="" unique-identifier="" id="">` +
      `<opf:metadata><opf:title>${esc(model.title)}</opf:title><opf:language>ko</opf:language></opf:metadata>` +
      `<opf:manifest>` +
      `<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>` +
      `<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>` +
      `<opf:item id="settings" href="settings.xml" media-type="application/xml"/>` +
      `</opf:manifest>` +
      `<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>` +
      `</opf:package>`
  );
  add("Contents/header.xml", buildHeader());
  add("Contents/section0.xml", buildSection(model));
  add(
    "settings.xml",
    `${XML_DECL}<ha:HWPApplicationSetting xmlns:ha="${NS.ha}" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
