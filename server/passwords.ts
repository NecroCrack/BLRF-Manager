import crypto from 'node:crypto';

// Mot de passe fort généré côté serveur : jamais choisi par un humain, jamais stocké en clair.
// Charset sans caractères ambigus (0/O, 1/l/I) pour faciliter la transcription manuelle.
export function generateStrongPassword(length = 16): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[crypto.randomInt(charset.length)];
  }
  return password;
}
