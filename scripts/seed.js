// 테스트용 활동코드 DEMO 생성
const { db } = require('../lib/firebase');

(async () => {
  await db().collection('codes').doc('DEMO').set({
    active: true,
    chatLimit: 30,
    createdAt: new Date()
  });
  console.log('활동코드 DEMO 생성 완료');
  process.exit(0);
})();
