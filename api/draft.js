const { db, admin } = require('../lib/firebase');

const SYSTEM = `너는 초등학생의 특허 명세서에서 형식 항목의 초안을 대신 써 주는 변리사다. 학생이 직접 쓴 핵심 항목(명칭·과제·해결 수단·효과·청구범위)을 재료로, 아래 4개 형식 항목의 초안을 만든다.

규칙:
- 학생 글에 있는 사실만 사용한다. 새로운 기능이나 수치를 지어내지 않는다.
- 명세서 문체("~에 관한 것이다", "~할 수 있다")를 쓰되, 초등학생이 읽고 이해할 수 있는 쉬운 낱말을 쓴다.
- 각 항목 분량:
  · field(기술분야): 1~2문장. "본 발명은 ~에 관한 것으로, 보다 상세하게는 ~에 관한 것이다." 모양.
  · background(발명의 배경이 되는 기술): 2~3문장. 이 발명이 없을 때 사람들이 어떻게 했고 무엇이 불편했는지.
  · drawingDesc(도면의 간단한 설명): 1문장. "도 1은 본 발명인 ○○의 전체 모습을 나타낸 그림이다." 모양.
  · abstract(요약): 3~4문장. 무엇에 관한 발명인지, 어떤 구성으로, 어떤 효과가 있는지.

출력은 JSON만: {"field":"...","background":"...","drawingDesc":"...","abstract":"..."}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, draft } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: '먼저 활동코드로 입장해 주세요.' });
    const sRef = db().collection('sessions').doc(sessionId);
    const sDoc = await sRef.get();
    if (!sDoc.exists) return res.status(403).json({ error: '먼저 활동코드로 입장해 주세요.' });

    const d = draft || {};
    if (!(d.title || '').trim() && !(d.solution || '').trim()) {
      return res.status(400).json({ error: '발명품 이름과 해결 방법을 먼저 쓰면 초안을 만들어 드려요.' });
    }

    const userText = `학생이 쓴 핵심 항목:
발명의 명칭: ${d.title || '(비어 있음)'}
해결하려는 과제: ${d.problem || '(비어 있음)'}
과제의 해결 수단: ${d.solution || '(비어 있음)'}
발명의 효과: ${d.effect || '(비어 있음)'}
청구범위: ${d.core || '(비어 있음)'}`;

    const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'solar-pro2',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }],
        temperature: 0.3,
        max_tokens: 1200
      })
    });
    if (!r.ok) throw new Error(`draft ${r.status}: ${await r.text()}`);
    const raw = (await r.json()).choices[0].message.content;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('draft parse fail: ' + raw.slice(0, 200));
    const p = JSON.parse(m[0]);

    const out = {};
    for (const k of ['field', 'background', 'drawingDesc', 'abstract']) out[k] = String(p[k] || '').slice(0, 1500);

    await sRef.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '초안을 만들다가 문제가 생겼어요. 다시 시도해 주세요.' });
  }
};
