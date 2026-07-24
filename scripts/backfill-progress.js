// 1회성 백필: 기존 세션의 events를 훑어 hasOcr / lastScore를 채운다.
const { db } = require('../lib/firebase');

(async () => {
  const snap = await db().collection('sessions').get();
  let touched = 0;
  for (const doc of snap.docs) {
    const patch = {};
    if (doc.data().hasOcr !== true) {
      const ocr = await doc.ref.collection('events').where('type', '==', 'ocr').limit(1).get();
      if (!ocr.empty) patch.hasOcr = true;
    }
    if (typeof doc.data().lastScore !== 'number') {
      const revs = await doc.ref.collection('events').where('type', '==', 'review').get();
      if (!revs.empty) {
        const latest = revs.docs.reduce((a, b) => {
          const ta = a.data().ts, tb = b.data().ts;
          return (tb && tb.toMillis ? tb.toMillis() : 0) > (ta && ta.toMillis ? ta.toMillis() : 0) ? b : a;
        });
        if (typeof latest.data().total === 'number') patch.lastScore = latest.data().total;
      }
    }
    if (Object.keys(patch).length) {
      await doc.ref.update(patch);
      touched++;
      console.log(doc.id, doc.data().nickname, JSON.stringify(patch));
    }
  }
  console.log(`done — ${touched}/${snap.size} sessions updated`);
  process.exit(0);
})();
