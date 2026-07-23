// 특허 명세서 HWPX 생성기 — 한글에서 변환한 실제 템플릿 구조를 그대로 사용한다.
// 문단 규칙(템플릿 분석 결과): 제목 문단 paraPrIDRef="2", 본문 문단 paraPrIDRef="3", 모든 런 charPrIDRef="0"

const HWPX_PARTS = ['mimetype', 'version.xml', 'settings.xml', 'META-INF/manifest.xml', 'META-INF/container.xml', 'META-INF/container.rdf', 'Contents/header.xml', 'sec-prefix.xml'];

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pHead(text) {
  return `<hp:p id="0" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>${esc(text)}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1200" textheight="1200" baseline="1030" spacing="2160" horzpos="0" horzsize="46772" flags="393216"/></hp:linesegarray></hp:p>`;
}

function pBody(text) {
  // 여러 줄이면 줄마다 문단 하나씩
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) lines.push('');
  return lines.map(l =>
    `<hp:p id="0" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>${esc(l)}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1200" textheight="1200" baseline="1030" spacing="2160" horzpos="0" horzsize="46772" flags="1441792"/></hp:linesegarray></hp:p>`
  ).join('');
}

function pPic(pxW, pxH) {
  // 표시 크기: 폭 42520 HWPUNIT(약 15cm) 기준, 세로는 비율 유지
  const dimW = Math.round(pxW * 75), dimH = Math.round(pxH * 75);
  const curW = Math.min(42520, dimW);
  const curH = Math.round(curW * pxH / pxW);
  const sca = (curW / dimW).toFixed(6), scaH = (curH / dimH).toFixed(6);
  return `<hp:p id="0" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:pic id="1000000001" zOrder="1" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="1000000002" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${dimW}" height="${dimH}"/><hp:curSz width="${curW}" height="${curH}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(curW / 2)}" centerY="${Math.round(curH / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="${sca}" e2="0" e3="0" e4="0" e5="${scaH}" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hc:img binaryItemIDRef="drawing" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${dimW}" y="0"/><hc:pt2 x="${dimW}" y="${dimH}"/><hc:pt3 x="0" y="${dimH}"/></hp:imgRect><hp:imgClip left="0" right="${dimW}" top="0" bottom="${dimH}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${dimW}" dimheight="${dimH}"/><hp:effects/><hp:sz width="${curW}" widthRelTo="ABSOLUTE" height="${curH}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>학생이 그린 발명품 도면</hp:shapeComment></hp:pic><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${curH}" textheight="${curH}" baseline="${Math.round(curH * 0.85)}" spacing="2160" horzpos="0" horzsize="46772" flags="393216"/></hp:linesegarray></hp:p>`;
}

function buildSection0(prefix, f, drawing) {
  let x = prefix; // <hs:sec ...> + 첫 문단(secPr + 【발명의 설명】)
  x += pHead('【발명의 명칭】') + pBody(f.title);
  x += pHead('【기술분야】') + pBody(f.field || `본 발명은 ${f.title || '생활 속 불편함을 해결하는 발명품'}에 관한 것이다.`);
  x += pHead('【발명의 배경이 되는 기술】') + pBody(f.background || f.problem);
  x += pHead('【발명의 내용】');
  x += pHead('【해결하려는 과제】') + pBody(f.problem || '본 발명은 위에서 살펴본 불편함을 해결하는 것을 목적으로 한다.');
  x += pHead('【과제의 해결 수단】') + pBody(f.solution);
  x += pHead('【발명의 효과】') + pBody(f.effect);
  if (drawing) {
    x += pHead('【도면의 간단한 설명】') + pBody(f.drawingDesc || '도 1은 본 발명의 전체 모습을 나타낸 그림이다.');
  }
  x += pHead('【발명을 실시하기 위한 구체적인 내용】') + pBody(f.detail || f.solution);
  x += pHead('【청구범위】');
  x += pHead('【청구항 1】') + pBody(f.core);
  x += pHead('【요약서】');
  x += pHead('【요약】') + pBody(f.abstract || `본 발명은 ${f.title || '발명품'}에 관한 것이다. ${f.effect || ''}`.trim());
  if (drawing) {
    x += pHead('【도면】');
    x += pHead('【도 1】');
    x += pPic(drawing.width, drawing.height);
  }
  x += '</hs:sec>';
  return x;
}

function buildHpf(title, drawing) {
  const drawItem = drawing ? `<opf:item id="drawing" href="BinData/drawing.${drawing.ext}" media-type="image/${drawing.ext === 'jpg' ? 'jpeg' : drawing.ext}" isEmbeded="1"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" version="" unique-identifier="" id=""><opf:metadata><opf:title>${esc(title || '특허 명세서')}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">어린이 특허 명세서 메이커</opf:meta></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>${drawItem}<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
}

function buildPrvText(f) {
  return ['【발명의 명칭】', f.title, '【발명의 배경이 되는 기술】', f.problem, '【과제의 해결 수단】', f.solution, '【발명의 효과】', f.effect, '【청구항 1】', f.core].join('\n');
}

// fields: {title, problem, solution, effect, core}
// drawing: {dataUrl, width, height} 또는 null
async function buildHwpxBlob(fields, drawing, fetchBase) {
  const base = fetchBase || '';
  const parts = {};
  await Promise.all(HWPX_PARTS.map(async p => {
    const r = await fetch(base + '/hwpx/' + p);
    if (!r.ok) throw new Error('템플릿 파일을 불러오지 못했어요: ' + p);
    parts[p] = p === 'mimetype' || p.endsWith('.xml') ? await r.text() : await r.text();
  }));

  let drawInfo = null;
  if (drawing && drawing.dataUrl) {
    const m = drawing.dataUrl.match(/^data:image\/(\w+);base64,(.*)$/s);
    if (m) drawInfo = { ext: m[1] === 'jpeg' ? 'jpg' : m[1], b64: m[2], width: drawing.width, height: drawing.height };
  }

  const zip = new JSZip();
  zip.file('mimetype', parts['mimetype'], { compression: 'STORE' });
  zip.file('version.xml', parts['version.xml']);
  zip.file('settings.xml', parts['settings.xml']);
  zip.file('META-INF/manifest.xml', parts['META-INF/manifest.xml']);
  zip.file('META-INF/container.xml', parts['META-INF/container.xml']);
  zip.file('META-INF/container.rdf', parts['META-INF/container.rdf']);
  zip.file('Contents/header.xml', parts['Contents/header.xml']);
  zip.file('Contents/content.hpf', buildHpf(fields.title, drawInfo));
  zip.file('Contents/section0.xml', buildSection0(parts['sec-prefix.xml'], fields, drawInfo));
  zip.file('Preview/PrvText.txt', buildPrvText(fields));
  if (drawInfo) zip.file('BinData/drawing.' + drawInfo.ext, drawInfo.b64, { base64: true });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
}

if (typeof module !== 'undefined') module.exports = { buildHwpxBlob, buildSection0, buildHpf, buildPrvText };
