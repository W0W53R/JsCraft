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

        this.verifier = new MinecraftVerifier();
        if (!await this.verifier.getVerified()) {
            return;
        }
        this.accountDetails = await this.verifier.getAccountDetails();

        this.connection = new MinecraftConnection(this.wispConnection, this.settings.host, this.settings.port);
        this.wrapper = new AutoPacketWrapper();

        this.#runMainLoop()
    }
    async transfer(host, port) {
        this.connection.transfer(host, port)

        this.#runMainLoop()
    }
    async #runMainLoop() {
        while (true) {
            const packet = await this.connection.getPacket()
            console.log("Received packet: ", packet)
            var testPacket = await this.wrapper.readPacket(packet)

            console.log("Received packet: ", testPacket);

            var handled = false;
            for (const [packet, handlers] of Object.entries(this.handlers)) {
                if (testPacket.name == packet) {
                    handled = true;
                    for (const handler of handlers) {
                        handler(testPacket)
                    }
                }
            }
            if (!handled) {
                console.warn("Packet: ", testPacket, " not handled!")
            }

        }
    }
    sendPacket(packet) {
        this.connection.sendPacket(packet)
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
    joinServer(hash) {
        return this.verifier.joinServer(this.accountDetails.id, hash)
    }
}