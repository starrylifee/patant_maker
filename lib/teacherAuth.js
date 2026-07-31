// 교사 인증 공통 모듈 — 두 가지 길을 모두 허용한다.
//  ① 관리자 비밀번호(TEACHER_PASSWORD): 기존 방식, 관리자 권한
//  ② 구글 로그인 ID 토큰(idToken): 승인(approved)된 교사만 통과, 관리자 이메일은 자동 승인
// 반환: { ok, admin, email } 또는 { ok:false, status, error }
const { db, admin } = require('./firebase');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'forinnocen@gmail.com').toLowerCase();

async function authTeacher(body) {
  const PW = process.env.TEACHER_PASSWORD;
  if (!PW) return { ok: false, status: 500, error: '서버에 TEACHER_PASSWORD가 설정되지 않았어요.' };

  if (body && typeof body.password === 'string' && body.password.length) {
    if (body.password !== PW) return { ok: false, status: 401, error: '비밀번호가 틀렸어요.' };
    return { ok: true, admin: true, email: ADMIN_EMAIL };
  }

  if (body && typeof body.idToken === 'string' && body.idToken.length) {
    db(); // admin 앱 초기화 보장
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(body.idToken);
    } catch (e) {
      return { ok: false, status: 401, error: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
    }
    const email = String(decoded.email || '').toLowerCase();
    if (!email) return { ok: false, status: 401, error: '이메일 정보를 확인할 수 없어요.' };
    if (email === ADMIN_EMAIL) return { ok: true, admin: true, email };

    const ref = db().collection('teachers').doc(email);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        approved: false,
        name: decoded.name || '',
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { ok: false, status: 403, error: 'pending' };
    }
    if (doc.data().approved !== true) return { ok: false, status: 403, error: 'pending' };
    return { ok: true, admin: false, email };
  }

  return { ok: false, status: 401, error: '로그인이 필요해요.' };
}

// 활동코드 소유 확인 — 관리자는 전부 허용, 주인 없는 옛 코드는 관리자 것으로 취급
function ownsCode(auth, codeData) {
  if (auth.admin) return true;
  return (codeData.owner || ADMIN_EMAIL) === auth.email;
}

module.exports = { authTeacher, ownsCode, ADMIN_EMAIL };
