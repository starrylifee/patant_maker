// 발표 슬라이드 데이터 — 명세서를 AI가 발표 문구로 요약하고 세션에 캐시한다.
// 교사(비밀번호)는 항상 열람, 학생(자기 sessionId)은 교사가 slidesOpen을 켠 코드만 열람.
const { db, admin } = require('../lib/firebase');
const { authTeacher, ownsCode } = require('../lib/teacherAuth');

const SYSTEM = `너는 초등학생의 발명 발표 슬라이드 문구를 만드는 도우미다. 학생이 쓴 특허 명세서 초안을 재료로, 발표하기 좋은 짧은 문구로 다듬는다.

규칙:
- 학생 글에 있는 내용만 사용한다. 새 기능·수치를 지어내지 않는다.
- 각 요점은 25자 이내의 짧은 구절로. 문어체 종결어미(~다) 또는 명사형으로 끝낸다.
- 초등학생이 소리 내어 읽기 좋은 쉬운 낱말로.

출력은 JSON만:
{"tagline":"발명을 한 문장으로 소개 (30자 이내)","problem":["불편했던 점 요점 2~3개"],"solution":["해결 방법 요점 2~3개 (구조·작동이 드러나게)"],"effect":["좋아진 점 요점 2~3개"],"claim":"발명의 핵심 한 문장 (~를 포함하는 ○○)"}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { password, idToken, sessionId } = req.body || {};
    const isTeacherReq = (typeof password === 'string' && password.length > 0) || (typeof idToken === 'string' && idToken.length > 0);
    if (!sessionId) return res.status(400).json({ error: 'sessionId가 없어요.' });

    let auth = null;
    if (isTeacherReq) {
      auth = await authTeacher(req.body);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error === 'pending' ? '아직 관리자의 승인을 기다리고 있어요.' : auth.error });
    }

    const sRef = db().collection('sessions').doc(sessionId);
    const sDoc = await sRef.get();
    if (!sDoc.exists) return res.status(404).json({ error: '학생 기록을 찾을 수 없어요.' });
    const codeDoc = await db().collection('codes').doc(String(sDoc.data().code || '')).get();
    if (auth) {
      if (!codeDoc.exists || !ownsCode(auth, codeDoc.data())) return res.status(403).json({ error: '내 활동코드의 학생이 아니에요.' });
    } else {
      if (!codeDoc.exists || codeDoc.data().slidesOpen !== true) {
        return res.status(423).json({ error: '아직 발표 연습 시간이 아니에요. 선생님이 문을 열어줄 때까지 기다려요.' });
      }
    }
    const d = sDoc.data().draft || {};
    if (!(d.title || '').trim() && !(d.solution || '').trim()) {
      return res.status(400).json({ error: '아직 명세서 내용이 없어서 슬라이드를 만들 수 없어요.' });
    }

    // 명세서가 바뀌지 않았으면 캐시 재사용 (AI 호출 없음)
    const src = JSON.stringify([d.title, d.problem, d.solution, d.effect, d.core]);
    let deck = sDoc.data().slideDeck || null;
    if (!deck || deck.src !== src) {
      const userText = `학생의 명세서 초안:
발명의 명칭: ${d.title || '(없음)'}
해결하려는 과제: ${d.problem || '(없음)'}
과제의 해결 수단: ${d.solution || '(없음)'}
발명의 효과: ${d.effect || '(없음)'}
청구범위: ${d.core || '(없음)'}`;
      try {
        const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'solar-pro2',
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }],
            temperature: 0.3, max_tokens: 800
          })
        });
        if (!r.ok) throw new Error(`slides ${r.status}`);
        const raw = (await r.json()).choices[0].message.content;
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('parse fail');
        const p = JSON.parse(m[0]);
        const arr = v => (Array.isArray(v) ? v : [v]).filter(Boolean).slice(0, 4).map(x => String(x).slice(0, 60));
        deck = {
          src,
          tagline: String(p.tagline || '').slice(0, 80),
          problem: arr(p.problem), solution: arr(p.solution), effect: arr(p.effect),
          claim: String(p.claim || '').slice(0, 120)
        };
      } catch (e) {
        // AI가 실패해도 원문으로 슬라이드는 열리게
        console.error(e);
        const cut = (t, n) => String(t || '').split(/(?<=[.!?다요])\s+/).filter(Boolean).slice(0, n).map(x => x.slice(0, 60));
        deck = { src, tagline: '', problem: cut(d.problem, 3), solution: cut(d.solution, 3), effect: cut(d.effect, 3), claim: String(d.core || '').slice(0, 120) };
      }
      await sRef.update({ slideDeck: deck });
    }

    const col = sRef.collection('media');
    const [dr, ws] = await Promise.all([col.doc('drawing').get(), col.doc('worksheet').get()]);
    return res.status(200).json({
      nickname: sDoc.data().nickname,
      title: d.title || '나의 발명품',
      deck,
      drawing: dr.exists ? dr.data().dataUrl : null,
      worksheet: ws.exists ? ws.data().dataUrl : null
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '슬라이드를 만들다가 문제가 생겼어요. 다시 시도해 주세요.' });
  }
};
