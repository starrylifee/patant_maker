// 교사 대시보드 API — 관리자 비밀번호 또는 구글 로그인(승인된 교사)으로 접근
// 승인제: 교사는 자기 활동코드만 보고 관리한다. 관리자는 전체 + 교사 승인 관리.
const { db, admin } = require('../lib/firebase');
const { authTeacher, ownsCode } = require('../lib/teacherAuth');

function tsToMs(t) { return t && t.toMillis ? t.toMillis() : null; }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { action } = req.body || {};
    const auth = await authTeacher(req.body);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    // 코드 문서를 읽고 내 것인지 확인
    async function getOwnedCode(code) {
      const ref = db().collection('codes').doc(String(code || '').trim().toUpperCase());
      const doc = await ref.get();
      if (!doc.exists) return { error: '없는 코드예요.' };
      if (!ownsCode(auth, doc.data())) return { error: '내 활동코드가 아니에요.' };
      return { ref, doc };
    }
    // 세션(학생)이 내 코드 소속인지 확인
    async function getOwnedSession(sessionId) {
      const sRef = db().collection('sessions').doc(String(sessionId || ''));
      const sDoc = await sRef.get();
      if (!sDoc.exists) return { error: '학생 기록을 찾을 수 없어요.' };
      if (!auth.admin) {
        const cDoc = await db().collection('codes').doc(String(sDoc.data().code || '')).get();
        if (!cDoc.exists || !ownsCode(auth, cDoc.data())) return { error: '내 활동코드의 학생이 아니에요.' };
      }
      return { sRef, sDoc };
    }

    if (action === 'login') return res.status(200).json({ ok: true, admin: auth.admin, email: auth.email });

    if (action === 'codes') {
      const snap = await db().collection('codes').get();
      const codes = snap.docs
        .filter(d => ownsCode(auth, d.data()))
        .map(d => ({
          code: d.id,
          owner: d.data().owner || null,
          active: d.data().active === true,
          officeOpen: d.data().officeOpen === true,
          slidesOpen: d.data().slidesOpen === true,
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
        active: true, officeOpen: false, slidesOpen: false, chatLimit,
        owner: auth.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'setCode') {
      const found = await getOwnedCode(req.body.code);
      if (found.error) return res.status(403).json({ error: found.error });
      const patch = {};
      if (typeof req.body.active === 'boolean') patch.active = req.body.active;
      if (typeof req.body.officeOpen === 'boolean') patch.officeOpen = req.body.officeOpen;
      if (typeof req.body.slidesOpen === 'boolean') patch.slidesOpen = req.body.slidesOpen;
      if (req.body.chatLimit) patch.chatLimit = Math.max(1, Math.min(100, parseInt(req.body.chatLimit)));
      if (!Object.keys(patch).length) return res.status(400).json({ error: '바꿀 내용이 없어요.' });
      await found.ref.update(patch);
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteCode') {
      const found = await getOwnedCode(req.body.code);
      if (found.error) return res.status(403).json({ error: found.error });
      const code = found.ref.id;
      const snap = await db().collection('sessions').where('code', '==', code).get();
      for (const doc of snap.docs) {
        for (const sub of ['media', 'events']) {
          const subDocs = (await doc.ref.collection(sub).get()).docs;
          while (subDocs.length) {
            const batch = db().batch();
            subDocs.splice(0, 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
        await doc.ref.delete();
      }
      await found.ref.delete();
      return res.status(200).json({ ok: true });
    }

    if (action === 'students') {
      const found = await getOwnedCode(req.body.code);
      if (found.error) return res.status(403).json({ error: found.error });
      const snap = await db().collection('sessions').where('code', '==', found.ref.id).get();
      const students = snap.docs.map(d => ({
        sessionId: d.id,
        nickname: d.data().nickname,
        pin: d.data().pin || null,
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

    if (action === 'setMedia') {
      const kind = req.body.kind === 'drawing' ? 'drawing' : 'worksheet';
      const dataUrl = req.body.dataUrl;
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: '사진이 없어요.' });
      }
      if (dataUrl.length > 900000) return res.status(400).json({ error: '사진이 너무 커요.' });
      const found = await getOwnedSession(req.body.sessionId);
      if (found.error) return res.status(403).json({ error: found.error });
      await found.sRef.collection('media').doc(kind).set({ dataUrl });
      if (kind === 'drawing') await found.sRef.update({ hasDrawing: true }).catch(() => {});
      return res.status(200).json({ ok: true });
    }

    if (action === 'media') {
      const found = await getOwnedSession(req.body.sessionId);
      if (found.error) return res.status(403).json({ error: found.error });
      const col = found.sRef.collection('media');
      const [ws, dr] = await Promise.all([col.doc('worksheet').get(), col.doc('drawing').get()]);
      return res.status(200).json({
        worksheet: ws.exists ? ws.data().dataUrl : null,
        drawing: dr.exists ? dr.data().dataUrl : null
      });
    }

    if (action === 'deleteStudent') {
      const found = await getOwnedSession(req.body.sessionId);
      if (found.error) return res.status(403).json({ error: found.error });
      for (const sub of ['media', 'events']) {
        const docs = (await found.sRef.collection(sub).get()).docs;
        while (docs.length) {
          const batch = db().batch();
          docs.splice(0, 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await found.sRef.delete();
      return res.status(200).json({ ok: true });
    }

    if (action === 'events') {
      const found = await getOwnedSession(req.body.sessionId);
      if (found.error) return res.status(403).json({ error: found.error });
      const snap = await found.sRef.collection('events').orderBy('ts', 'asc').get();
      const events = snap.docs.map(d => ({ ...d.data(), ts: tsToMs(d.data().ts) }));
      return res.status(200).json({ events });
    }

    // ---------- 관리자 전용: 교사 승인 관리 ----------
    if (action === 'teachers') {
      if (!auth.admin) return res.status(403).json({ error: '관리자만 볼 수 있어요.' });
      const snap = await db().collection('teachers').get();
      const teachers = snap.docs.map(d => ({
        email: d.id,
        name: d.data().name || '',
        approved: d.data().approved === true,
        requestedAt: tsToMs(d.data().requestedAt),
        approvedAt: tsToMs(d.data().approvedAt)
      })).sort((a, b) => Number(a.approved) - Number(b.approved) || (b.requestedAt || 0) - (a.requestedAt || 0));
      return res.status(200).json({ teachers });
    }

    if (action === 'setTeacher') {
      if (!auth.admin) return res.status(403).json({ error: '관리자만 할 수 있어요.' });
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: '이메일이 없어요.' });
      const ref = db().collection('teachers').doc(email);
      if (req.body.remove === true) {
        await ref.delete();
        return res.status(200).json({ ok: true });
      }
      await ref.set({
        approved: req.body.approved === true,
        approvedAt: req.body.approved === true ? admin.firestore.FieldValue.serverTimestamp() : null
      }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: '알 수 없는 요청이에요.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '처리 중 오류가 났어요.' });
  }
};
