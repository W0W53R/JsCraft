class MinecraftConnection {
    static STATE = {
        HANDSHAKE: 0,
        STATUS: 1,
        LOGIN: 2,
        CONFIGURATION: 3,
        PLAY: 4
    }
    constructor(wispConnection, url, port = 25565) {
        this._state = MinecraftConnection.STATE.HANDSHAKE
        this._packetBufferFromServer = new ArrayBuffer();
        this._packetBufferToServer = new ArrayBuffer();
        this._recievedPackets = [];
        this._packetPromises = [];
        this._connection = wispConnection;
        this._stream = this._connection.create_stream(url, port, "tcp")

        const _this = this;
        this._stream.addEventListener("message", function(event) {
            _this._onMessage(event.data);
        })
        this._stream.addEventListener("close", function(event) {
            console.error("Stream closed:", event);
            _this._packetPromises.forEach(p => p.reject(event));
            _this._packetPromises = [];
            _this._recievedPackets = [];
        })

        this.encryptedSend = false;
        this.encryptedRecieve = false;
        this._encryptorFromServer = undefined;
        this._encryptorToServer = undefined;
        this.compression_limit = -1;
        this.compression_set = false;
    }
    switchState(state) {
        this._state = state
    }
    close() {
        this._stream.close()
        this._packetPromises.forEach(p => p.reject("Connection closed"));
    }
    transfer(host, port) {
        this.close()

        this._stream = this._connection.create_stream(host, port, "tcp")

        this._stream.addEventListener("message", function(event) {
            _this._onMessage(event.data);
        })
        const _this = this;
        this._stream.addEventListener("close", function(event) {
            console.error("Stream closed:", event);
            _this._packetPromises.forEach(p => p.reject(event));
            _this._packetPromises = [];
            _this._recievedPackets = [];
        })

        this.encryptedSend = false;
        this.encryptedRecieve = false;
        this._encryptorFromServer = undefined;
        this._encryptorToServer = undefined;
        this.compression_limit = -1;
        this.compression_set = false;

        this._state = MinecraftConnection.STATE.HANDSHAKE
        this._packetBufferFromServer = new ArrayBuffer();
        this._packetBufferToServer = new ArrayBuffer();
        this._recievedPackets = [];
        this._packetPromises = [];
    }
    sendPacket(packet) {
        if (!Packet.prototype.isPrototypeOf(packet)) {
            throw new TypeError("MinecraftConnection.send(packet): packet does not extend Packet")
        }

        console.log("Sending Packet: ", packet)

        var packet = packet.buildWithoutLength();
        if (this.compression_limit > 0) {
            if (packet.length > this.compression_limit) {
                packet = join_buffer(
                    to_varint(packet.length),
                    pako.deflate(packet)
                )
            } else {
                packet = join_buffer(
                    to_varint(0),
                    packet
                )
            }
        }
        packet = join_buffer(
            to_varint(packet.length || packet.byteLength),
            packet
        )
        if (this.encryptedSend) {
            packet = this._encryptorToServer.encrypt(new Uint8Array(packet)).buffer;
        }
        this._packetBufferToServer = join_buffer(
            this._packetBufferToServer,
            packet
        )
        this.flushBuffer();
    }
    flushBuffer() {
        this._stream.send(new Uint8Array(this._packetBufferToServer))
        this._packetBufferToServer = new ArrayBuffer();
    }
    enableEncryption(cipherBytes) {
        this._encryptorFromServer = new aesjs.ModeOfOperation.cfb(cipherBytes, cipherBytes, 1 /* 1 bytes segment size */);
        this._encryptorToServer = new aesjs.ModeOfOperation.cfb(cipherBytes, cipherBytes, 1);
        this.encryptedRecieve = true;
    }
    enableEncryptionSend() {
        this.encryptedSend = true;
    }
    setCompressionLimit(limit) {
        if (typeof limit !== "number") {
            throw new TypeError("setCompressionLimit(limit): limit number");
        }
        this.compression_limit = limit;
        this.compression_set = true;
        console.log("Compression limit set to: ", limit);
    }
    _onMessage(data) {
        data = data.buffer;
        if (this.encryptedRecieve) {
            data = this._encryptorFromServer.decrypt(new Uint8Array(data)).buffer;
        }

        if (!(data instanceof ArrayBuffer)) {
            console.error("Received non-ArrayBuffer data from stream:", data);
            return;
        }
        this._packetBufferFromServer = join_buffer(this._packetBufferFromServer, data);

        while (this._packetBufferFromServer.byteLength > 0) {
            const reader = new MineDataView(this._packetBufferFromServer);
            const packetSize = reader.get_varint();
            const packetStart = reader.pointer;
            if (packetSize < 0 || packetSize > this._packetBufferFromServer.byteLength - 1) {
                break; // Not enough data for a full packet
            }
            var packetData = this._packetBufferFromServer.slice(0, packetSize + packetStart);
            // console.log("Checking packet compression")
            // if (this.compression_set) {
            //     const uncompressedSize = reader.get_varint(); // size of uncompressed data; 0 if not compressed
            //     if (uncompressedSize != 0) {
            //         const compressedData = new Uint8Array(packetData.slice(reader.pointer)); // Skip the packet size byte
            //         try {
            //             const decompressedData = pako.inflate(compressedData);
            //             packetData = decompressedData;
            //         } catch (e) {
            //             console.error("Failed to decompress packet:", e);
            //             break; // Exit if decompression fails
            //          }
            //     } else {
            //         packetData = new Uint8Array(packetData.slice(reader.pointer)); // Skip the packet size byte
            //     }
            // } else {
            //     
            // }
            packetData = new Uint8Array(packetData.slice(reader.pointer)); // Skip the packet size byte
            this._packetBufferFromServer = this._packetBufferFromServer.slice(packetSize + packetStart);
            if (this._packetPromises.length > 0) {
                const packetPromise = this._packetPromises.shift();
                packetPromise.resolve(this.#decompressPacketIfNeeded(packetData));
            } else {
                this._recievedPackets.push(packetData);
            }
        }
    }

    async getPacket() {
        if (this._recievedPackets.length > 0) {
            return this.#decompressPacketIfNeeded(this._recievedPackets.shift());
        } else {
            return new Promise((resolve, reject) => {
                this._packetPromises.push({ resolve, reject });
            });
        }
    }

    #decompressPacketIfNeeded(packetBuffer) {
        const reader = new MineDataView(packetBuffer);
        if (this.compression_set) {
            const uncompressedSize = reader.get_varint(); // size of uncompressed data; 0 if not compressed
            if (uncompressedSize != 0) {
                const compressedData = reader.get_rest();
                try {
                    const decompressedData = pako.inflate(compressedData);
                    return decompressedData;
                } catch (e) {
                    console.error("Failed to decompress packet:", e);
                    debugger
                    return null; // Exit if decompression fails
                }
            } else {
                return reader.get_rest();
            }
        } else {
            return reader.get_rest();
        }
    }
}