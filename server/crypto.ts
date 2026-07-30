import crypto from 'node:crypto';

// Chiffrement réversible (AES-256-GCM) pour les secrets tiers (ex. clé API Inara) :
// contrairement aux mots de passe, le serveur doit pouvoir les relire pour appeler l'API externe.
// Clé dédiée (ENCRYPTION_KEY), distincte de JWT_SECRET, hachée en SHA-256 pour garantir 32 octets.
if (!process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY est absent des variables d'environnement (.env).");
}
const KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
const IV_LENGTH = 12; // recommandé pour GCM

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Format de payload chiffré invalide.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]).toString('utf8');
}
