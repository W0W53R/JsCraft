function mcHexDigest(...data) {
    var hash = sha1.create();
    data.forEach((e)=>{
        console.log(e)
        if (typeof e == "string") {
            hash.update(e)
        } else {
            hash.update(new TextDecoder().decode(e))
        }
    })
    const hashBuffer = hash.arrayBuffer()
    
    const hashView = new DataView(hashBuffer);
    // Check for negative hashes
    let negative = hashView.getInt8(0) < 0;
    if (negative) {
      performTwosCompliment(hashBuffer);
    }
  
    let digest = hashBufferToHex(hashBuffer);
    // Trim leading zeroes
    digest = digest.replace(/^0+/g, '');
    if (negative) digest = '-' + digest;
  
    return digest;
}
  
  function performTwosCompliment(buffer) {
    let carry = true;
    for (let i = buffer.byteLength - 1; i >= 0; --i) {
      let value = new DataView(buffer).getUint8(i);
      let newByte = ~value & 0xff;
      if (carry) {
        carry = newByte === 0xff;
        new DataView(buffer).setUint8(i, newByte + 1);
      } else {
        new DataView(buffer).setUint8(i, newByte);
      }
    }
}
  
  function hashBufferToHex(buffer) {
    const byteArray = new Uint8Array(buffer);
    return Array.from(byteArray)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}