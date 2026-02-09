const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function nanoid(length: number = 12): string {
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}
