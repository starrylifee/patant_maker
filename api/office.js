// 특허로 연습장 입장 게이트 — 교사가 대시보드에서 열어야(officeOpen) 입장 가능
// 단계 비밀번호: 환경변수 OFFICE_STAGE_PW (예: "2:사과,4:포도" → ②·④ 단계 진입 시 비밀번호 필요)
const { db } = require('../lib/firebase');

function stagePws() {
  const map = {};
  String(process.env.OFFICE_STAGE_PW || '').split(',').forEach(p => {
    const m = p.trim().match(/^([2-6])\s*[:=]\s*(.+)$/);
    if (m) map[m[1]] = m[2].trim();
  });
  return map;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { code, action } = req.body || {};

    if (action === 'verifyStage') {
      const pws = stagePws();
      const stage = String(req.body.stage || '');
      const pw = String(req.body.pw || '').trim();
      if (!pws[stage]) return res.status(200).json({ ok: true });
      if (pw !== pws[stage]) return res.status(401).json({ error: '비밀번호가 달라요. 선생님 설명을 듣고 다시 입력해 보세요.' });
      return res.status(200).json({ ok: true });
    }

    if (!code) return res.status(400).json({ error: '활동코드를 입력하세요.' });

    const codeDoc = await db().collection('codes').doc(String(code).trim().toUpperCase()).get();
    if (!codeDoc.exists || codeDoc.data().active !== true) {
      return res.status(403).json({ error: '활동코드가 없거나 마감되었어요. 선생님께 확인하세요.' });
    }
    if (codeDoc.data().officeOpen !== true) {
      return res.status(423).json({ error: '아직 출원 체험 시간이 아니에요. 선생님이 문을 열어줄 때까지 기다려요.' });
    }
    return res.status(200).json({ open: true, locks: Object.keys(stagePws()).map(Number) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '확인 중 오류가 났어요. 다시 시도해 주세요.' });
  }
};
