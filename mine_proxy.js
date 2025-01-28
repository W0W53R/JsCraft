const proxy = new WispConnection("wss://wisp.mercurywork.shop/")
var enabled = false
proxy.addEventListener("open", () => {
    enabled = true
});

class MinecraftConnection {
    constructor(ip, port=25565) {
        this.ip = ip
        this.port = port
        this.stream = proxy.create_stream(ip, port, "tcp")
        this.data_unproccessed = []
        this.resolve_waiting = null

        this.details = null
        this.resolve_details = null

        const _this = this
        this.stream.addEventListener("message", function(event){
            if (_this.resolve_waiting) {
                _this.resolve_waiting(event.data)
                _this.resolve_waiting = null
            } else {
                _this.data_unproccessed.push(event.data)
            }
        })
        this.stream.addEventListener("close", function(event){
            console.log("Stream closed for reason: " + event.code)
        })
        this.send_handshake_details(ip)
    }
    async send_handshake_details(ip) {
        this.send_raw(0x00, join_buffer(
            to_varint(769), // Version for minecraft 1.21(.5?)
            to_string(ip),
            to_ushort(this.port),
            to_varint(1) // Upgrade to status
        )) // Send handshake packet
        this.send_raw(0x00, new ArrayBuffer()) // Send status request
        var data = await this.get_packet()
        var view = new MineDataView(data.data)
        var data = view.get_string()
        this.details = JSON.parse(data)
        var time = Date.now()
        this.send_raw(0x01, to_long(1569)) // Ping packet
        var data = await this.get_packet()
        var ping = Date.now() - time
        this.details.ping = ping
        if (this.resolve_details) {
            this.resolve_details(this.details)
        }
    }
    get_details() {
        return new Promise((resolve, reject) => {
            if (this.details) {
                resolve(this.details)
            } else {
                this.resolve_details = resolve
            }
        })
    }
    send_raw(protocol, data) {
        const pack_id = to_varint(protocol)
        const body = join_buffer(pack_id, data)
        const length = body.byteLength
        const packet = new Uint8Array(join_buffer(to_varint(length), body))
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
        return this.get_packet_from_raw(data)
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