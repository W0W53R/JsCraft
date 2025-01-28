const proxy = new WispConnection("wss://wisp.mercurywork.shop/v86/")
var enabled = false
proxy.addEventListener("open", () => {
    enabled = true
});

class MinecraftConnection {
    constructor(ip, port=25565) {
        this.ip = ip;
        this.port = port;
        this.stream = proxy.create_stream(ip, port, "tcp");
        this.data_unproccessed = [];
        this.resolve_waiting = null;

        this.encrypted = false;
        this.compression_limit = -1;

        const _this = this;
        this.stream.addEventListener("message", function(event){
            if (_this.resolve_waiting) {
                _this.resolve_waiting(event.data);
                _this.resolve_waiting = null;
            } else {
                _this.data_unproccessed.push(event.data);
            }
        });
        this.stream.addEventListener("close", function(event){
            console.log("Stream closed for reason: " + event.code);
        });
        this.send_handshake(ip);
    }
    async send_handshake(ip) {
        this.send_raw(0x00, join_buffer(
            to_varint(769), // Version for minecraft 1.21(.5?)
            to_string(ip),
            to_ushort(this.port),
            to_varint(2) // Upgrade to play
        )); // Send handshake packet
        this.send_raw(0x00, join_buffer(
            to_string(localStorage.getItem("jscraft.username")),
            to_uuid(157912341, 598712632) // UUID (unused by server)
        )); // Send login packet
        var data = await this.get_packet();
        while (!(await this.handle_login_packet(data))) {
            data = await this.get_packet();
        }
    }
    async handle_login_packet(data) {
        var view = new MineDataView(data.data);
        var length = data.length
        var id = data.id
        if (id == 0x03) {
            console.log("Activating Compression")
            this.compression_limit = view.get_varint()
        } else if (id == 0x01) {
            this.encrypted = true
            const server_id = view.get_string()
            const public_key = view.get_byte_array()
            const verify_token = view.get_byte_array()
            const verify_with_mojang = view.get_byte()
            this.mineEncryptor = new MineEncryptor(server_id, public_key, verify_token, verify_with_mojang)
            console.log(this.mineEncryptor)
            const authenticated = await this.mineEncryptor.authenticate_mojang()
            console.log("Authenticated")
            const packet = this.mineEncryptor.signedPacket()
            console.log(packet)
            this.send_raw(0x01, packet)
        } else if (id == 0x02) {
            const uuidhi = view.get_long()
            const uuidlo = view.get_long()
            console.log(uuidhi, uuidlo)
            const username = view.get_string()
            console.log("UNAME",username)
            const elements = view.get_varint()
            var people = []
            for (let i = 0; i < elements; i++) {
                const name = view.get_string()
                const skin = view.get_string()
                const is_signature = view.get_byte()
                var signature;
                if (is_signature) {
                    signature = view.get_string()
                }
                people.push({
                    name: name,
                    skin: skin,
                    signature: signature
                })
            }
            console.log(people)
            // Send "Login Acknowledge Packet"
            this.send_raw(0x03, new ArrayBuffer(0))
            return true
        } else if (id == 0x00) { // Error Code
            const disconnect_reason = view.get_string()
            alert(disconnect_reason)
        } else {
            console.log("Unknown packet id during [LOGIN]: " + id)
        }
        return false
    }
    send_raw(protocol, data) {
        const pack_id = to_varint(protocol)
        const body = join_buffer(pack_id, data)
        const length = body.byteLength
        const packet = new Uint8Array(join_buffer(to_varint(length), body))
        if (this.compression_limit > 0) {
            const length = body.byteLength
            if (length >= this.compression_limit) {
                const compressed = pako.deflate(body)
                const compressed_length = compressed.byteLength
                if (compressed_length < length) {
                    packet = join_buffer(to_varint(compressed_length), compressed)
                }
            }
        }
        console.log("[SEND_PACKET]", packet)
        this.stream.send(packet)
    }
    get_raw() {
        if (this.data_unproccessed.length > 0) {
            return Promise.resolve(this.data_unproccessed.shift())
        }
        return new Promise((resolve, reject) => {
            this.resolve_waiting = resolve
        })
    }
    get_packet_from_raw(buffer) {
        const view = new MineDataView(buffer)
        const length = view.get_varint()
        const id = view.get_varint()
        return {
            length: length,
            id: id,
            data: view.get_rest()
        }
    }
    async get_packet() {
        const _this = this
        var data = new ArrayBuffer()
        while (!this.is_full_packet(data)) {
            data = join_buffer(data, await this.get_raw())
        }
        console.log('[GET_PACKET]', new Uint8Array(data))
        const packet = this.get_packet_from_raw(data)
        return packet
    }
    is_full_packet(data) {
        const view = new MineDataView(data)
        const length = view.get_varint()
        if (data.byteLength - view.pointer == length) {
            return true
        } else {
            return false
        }
    }
    close() {
        this.stream.close()
    }
}