const { db, admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { sessionId, draft, idea, flags, drawing } = req.body || {};
    if (!sessionId || (!draft && !idea && !flags && !drawing)) return res.status(400).json({ error: 'no draft' });

    const sDoc = await db().collection('sessions').doc(sessionId).get();
    if (!sDoc.exists) return res.status(403).json({ error: '먼저 활동코드로 입장해 주세요.' });
    const codeDoc = await db().collection('codes').doc(sDoc.data().code).get();
    if (!codeDoc.exists || codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동이 마감되어 저장할 수 없어요.' });
    }

    const patch = { lastActive: admin.firestore.FieldValue.serverTimestamp() };
    if (flags) {
      for (const k of ['hasDrawing', 'hwpxDone']) {
        if (flags[k] === true) patch[k] = true;
      }
    }
    if (draft) {
      const clean = {};
      for (const k of ['title', 'field', 'background', 'problem', 'solution', 'effect', 'drawingDesc', 'detail', 'core', 'abstract', 'labels', 'claim']) {
        if (typeof draft[k] === 'string') clean[k] = draft[k].slice(0, 3000);
      }
      patch.draft = clean;
    }
    if (idea) {
      const s = idea.stars || {};
      const sm = idea.summary || null;
      patch.idea = {
        place: String(idea.place || '').slice(0, 20),
        problem: String(idea.problem || '').slice(0, 1000),
        basket: (Array.isArray(idea.basket) ? idea.basket : []).slice(0, 5).map(b => ({
          tool: String((b && b.tool) || '').slice(0, 40),
          text: String((b && b.text) || '').slice(0, 1000)
        })),
        best: Number.isInteger(idea.best) ? idea.best : -1,
        stars: { fresh: +s.fresh || 0, make: +s.make || 0, help: +s.help || 0 },
        summary: sm ? {
          name: String(sm.name || '').slice(0, 500), problem: String(sm.problem || '').slice(0, 500),
          solution: String(sm.solution || '').slice(0, 500), effect: String(sm.effect || '').slice(0, 500),
          cheer: String(sm.cheer || '').slice(0, 500)
        } : null
      };
    }
    if (typeof drawing === 'string' && drawing.startsWith('data:image/')) {
      if (drawing.length > 900000) return res.status(400).json({ error: '그림이 너무 커요.' });
      await db().collection('sessions').doc(sessionId).collection('media').doc('drawing').set({ dataUrl: drawing });
      patch.hasDrawing = true;
    }
    await db().collection('sessions').doc(sessionId).update(patch);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'save failed' });
  }
};
