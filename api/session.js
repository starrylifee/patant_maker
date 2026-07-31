const { db, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { code, nickname } = req.body || {};
    if (!code || !nickname) return res.status(400).json({ error: '활동코드와 별명을 입력하세요.' });
    if (String(nickname).length > 12) return res.status(400).json({ error: '별명은 12자 이내로 해주세요.' });
    const pin = String(req.body.pin || '').trim();
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: '비밀번호(PIN)는 숫자 4자리로 정해 주세요.' });

    const codeDoc = await db().collection('codes').doc(String(code).trim().toUpperCase()).get();
    if (!codeDoc.exists) {
      return res.status(403).json({ error: '활동코드가 없어요. 선생님께 확인하세요.' });
    }
    const readonly = codeDoc.data().active !== true; // 마감된 코드는 읽기 전용으로만 입장
    const chatLimit = codeDoc.data().chatLimit || 30;
    const nick = String(nickname).trim();

    // 같은 코드 + 같은 별명이면 기존 세션을 이어간다 (여러 개면 가장 최근 것)
    const snap = await db().collection('sessions')
      .where('code', '==', codeDoc.id).where('nickname', '==', nick).get();
    if (readonly && snap.empty) {
      return res.status(403).json({ error: '활동이 마감되었어요. 이 별명으로 쓴 기록이 없어요.' });
    }
    if (!snap.empty) {
      const last = snap.docs.reduce((a, b) => {
        const ta = a.data().lastActive, tb = b.data().lastActive;
        return (tb && tb.toMillis ? tb.toMillis() : 0) > (ta && ta.toMillis ? ta.toMillis() : 0) ? b : a;
      });
      // PIN이 걸린 계정이면 일치해야 입장, 없던 계정(예전 학생)이면 지금 입력한 PIN을 등록
      const savedPin = last.data().pin;
      if (savedPin && savedPin !== pin) {
        return res.status(403).json({ error: '비밀번호(PIN)가 달라요. 기억이 안 나면 선생님께 물어보세요.' });
      }
      const patch = {};
      if (!savedPin) patch.pin = pin;
      if (!readonly) patch.lastActive = admin.firestore.FieldValue.serverTimestamp();
      if (Object.keys(patch).length) await last.ref.update(patch);
      // 그림·활동지 사진 복원 (재입장 시 한글파일에 그림이 빠지지 않게)
      const mediaCol = last.ref.collection('media');
      const [dr, ws] = await Promise.all([mediaCol.doc('drawing').get(), mediaCol.doc('worksheet').get()]);
      return res.status(200).json({
        sessionId: last.id,
        chatLimit,
        chatUsed: last.data().chatCount || 0,
        draft: last.data().draft || null,
        idea: last.data().idea || null,
        drawing: dr.exists ? dr.data().dataUrl : null,
        worksheet: ws.exists ? ws.data().dataUrl : null,
        resumed: true,
        readonly
      });
    }

    const ref = await db().collection('sessions').add({
      code: codeDoc.id,
      nickname: nick,
      pin,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      chatCount: 0,
      draft: null
    });
    return res.status(200).json({ sessionId: ref.id, chatLimit, chatUsed: 0, draft: null, idea: null, resumed: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '입장 처리 중 오류가 났어요. 다시 시도해 주세요.' });
  }
};
