const { db, admin } = require('../lib/firebase');

const SYSTEM = `너는 초등학생의 특허 명세서 초안을 심사하는 깐깐한 변리사다. 친절하지만 점수는 엄격하게 준다. 근거 없는 칭찬은 하지 않는다.

심사의 대원칙은 실제 특허법과 같다: "그 분야의 기술자(다른 사람)가 이 글만 읽고 발명품을 그대로 만들 수 있을 만큼 명확하고 상세한가?" 모든 항목을 이 잣대로 판단한다.

판단 기준은 특허청 모범명세서다. 모범명세서에서 각 항목이 하는 일:
- 발명의 명칭: 무엇에 관한 발명인지 이름만 봐도 알 수 있다.
- 해결하려는 과제: 기존 방식의 문제점을 짚고 "이를 해결하는 것을 목적으로 한다"로 끝난다.
- 과제의 해결 수단: 구성 요소를 하나씩 들며 재료·조건·수치까지 특정한다 (모범명세서는 성분 함량과 온도·속도 범위까지 적는다).
- 발명의 효과: 이 발명으로 무엇이 어떻게 좋아지는지 구체적으로 적는다.
- 실시하기 위한 구체적인 내용: 실제로 만들 때의 재질·크기·만드는 방법·사용 순서를 예시로 적는다.
- 청구범위: 구성 요소를 나열하고 "~하는 것을 특징으로 하는 ○○" 형태로 발명을 특정한다.

채점 항목과 만점 (합계 100점):
- title(발명의 명칭): 10점 만점. 무엇을 하는 물건인지 드러나면 높은 점수, 멋만 부린 이름은 낮은 점수.
- problem(해결하려는 과제): 15점 만점. 언제·어디서·누가·무엇이 불편한지 중 3가지 이상 있어야 12점 이상.
- solution(과제의 해결 수단): 25점 만점. 가장 중요. ① 부품 이름 ② 부품이 어디에 어떻게 붙는지 ③ 작동 순서 ④ 무엇의 힘으로 움직이는지(전기·손·용수철 등) 네 가지가 모두 있어야 19점 이상. 하나 빠질 때마다 4~5점씩 깎는다.
- effect(발명의 효과): 15점 만점. 쓰기 전과 후의 차이가 눈에 보이게 비교되어야 12점 이상.
- detail(실시하기 위한 구체적인 내용): 15점 만점. 재질·크기(수치)·만드는 법·사용 순서 중 2가지 이상 있어야 12점 이상. 수치가 하나도 없으면 8점 이하.
- core(청구범위): 20점 만점. "~를 포함하는 ○○" 모양이고 구성 요소가 2개 이상 특정되어야 15점 이상. 기능만 나열한 문장("~해 주는 ○○입니다")은 10점을 넘길 수 없다.

감점 규칙 — 반드시 적용:
1. "멋진, 좋은, 편리한, 신기한, 대단한, 짱, 최고" 같은 느낌·주관 낱말이 근거 없이 쓰이면 감점하고 issues에 넣는다.
2. 설명이 한 문장도 안 되게 짧거나 낱말만 던져 놓았으면 크게 감점한다 (해당 항목 만점의 1/4 이하).
3. 빈 항목은 0점.
4. 여섯 항목을 다 읽어도 발명의 요지(무엇이, 어떻게 작동해서, 어떤 문제를 해결하는지)가 안 보이면 solution과 core를 만점의 1/3 이하로 주고 comment에 그 사실을 말한다.
5. 만점 근처(90% 이상)는 실제 변리사가 쓴 수준일 때만. 초등학생이 아주 잘 써도 항목당 만점의 60~75%가 보통이다.
6. 총점 80점(통과)은 여섯 항목이 전부 필수 요소를 갖춘 예외적인 경우에만 나온다. 애매하면 낮은 쪽 점수를 준다.

참고 항목(기술분야·배경기술·도면 설명·요약)은 채점하지 않는다. 다만 비어 있으면 comment에서 채우라고 알려 준다.

[출력 형식 — JSON만 출력, 다른 글자 금지]
{"scores":{"title":0,"problem":0,"solution":0,"effect":0,"detail":0,"core":0},"issues":[{"field":"solution","quote":"문제가 된 표현 그대로","why":"왜 안 되는지 한 문장","fix":"어떻게 고칠지 방향만 한 문장 (답을 대신 써 주지 않기)"}],"comment":"총평 3~4문장. 해요체 존댓말. 반드시 '다른 사람이 이 글만 읽고 내 발명품을 그대로 만들 수 있는가'라는 기준에 비추어 지금 무엇이 부족한지 말한다. 잘한 점이 실제로 있으면 한 가지만 짚고, 오늘 고칠 일 한 가지를 정해 준다. 점수가 낮아도 기죽이지 말고 '오늘 한 가지를 고치면 어제보다 나아진다'는 태도로 쓴다."}

issues는 문제가 있는 것만 담는다 (0~6개). 모든 글은 초등학생이 읽으므로 쉬운 말로 쓴다. 개인정보는 다루지 않는다.`;

const FIELD_MAX = { title: 10, problem: 15, solution: 25, effect: 15, detail: 15, core: 20 };
const FIELDS = Object.keys(FIELD_MAX);

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

    // 지난 심사 기록 — 점수 요동을 줄이는 기준점
    const prev = sDoc.data().lastReview || null;
    const FIELD_KO = { title: '명칭', problem: '과제', solution: '해결', effect: '효과', detail: '실시', core: '청구' };
    const unchanged = k => prev && prev.fields && (prev.fields[k] || '') === (d[k] || '');

    // 모든 항목이 지난 심사와 똑같으면 AI를 부르지 않고 지난 결과를 그대로 돌려준다 (횟수 차감 없음)
    if (prev && prev.scores && typeof prev.total === 'number' && FIELDS.every(unchanged)) {
      return res.status(200).json({
        scores: prev.scores, max: FIELD_MAX, total: prev.total,
        issues: prev.issues || [],
        comment: (prev.comment || '') + ' (지난 심사와 글이 같아서 점수도 같아요. 한 항목이라도 고치고 다시 심사를 받아 보세요!)',
        used: sDoc.data().chatCount || 0, limit
      });
    }

    // 지난 점수는 프롬프트에 넣지 않는다 (모델이 베끼는 문제) — 안정화는 아래 서버 보정으로 처리

    const draftText = `심사할 명세서 초안:

[채점 항목]
발명의 명칭(title): ${d.title || '(비어 있음)'}
해결하려는 과제(problem): ${d.problem || '(비어 있음)'}
과제의 해결 수단(solution): ${d.solution || '(비어 있음)'}
발명의 효과(effect): ${d.effect || '(비어 있음)'}
실시하기 위한 구체적인 내용(detail): ${d.detail || '(비어 있음)'}
청구범위(core): ${d.core || '(비어 있음)'}

[참고 항목 — 채점하지 않음]
기술분야: ${d.field || '(비어 있음)'}
발명의 배경이 되는 기술: ${d.background || '(비어 있음)'}
도면의 간단한 설명: ${d.drawingDesc || '(비어 있음)'}
요약: ${d.abstract || '(비어 있음)'}`;

    // 추론 모델(pro3)은 생각이 길어지면 JSON이 잘려 나올 수 있어 1회 재시도한다
    let parsed = null, lastErr = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'solar-pro3',
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: draftText }],
            temperature: 0.2,
            max_tokens: 2500
          })
        });
        if (!r.ok) throw new Error(`review ${r.status}: ${await r.text()}`);
        const raw = (await r.json()).choices[0].message.content;
        // JSON만 뽑아서 파싱 (모델이 앞뒤에 말을 붙여도 견디게)
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('review parse fail: ' + raw.slice(0, 200));
        parsed = JSON.parse(m[0]);
      } catch (e) { lastErr = e; }
    }
    if (!parsed) throw lastErr;

    const scores = {};
    for (const k of FIELDS) {
      const v = Number(parsed.scores && parsed.scores[k]);
      scores[k] = Number.isFinite(v) ? Math.max(0, Math.min(FIELD_MAX[k], Math.round(v))) : 0;
      if (!(d[k] || '').trim()) scores[k] = 0;
      const prevScore = prev && prev.scores && Number.isFinite(prev.scores[k]) ? prev.scores[k] : null;
      if (prevScore !== null) {
        if (unchanged(k)) {
          // 안 고친 항목은 지난 점수로 고정 (AI 채점 요동 방지 — 위로도 아래로도 안 움직임)
          scores[k] = prevScore;
        } else {
          // 지난 글에 내용을 덧붙인 항목은 지난 점수 아래로 내려가지 않는다
          const oldT = ((prev.fields && prev.fields[k]) || '').trim();
          const newT = (d[k] || '').trim();
          if (oldT && newT.includes(oldT) && scores[k] < prevScore) scores[k] = prevScore;
        }
      }
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
    const fieldsSnapshot = {};
    for (const k of FIELDS) fieldsSnapshot[k] = d[k] || '';
    await sRef.update({
      chatCount: admin.firestore.FieldValue.increment(1),
      lastScore: total,
      lastReview: { scores, fields: fieldsSnapshot, total, issues, comment },
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    const used = (sDoc.data().chatCount || 0) + 1;
    return res.status(200).json({ scores, max: FIELD_MAX, total, issues, comment, used, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '심사관이 잠시 자리를 비웠어요. 다시 시도해 주세요.' });
  }
};
