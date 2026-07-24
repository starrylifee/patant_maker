const { db, admin } = require('../lib/firebase');

const UPSTAGE = 'https://api.upstage.ai/v1';

async function runOcr(buf, key) {
  const fd = new FormData();
  fd.append('document', new Blob([buf], { type: 'image/jpeg' }), 'page.jpg');
  fd.append('model', 'ocr');
  const r = await fetch(`${UPSTAGE}/document-digitization`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd
  });
  if (!r.ok) throw new Error(`OCR ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return (json.pages || []).map(p => p.text).join('\n');
}

async function structure(rawText, key) {
  const prompt = `아래는 초등학생이 손으로 쓴 발명 활동지를 OCR로 읽은 텍스트야. 인식 오류가 섞여 있을 수 있어. 학생이 쓴 내용만 뽑아서 다음 JSON으로 정리해줘. 인쇄된 질문 문구("1. 발명품 이름" 같은 것)는 값에 넣지 마. 해당 내용이 없으면 빈 문자열. 오타는 자연스럽게 바로잡되 학생의 표현은 최대한 살려. JSON만 출력해.
{"title":"발명품 이름","problem":"발견한 불편함","solution":"해결 방법(구조·작동)","effect":"좋은 점","core":"가장 중요한 부분"}

--- OCR 텍스트 ---
${rawText}`;

  const r = await fetch(`${UPSTAGE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'solar-pro2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  if (!r.ok) throw new Error(`structure ${r.status}: ${await r.text()}`);
  const text = (await r.json()).choices[0].message.content;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, imageBase64 } = req.body || {};
    if (!sessionId || !imageBase64) return res.status(400).json({ error: '사진이 없어요.' });

    const sDoc0 = await db().collection('sessions').doc(sessionId).get();
    if (!sDoc0.exists) return res.status(403).json({ error: '먼저 활동코드로 입장해 주세요.' });
    const codeDoc = await db().collection('codes').doc(sDoc0.data().code).get();
    if (!codeDoc.exists || codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동이 마감되었어요.' });
    }

    const key = process.env.UPSTAGE_API_KEY;
    const buf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: '사진이 너무 커요. 다시 찍어주세요.' });

    const rawText = await runOcr(buf, key);
    const fields = await structure(rawText, key);

    const sRef = db().collection('sessions').doc(sessionId);
    await sRef.collection('events').add({
      type: 'ocr',
      ts: admin.firestore.FieldValue.serverTimestamp(),
      rawText,
      fields: fields || null
    });
    await sRef.update({ hasOcr: true, lastActive: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

    return res.status(200).json({ rawText, fields });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '사진을 읽지 못했어요. 밝은 곳에서 다시 찍어보세요.' });
  }
};
