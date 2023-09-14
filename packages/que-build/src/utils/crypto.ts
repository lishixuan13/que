export const createStringHash = (string: string) => {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(string)
  return hasher.digest('hex')
}
