const { db, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { code, nickname } = req.body || {};
    if (!code || !nickname) return res.status(400).json({ error: '활동코드와 별명을 입력하세요.' });
    if (String(nickname).length > 12) return res.status(400).json({ error: '별명은 12자 이내로 해주세요.' });

    const codeDoc = await db().collection('codes').doc(String(code).trim().toUpperCase()).get();
    if (!codeDoc.exists || codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동코드가 없거나 마감되었어요. 선생님께 확인하세요.' });
    }

    const ref = await db().collection('sessions').add({
      code: codeDoc.id,
      nickname: String(nickname).trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      chatCount: 0,
      draft: null
    });
    return res.status(200).json({ sessionId: ref.id, chatLimit: codeDoc.data().chatLimit || 30 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '입장 처리 중 오류가 났어요. 다시 시도해 주세요.' });
  }
};
