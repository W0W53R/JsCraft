class MinecraftInstance {
    constructor(settings) {
        this.wispConnection = new WispConnection(constants.WISP_URL);
        this.settings = settings

        this.handlers = {}
    }
    async start() {
        await libcurl.load_wasm();
        libcurl.set_websocket(constants.WISP_URL);

        await new Promise((resolve, reject) => {
            this.wispConnection.addEventListener("open", resolve);
            this.wispConnection.addEventListener("error", reject);
        });

        const verifier = new MinecraftVerifier();
        if (!await verifier.getVerified()) {
            return;
        }
        this.accountDetails = await verifier.getAccountDetails();

        this.connection = new MinecraftConnection(this.wispConnection, this.settings.host, this.settings.port);
        this.wrapper = new PacketWrapper();

        this.$runMainLoop()
    }
    async $runMainLoop() {
        while (true) {
            packet = this.wrapper.wrapPacket(await this.connection.getPacket())

            var handled = false;
            for (const [packet, handlers] of Object.entries(this.handlers)) {
                if (packet.prototype.isPrototypeOf(packet)) {
                    handled = true;
                    for (const handler of handlers) {
                        handler(packet)
                    }
                }
            }
            if (!handled) {
                console.warn("Packet: ", packet, " not handled!")
            }

        }
    }
    switchState(state) {
        this.connection.switchState(state)
        this.wrapper.switchState(state)
    }
    addHandler(packet, handler) {
        this.handlers[packet] = this.handlers[packet] || []
        this.handlers[packet].push(handler)
    }
    removeHandler(packet, handler) {
        this.handlers[packet] = this.handlers[packet].filter((handlerToCheck) => handlerToCheck != handler)
    }
}