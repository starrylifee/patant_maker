const { db, admin } = require('../lib/firebase');

const SYSTEM = `너는 초등학생의 특허 명세서 초안을 심사하는 깐깐한 변리사다. 친절하지만 점수는 엄격하게 준다. 근거 없는 칭찬은 하지 않는다.

명세서 5개 항목을 각각 0~20점으로 채점한다.

[채점 기준]
- title(발명의 명칭): 무엇을 하는 물건인지 이름만 봐도 알 수 있으면 높은 점수. "슈퍼 만능 기계"처럼 멋만 부린 이름은 낮은 점수.
- problem(과제): 언제, 어디서, 누가 겪는 불편인지 구체적이면 높은 점수. "불편해요"처럼 두루뭉술하면 낮은 점수.
- solution(해결 수단): 발명품의 생김새, 부품이 어디에 붙는지, 어떤 순서로 작동하는지가 드러나야 높은 점수. 이 항목이 가장 중요하다.
- effect(효과): 쓰기 전과 후에 무엇이 달라지는지 구체적이면 높은 점수. "좋아요, 편리해요"만 있으면 낮은 점수.
- core(청구범위): "~를 포함하는 ○○" 모양으로 핵심 아이디어를 특정했으면 높은 점수.

[감점 규칙 — 반드시 적용]
1. "멋진, 좋은, 편리한, 신기한, 대단한, 짱, 최고" 같은 느낌·주관 낱말이 근거 없이 쓰이면 감점하고 issues에 넣는다.
2. 설명이 한 문장도 안 되게 짧거나 낱말만 던져 놓았으면 크게 감점한다 (해당 항목 8점 이하).
3. 빈 항목은 0점.
4. 다섯 항목을 다 읽어도 "무엇이, 어떻게 작동해서, 어떤 문제를 해결하는지"(발명의 요지)가 안 보이면 solution과 core를 10점 이하로 주고 comment에 그 사실을 말한다.
5. 만점(20점)은 어른 명세서 수준일 때만. 잘 써도 보통 15~18점.

[출력 형식 — JSON만 출력, 다른 글자 금지]
{"scores":{"title":0,"problem":0,"solution":0,"effect":0,"core":0},"issues":[{"field":"solution","quote":"문제가 된 표현 그대로","why":"왜 안 되는지 한 문장","fix":"어떻게 고칠지 방향만 한 문장 (답을 대신 써 주지 않기)"}],"comment":"총평 2~3문장. 해요체 존댓말. 잘한 점이 실제로 있으면 한 가지만 짚고, 다음에 할 일을 알려 준다."}

issues는 문제가 있는 것만 담는다 (0~6개). 모든 글은 초등학생이 읽으므로 쉬운 말로 쓴다. 개인정보는 다루지 않는다.`;

const FIELDS = ['title', 'problem', 'solution', 'effect', 'core'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, draft } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: '먼저 활동코드로 입장해 주세요.' });

    const sRef = db().collection('sessions').doc(sessionId);
    const sDoc = await sRef.get();
    if (!sDoc.exists) return res.status(403).json({ error: '먼저 활동코드로 입장해 주세요.' });

    const codeDoc = await db().collection('codes').doc(sDoc.data().code).get();
    const limit = (codeDoc.exists && codeDoc.data().chatLimit) || 30;
    if (codeDoc.exists && codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동이 마감되었어요.' });
    }
    if ((sDoc.data().chatCount || 0) >= limit) {
      return res.status(429).json({ error: `AI 도우미와는 ${limit}번까지 이야기할 수 있어요. 이제 스스로 완성해 볼까요?` });
    }

    const d = draft || {};
    const filled = FIELDS.some(k => (d[k] || '').trim());
    if (!filled) return res.status(400).json({ error: '아직 쓴 내용이 없어요. 명세서를 조금 쓰고 심사를 받아 보세요.' });

    const draftText = `심사할 명세서 초안:
발명의 명칭(title): ${d.title || '(비어 있음)'}
과제(problem): ${d.problem || '(비어 있음)'}
해결 수단(solution): ${d.solution || '(비어 있음)'}
효과(effect): ${d.effect || '(비어 있음)'}
청구범위(core): ${d.core || '(비어 있음)'}`;

    const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'solar-pro2',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: draftText }],
        temperature: 0.2,
        max_tokens: 1200
      })
    });
    if (!r.ok) throw new Error(`review ${r.status}: ${await r.text()}`);
    const raw = (await r.json()).choices[0].message.content;

    // JSON만 뽑아서 파싱 (모델이 앞뒤에 말을 붙여도 견디게)
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('review parse fail: ' + raw.slice(0, 200));
    const parsed = JSON.parse(m[0]);

    const scores = {};
    for (const k of FIELDS) {
      const v = Number(parsed.scores && parsed.scores[k]);
      scores[k] = Number.isFinite(v) ? Math.max(0, Math.min(20, Math.round(v))) : 0;
      if (!(d[k] || '').trim()) scores[k] = 0;
    }
    const total = FIELDS.reduce((s, k) => s + scores[k], 0);
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 6).map(i => ({
      field: FIELDS.includes(i.field) ? i.field : '',
      quote: String(i.quote || '').slice(0, 80),
      why: String(i.why || '').slice(0, 150),
      fix: String(i.fix || '').slice(0, 150)
    }));
    const comment = String(parsed.comment || '').slice(0, 500);

    await sRef.collection('events').add({
      type: 'review',
      ts: admin.firestore.FieldValue.serverTimestamp(),
      scores, total,
      issues,
      comment
    });
    await sRef.update({
      chatCount: admin.firestore.FieldValue.increment(1),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    const used = (sDoc.data().chatCount || 0) + 1;
    return res.status(200).json({ scores, total, issues, comment, used, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '심사관이 잠시 자리를 비웠어요. 다시 시도해 주세요.' });
  }
};
