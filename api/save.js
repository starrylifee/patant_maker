const { db, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, draft } = req.body || {};
    if (!sessionId || !draft) return res.status(400).json({ error: 'no draft' });

    const clean = {};
    for (const k of ['title', 'problem', 'solution', 'effect', 'core', 'drawingDesc', 'labels', 'claim']) {
      if (typeof draft[k] === 'string') clean[k] = draft[k].slice(0, 3000);
    }
    await db().collection('sessions').doc(sessionId).update({
      draft: clean,
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'save failed' });
  }
};
