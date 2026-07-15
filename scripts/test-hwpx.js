// 샘플 데이터로 hwpx를 만들어 template/test-output.hwpx 로 저장
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { buildSection0, buildHpf, buildPrvText } = require('../hwpx.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, 'hwpx', p));

const fields = {
  title: '줄 꼬임 방지 이어폰 케이스',
  problem: '이어폰을 주머니에 넣고 다니면 줄이 자꾸 꼬여서 풀기 힘들었다.\n특히 급하게 이어폰을 쓰려고 할 때 시간이 오래 걸려 불편했다.',
  solution: '케이스 안에 회전판을 달아서 줄이 감길 때 회전판이 함께 돌아가게 했다.\n회전판 가운데에는 줄을 고정하는 홈이 있어 줄이 흘러내리지 않는다.',
  effect: '줄이 꼬이지 않아 이어폰을 바로 꺼내 쓸 수 있다.',
  core: '이어폰 줄이 감기는 회전판; 및 상기 회전판을 감싸는 케이스를 포함하는 이어폰 케이스.'
};

(async () => {
  // 테스트용 도면: OCR 테스트 이미지 재사용 (800x300 png)
  const imgPath = 'C:\\Users\\forin\\AppData\\Local\\Temp\\claude\\C--Project-Codes-20260714-------maker\\deb4592b-68c1-405a-bb0b-13e677b84172\\scratchpad\\ocr_test.png';
  const drawInfo = { ext: 'png', b64: fs.readFileSync(imgPath).toString('base64'), width: 800, height: 300 };

  const zip = new JSZip();
  zip.file('mimetype', read('mimetype'), { compression: 'STORE' });
  zip.file('version.xml', read('version.xml'));
  zip.file('settings.xml', read('settings.xml'));
  zip.file('META-INF/manifest.xml', read('META-INF/manifest.xml'));
  zip.file('META-INF/container.xml', read('META-INF/container.xml'));
  zip.file('META-INF/container.rdf', read('META-INF/container.rdf'));
  zip.file('Contents/header.xml', read('Contents/header.xml'));
  zip.file('Contents/content.hpf', buildHpf(fields.title, drawInfo));
  zip.file('Contents/section0.xml', buildSection0(read('sec-prefix.xml').toString('utf8'), fields, drawInfo));
  zip.file('Preview/PrvText.txt', buildPrvText(fields));
  zip.file('BinData/drawing.png', drawInfo.b64, { base64: true });

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const out = path.join(root, 'template', 'test-output.hwpx');
  fs.writeFileSync(out, buf);
  console.log('saved:', out, buf.length, 'bytes');
})();
