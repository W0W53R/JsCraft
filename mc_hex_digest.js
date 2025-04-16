function convertTextToBinary(string) {
  return Uint8Array.from(string, letter => letter.charCodeAt(0))
}
function convertBinaryToText(string) {
  return String.fromCharCode(...new Uint8Array(string));
}
/**
 * Generates a Minecraft verification hash.
 *
 * @param {string} serverId - The server id (as a UTF-8 string).
 * @param {Uint8Array} sharedSecret - The shared secret bytes.
 * @param {Uint8Array} publicKey - The public key bytes.
 * @returns {Promise<string>} The Minecraft-style hash as a hexadecimal string.
 */
async function mcHexDigest(serverId, sharedSecret, publicKey) {
  sharedSecret = new Uint8Array(sharedSecret); // Ensure sharedSecret is a Uint8Array
  publicKey = new Uint8Array(publicKey); // Ensure publicKey is a Uint8Array

  // Convert the serverId string to UTF-8 bytes.
  const serverIdBytes = convertTextToBinary(serverId);

  // Concatenate serverIdBytes, sharedSecret, and publicKey into one Uint8Array.
  const totalLength = serverIdBytes.length + sharedSecret.length + publicKey.length;
  const data = new Uint8Array(totalLength);
  data.set(serverIdBytes, 0);
  data.set(sharedSecret, serverIdBytes.length);
  data.set(publicKey, serverIdBytes.length + sharedSecret.length);

  // Compute the SHA-1 hash using SubtleCrypto.
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert the hash bytes into a BigInt.
  let num = BigInt(0);
  for (const byte of hashArray) {
    num = (num << BigInt(8)) + BigInt(byte);
  }

  // Check if the hash should be negative (if the most significant bit is set).
  const bitLength = BigInt(hashArray.length * 8);
  if (hashArray[0] & 0x80) {
    num = num - (BigInt(1) << bitLength);
  }

  // Convert the BigInt to a hexadecimal string.
  return num.toString(16);
}