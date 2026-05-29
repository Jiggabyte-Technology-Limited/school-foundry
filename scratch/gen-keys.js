const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeys() {
  console.log('Generating RSA-2048 key pair...');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const keys = {
    publicKey,
    privateKey
  };

  console.log('\n--- PUBLIC KEY PEM (For validator.ts) ---');
  console.log(publicKey);
  console.log('-------------------------------------------\n');

  console.log('\n--- PRIVATE KEY PEM (For keygen server) ---');
  console.log(privateKey);
  console.log('-------------------------------------------\n');

  const keysPath = path.join(__dirname, 'keys.json');
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), 'utf-8');
  console.log(`Saved keys to ${keysPath}`);
}

generateKeys();
