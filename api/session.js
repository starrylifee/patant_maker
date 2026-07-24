const { db, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { code, nickname } = req.body || {};
    if (!code || !nickname) return res.status(400).json({ error: '활동코드와 별명을 입력하세요.' });
    if (String(nickname).length > 12) return res.status(400).json({ error: '별명은 12자 이내로 해주세요.' });

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
      if (!readonly) await last.ref.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json({
        sessionId: last.id,
        chatLimit,
        chatUsed: last.data().chatCount || 0,
        draft: last.data().draft || null,
        idea: last.data().idea || null,
        resumed: true,
        readonly
      });
    }

    const ref = await db().collection('sessions').add({
      code: codeDoc.id,
      nickname: nick,
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
