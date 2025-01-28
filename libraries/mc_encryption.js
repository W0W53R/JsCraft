class MineEncryptor {
    constructor(server_id, public_key, verify_token, authenticate) {
        this.server_id = server_id
        this.verify_token = verify_token
        this.authenticate = authenticate
        this.public_key = public_key
        
        // Create Shared Key
        this.shared_key = new Uint8Array(16)
        crypto.getRandomValues(this.shared_key)
        
        // Extract public_key from data
        this.pem = `-----BEGIN PUBLIC KEY-----\n${buffer_to_base64(this.public_key).match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;

        
        this.in_cipher  = new Array(...new Uint8Array(this.shared_key))
        this.out_cipher = new Array(...new Uint8Array(this.shared_key))
    }
    async authenticate_mojang() {
        console.log("Authenticating")
        if (!this.authenticate) return;
        var serverHash = mcHexDigest(this.server_id, this.shared_key, this.public_key)
        const auth_response = await libcurl.fetch("https://sessionserver.mojang.com/session/minecraft/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "accessToken": localStorage.getItem("jscraft.mc_token"),
                "selectedProfile": localStorage.getItem("jscraft.uuid"),
                "serverId": serverHash
            })
        })
        if (!auth_response.ok) {
            alert("Authorization failed!")
            return false
        }
        return true
    }
    signedPacket() {
        console.log("Sending Signed Packet");
    
        // Create JSEncrypt instance
        const encrypt1 = new JSEncrypt({ default_key_size: 1024 });
        encrypt1.setKey(this.pem);
        const encrypt2 = new JSEncrypt({ default_key_size: 1024 });
        encrypt2.setKey(this.pem);
        console.log(this.pem)
    
        // Encrypt shared key and verify token
        const sharedKeyStr = new TextDecoder().decode(this.shared_key);
        const encryptedSharedKey = encrypt1.encrypt(sharedKeyStr);
        if (!encryptedSharedKey) throw new Error("Failed to encrypt shared key.");
        
        const verifyTokenStr = new TextDecoder().decode(this.verify_token);
        const encryptedVerifyToken = encrypt2.encrypt(verifyTokenStr);
        if (!encryptedVerifyToken) throw new Error("Failed to encrypt verify token.");
        

        // Convert encrypted results to byte arrays
        const encryptedSharedKeyBytes = Uint8Array.from(atob(encryptedSharedKey), c => c.charCodeAt(0));
        const encryptedVerifyTokenBytes = Uint8Array.from(atob(encryptedVerifyToken), c => c.charCodeAt(0));
    
        // Construct the signed packet
        const sharedKeyLength = to_varint(encryptedSharedKeyBytes.length);
        const verifyTokenLength = to_varint(encryptedVerifyTokenBytes.length);
    
        return join_buffer(
            sharedKeyLength,
            encryptedSharedKeyBytes,
            verifyTokenLength,
            encryptedVerifyTokenBytes
        );
    }
    encrypt(data) {
        const length = data.length||data.byteLength
        var data_in = new Uint8Array(data)
        var data_out = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            var item = data_in[i]
            var key = this.out_cipher.shift()
            var encrypted = item ^ key
            this.out_cipher.push(encrypted)
            data_out[i] = encrypted
        }
        return data_out
    }
    decrypt(data) {
        const length = data.length||data.byteLength
        var data_in = new Uint8Array(data)
        var data_out = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            var item = data_in[i]
            var key = this.in_cipher.shift()
            var encrypted = item ^ key
            this.in_cipher.push(encrypted)
            data_out[i] = encrypted
        }
        return data_out
    }
}