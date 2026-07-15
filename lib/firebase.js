const admin = require('firebase-admin');

function db() {
  if (!admin.apps.length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('../serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

module.exports = { db, admin };
