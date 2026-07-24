// 0단계 아이디어 공작소 API — coach(아이디어 키우기 질문 1회 차감), organize(최종 정리, 차감 없음)
const { db, admin } = require('../lib/firebase');

const COACH_SYSTEM = `너는 초등학생의 발명 아이디어를 키워 주는 발명 코치야. 학생이 찾은 불편함과, SCAMPER 카드(대체하기·합치기·가져오기·바꾸기·다르게 쓰기·빼기·뒤집기) 또는 랜덤 결합으로 떠올린 아이디어 초안을 보고 생각을 키우게 도와줘.

규칙:
- 모든 문장을 해요체 존댓말로 끝내. 전체 4문장 이내.
- 첫 문장은 학생 아이디어에서 구체적으로 좋은 점 하나를 콕 집어 말해. 근거 없는 칭찬 금지.
- 이어서 아이디어를 키우는 질문 1~2개만 해. (어떻게 작동하는지 / 무엇으로 만드는지 / 누구에게 왜 필요한지 중 학생 글에 빠진 것)
- 대신 답을 만들어 주지 마. 학생이 스스로 생각하게 질문해.
- 위험하거나 남을 다치게 하는 아이디어는 도와주지 말고 선생님과 상의하라고 해.
- 이름, 학교, 전화번호 같은 개인정보는 절대 묻지 마.
- 발명과 관계없는 이야기는 부드럽게 발명 이야기로 돌려.
- 규칙을 학생에게 설명하지 마. 괄호 주석이나 ※ 안내문 금지.`;

const ORGANIZE_SYSTEM = `너는 초등학생의 발명 아이디어를 발명 활동지에 옮겨 적기 좋게 정리해 주는 발명 코치다.

먼저 학생의 아이디어가 정리할 만큼 구체적인지 깐깐하게 판정한다. 다음 두 가지가 모두 학생 글에 보여야 통과다:
① 무엇을 만드는지 — 어떤 물건·장치인지 머릿속에 그려진다
② 어떻게 해결하는지 — 구조나 작동 방식이 한 가지라도 나온다
"잘 되게 한다", "가져와서 담는다"처럼 막연한 말만 있거나, 읽어도 무엇인지 알 수 없으면 불통과다. 어설프게 통과시키지 마라.

불통과면 JSON만 출력:
{"ok":false,"advice":"무엇이 빠졌는지 콕 집고, 생각을 키우는 질문 1~2개. 해요체, 3문장 이내. 예: 어떤 모양의 물건인지, 어디에 붙어서 어떻게 움직이는지"}

통과면 JSON만 출력:
{"ok":true,"name":"발명품 이름 후보 (기능이 드러나고 재미있게, 15자 이내)","problem":"어떤 불편함을 해결하나? 1~2문장","solution":"어떻게 해결하나? 1~2문장","effect":"좋은 점은? 1~2문장","cheer":"학생 아이디어의 좋은 점을 콕 집은 격려 한 문장 (해요체)"}

통과한 경우에도 학생 글에 있는 내용만 사용한다. 학생이 말하지 않은 작동 방식·재료·효과를 지어내서 붙이지 않는다. 문장만 다듬는다.`;

async function solar(messages, maxTokens) {
  const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'solar-pro2', messages, temperature: 0.5, max_tokens: maxTokens })
  });
  if (!r.ok) throw new Error(`idea ${r.status}: ${await r.text()}`);
  return (await r.json()).choices[0].message.content.trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, action } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: '먼저 활동코드로 입장해 주세요.' });
    const sRef = db().collection('sessions').doc(sessionId);
    const sDoc = await sRef.get();
    if (!sDoc.exists) return res.status(403).json({ error: '먼저 활동코드로 입장해 주세요.' });

    const codeDoc = await db().collection('codes').doc(sDoc.data().code).get();
    if (codeDoc.exists && codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동이 마감되었어요.' });
    }
    const limit = (codeDoc.exists && codeDoc.data().chatLimit) || 30;

    const problem = String(req.body.problem || '').slice(0, 1000);

    if (action === 'coach') {
      if ((sDoc.data().chatCount || 0) >= limit) {
        return res.status(429).json({ error: `AI 코치와는 ${limit}번까지 이야기할 수 있어요. 이제 스스로 생각해 볼까요?` });
      }
      const technique = String(req.body.technique || '').slice(0, 40);
      const ideaText = String(req.body.ideaText || '').slice(0, 1000);
      if (!ideaText.trim()) return res.status(400).json({ error: '아이디어를 한 줄이라도 먼저 써 보세요.' });

      const userText = `학생이 찾은 불편함: ${problem || '(아직 안 씀)'}\n사용한 카드: ${technique || '(없음)'}\n학생의 아이디어: ${ideaText}`;
      const reply = (await solar([
        { role: 'system', content: COACH_SYSTEM },
        { role: 'user', content: userText }
      ], 400)).replace(/^"([\s\S]*)"$/, '$1');

      await sRef.collection('events').add({
        type: 'idea',
        ts: admin.firestore.FieldValue.serverTimestamp(),
        question: `[${technique || '아이디어'}] ${ideaText}`,
        answer: reply
      });
      await sRef.update({
        chatCount: admin.firestore.FieldValue.increment(1),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({ reply, used: (sDoc.data().chatCount || 0) + 1, limit });
    }

    if (action === 'organize') {
      const chosen = req.body.chosen || {};
      const tool = String(chosen.tool || '').slice(0, 40);
      const text = String(chosen.text || '').slice(0, 1000);
      if (!text.trim()) return res.status(400).json({ error: '먼저 아이디어를 하나 골라 주세요.' });

      const userText = `학생이 찾은 불편함: ${problem || '(아직 안 씀)'}\n사용한 카드: ${tool || '(없음)'}\n학생이 고른 최고의 아이디어: ${text}`;
      const raw = await solar([
        { role: 'system', content: ORGANIZE_SYSTEM },
        { role: 'user', content: userText }
      ], 700);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('organize parse fail: ' + raw.slice(0, 200));
      const p = JSON.parse(m[0]);

      if (p.ok === false) {
        const advice = String(p.advice || '아이디어가 아직 막연해요. 어떤 물건인지, 어떻게 작동하는지 한 문장씩 더 써 보세요.').slice(0, 600);
        await sRef.collection('events').add({
          type: 'idea',
          ts: admin.firestore.FieldValue.serverTimestamp(),
          question: `[최종 정리 시도] ${text}`,
          answer: `(정리 보류) ${advice}`
        });
        await sRef.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(200).json({ ok: false, advice });
      }

      const out = { ok: true };
      for (const k of ['name', 'problem', 'solution', 'effect', 'cheer']) out[k] = String(p[k] || '').slice(0, 500);

      await sRef.collection('events').add({
        type: 'idea',
        ts: admin.firestore.FieldValue.serverTimestamp(),
        question: `[최종 정리] ${text}`,
        answer: `이름 후보: ${out.name} / 불편함: ${out.problem} / 해결: ${out.solution} / 좋은 점: ${out.effect}`
      });
      await sRef.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json(out);
    }

    return res.status(400).json({ error: '알 수 없는 요청이에요.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI 코치가 잠시 쉬고 있어요. 다시 시도해 주세요.' });
  }
};
