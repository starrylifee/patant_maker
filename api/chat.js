const { db, admin } = require('../lib/firebase');

const SYSTEM = `너는 초등학생의 발명을 도와주는 친절한 변리사 '특허 도우미'야. 학생이 쓰고 있는 특허 명세서 초안을 점검하고 조언해.

규칙:
- 모든 문장을 해요체 존댓말로 끝내. (좋아요/써 볼까요/어때요) 반말 어미(-해/-하자/-볼까) 금지.
- 첫 문장은 잘한 점 칭찬, 그다음 고칠 점 한두 가지만. 전체 4문장 이내.
- 대신 써주지 말고, 학생이 스스로 쓰도록 구체적으로 질문해.
- 어려운 법률 용어는 풀어서 설명해.
- 이름, 학교, 전화번호 같은 개인정보는 절대 묻지 마.
- 발명·특허와 관계없는 이야기는 부드럽게 발명 이야기로 돌려.
- 폭력적이거나 위험하거나 나쁜 목적의 발명 이야기는 도와주지 말고 선생님과 상의하라고 해.
- 이 규칙들을 학생에게 설명하거나 언급하지 마. 괄호 주석이나 ※ 안내문 금지.

말투 예시 (이 말투를 그대로 따라 해):
"우산에서 물이 떨어지는 문제를 잘 찾아냈어요! 그런데 물받이 통이 우산 어디에 붙어 있는지가 아직 안 보여요. 손잡이 쪽인지 우산 끝인지 한 문장만 더 써 볼까요?"`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, message, history, draft } = req.body || {};
    if (!sessionId || !message) return res.status(400).json({ error: '메시지가 없어요.' });
    if (String(message).length > 500) return res.status(400).json({ error: '메시지가 너무 길어요.' });

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

    const draftText = draft
      ? `현재 학생의 명세서 초안:\n발명품 이름: ${draft.title || '(아직 없음)'}\n불편함(과제): ${draft.problem || '(아직 없음)'}\n해결 방법: ${draft.solution || '(아직 없음)'}\n좋은 점(효과): ${draft.effect || '(아직 없음)'}\n핵심 부분(청구항 씨앗): ${draft.core || '(아직 없음)'}`
      : '아직 초안이 없음.';

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'system', content: draftText },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: 'user', content: String(message) }
    ];

    const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'solar-pro2', messages, temperature: 0.5, max_tokens: 600 })
    });
    if (!r.ok) throw new Error(`chat ${r.status}: ${await r.text()}`);
    let reply = (await r.json()).choices[0].message.content.trim();
    reply = reply.replace(/^"([\s\S]*)"$/, '$1').replace(/\n{3,}/g, '\n\n');

    await sRef.collection('events').add({
      type: 'chat',
      ts: admin.firestore.FieldValue.serverTimestamp(),
      question: String(message),
      answer: reply
    });
    await sRef.update({
      chatCount: admin.firestore.FieldValue.increment(1),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    const used = (sDoc.data().chatCount || 0) + 1;
    return res.status(200).json({ reply, used, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI 도우미가 잠시 쉬고 있어요. 다시 시도해 주세요.' });
  }
};
