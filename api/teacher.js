// 교사 대시보드 API — 모든 요청에 비밀번호(TEACHER_PASSWORD) 필요
const { db, admin } = require('../lib/firebase');

function tsToMs(t) { return t && t.toMillis ? t.toMillis() : null; }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { password, action } = req.body || {};
    const PW = process.env.TEACHER_PASSWORD;
    if (!PW) return res.status(500).json({ error: '서버에 TEACHER_PASSWORD가 설정되지 않았어요.' });
    if (password !== PW) return res.status(401).json({ error: '비밀번호가 틀렸어요.' });

    if (action === 'login') return res.status(200).json({ ok: true });

    if (action === 'codes') {
      const snap = await db().collection('codes').get();
      const codes = snap.docs.map(d => ({
        code: d.id,
        active: d.data().active === true,
        officeOpen: d.data().officeOpen === true,
        chatLimit: d.data().chatLimit || 30,
        createdAt: tsToMs(d.data().createdAt)
      })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return res.status(200).json({ codes });
    }

    if (action === 'createCode') {
      const code = String(req.body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{3,12}$/.test(code)) return res.status(400).json({ error: '코드는 영문·숫자 3~12자로 해주세요.' });
      const ref = db().collection('codes').doc(code);
      if ((await ref.get()).exists) return res.status(409).json({ error: '이미 있는 코드예요.' });
      const chatLimit = Math.max(1, Math.min(100, parseInt(req.body.chatLimit) || 30));
      await ref.set({
        active: true, officeOpen: false, chatLimit,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'setCode') {
      const code = String(req.body.code || '').trim().toUpperCase();
      const patch = {};
      if (typeof req.body.active === 'boolean') patch.active = req.body.active;
      if (typeof req.body.officeOpen === 'boolean') patch.officeOpen = req.body.officeOpen;
      if (req.body.chatLimit) patch.chatLimit = Math.max(1, Math.min(100, parseInt(req.body.chatLimit)));
      if (!Object.keys(patch).length) return res.status(400).json({ error: '바꿀 내용이 없어요.' });
      await db().collection('codes').doc(code).update(patch);
      return res.status(200).json({ ok: true });
    }

    if (action === 'students') {
      const code = String(req.body.code || '').trim().toUpperCase();
      const snap = await db().collection('sessions').where('code', '==', code).get();
      const students = snap.docs.map(d => ({
        sessionId: d.id,
        nickname: d.data().nickname,
        chatCount: d.data().chatCount || 0,
        lastActive: tsToMs(d.data().lastActive),
        draft: d.data().draft || null,
        idea: d.data().idea || null,
        hasOcr: d.data().hasOcr === true,
        hasDrawing: d.data().hasDrawing === true,
        hwpxDone: d.data().hwpxDone === true,
        lastScore: typeof d.data().lastScore === 'number' ? d.data().lastScore : null
      })).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      return res.status(200).json({ students });
    }

    if (action === 'media') {
      const sessionId = String(req.body.sessionId || '');
      const col = db().collection('sessions').doc(sessionId).collection('media');
      const [ws, dr] = await Promise.all([col.doc('worksheet').get(), col.doc('drawing').get()]);
      return res.status(200).json({
        worksheet: ws.exists ? ws.data().dataUrl : null,
        drawing: dr.exists ? dr.data().dataUrl : null
      });
    }

    if (action === 'events') {
      const sessionId = String(req.body.sessionId || '');
      const snap = await db().collection('sessions').doc(sessionId).collection('events').orderBy('ts', 'asc').get();
      const events = snap.docs.map(d => ({ ...d.data(), ts: tsToMs(d.data().ts) }));
      return res.status(200).json({ events });
    }

    return res.status(400).json({ error: '알 수 없는 요청이에요.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '처리 중 오류가 났어요.' });
  }
};
