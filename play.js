const loadingTitle = document.getElementById("loading-title");
const searchParams = new URLSearchParams(window.location.search);
const host = searchParams.get("host");
const port = parseInt(searchParams.get("port") || "25565");
const wispConnection = new WispConnection(constants.WISP_URL);

var registry = {}

async function main() {
    await libcurl.load_wasm();
    libcurl.set_websocket(constants.WISP_URL);

    await new Promise((resolve, reject) => {
        wispConnection.addEventListener("open", resolve);
        wispConnection.addEventListener("error", reject);
    });

    const verifier = new MinecraftVerifier();
    if (!verifier.getVerified()) {
        return;
    }

    const accountDetails = await verifier.getAccountDetails();

    console.log("Account details:", accountDetails);

    const connection = new MinecraftConnection(wispConnection, host, port);
    const wrapper = new PacketWrapper();

    connection.sendPacket(new HandshakePacket(770, host, port, 2)); // Protocol version 766 for 1.20.6

    connection.switchState(MinecraftConnection.STATE.LOGIN); // Switch to STATUS state
    wrapper.switchState(MinecraftConnection.STATE.LOGIN); // Ensure wrapper is in STATUS state

    connection.sendPacket(new LoginStartLoginPacket(accountDetails.name, accountDetails.id))

    var packet = wrapper.wrapPacket(await connection.getPacket());
    while (!(packet instanceof LoginSuccessLoginPacket)) {
        console.log("Received packet: ", packet);
        if (packet instanceof EncryptionRequestLoginPacket) {
            const pemKey = "-----BEGIN PUBLIC KEY-----\n" +
                buffer_to_base64(packet.publicKey).replace(/(.{64})/g, "$&\n") + // Add newlines every 64 characters
                "\n-----END PUBLIC KEY-----";


            const sharedSecret = new Uint8Array(16);
            crypto.getRandomValues(sharedSecret)

            const serverHash = await mcHexDigest(
                packet.serverId, // Ensure the UUID is lowercase
                sharedSecret,
                packet.publicKey, // The public key from the server
            );

            console.log("Server Hash: ", serverHash);

            if (packet.shouldAuthenticate) {
                await verifier.joinServer(accountDetails.id, serverHash);
            }

            const pki = forge.pki;
            const publickey = pki.publicKeyFromPem(pemKey)

            // encoder.encode(atob( ... ))
            const encryptedSharedSecret = convertTextToBinary(publickey.encrypt(convertBinaryToText(sharedSecret)));
            console.log("Verify Token: ", packet.verifyToken.buffer);
            const encryptedVerifyToken = convertTextToBinary(publickey.encrypt(convertBinaryToText(packet.verifyToken.buffer)));
            console.log("Encrypted Verify Token: ", encryptedVerifyToken.buffer);

            if (encryptedSharedSecret.length !== 128 || encryptedVerifyToken.length !== 128) {
                console.error("Encryption failed: Encrypted data is not 128 bytes long.");
                return;
            }

            connection.enableEncryption(sharedSecret);
            connection.sendPacket(
                new EncryptionResponseLoginPacket(
                    encryptedSharedSecret,
                    encryptedVerifyToken
                )
            );
            
            connection.enableEncryptionSend();
        }
        if (packet instanceof SetCompressionLoginPacket) {
            connection.setCompressionLimit(packet.threshold);
        }
        packet = wrapper.wrapPacket(await connection.getPacket());
    }
    // packet is now LoginSuccessLoginPacket
    console.log("Login successful:", packet);
    loadingTitle.textContent = "Loading world...";

    connection.sendPacket(
        new LoginAcknowledgeLoginPacket()
    )

    connection.switchState(MinecraftConnection.STATE.CONFIGURATION)
    wrapper.switchState(MinecraftConnection.STATE.CONFIGURATION)

    const random = new ArrayBuffer(4096)
    crypto.getRandomValues(new Uint8Array(random))

    connection.sendPacket(
        new ServerboundPluginMessageConfigurationPacket(
            "development:random",
            random
        )
    )
    connection.sendPacket(
        new ClientInformationConfigurationPacket(
            "en_US", // Locale
            5,       // viewDistance
            0,       // chatMode
            true,    // chatColors
            0x00,    // skinPart
            1,       // mainHand
            false,   // textFiltering
            true,    // allowServerListings
            0        // particleStatus
        ) 
    )

    var packet = wrapper.wrapPacket(await connection.getPacket())
    while (!(packet instanceof FinishConfigurationPacket)) {
        if (packet instanceof ConfigurationPluginMessageConfigurationPacket) {
            const channel = packet.channel
            const data = packet.data

            console.log(`${channel}:`, data)
        }
        if (packet instanceof FeatureFlagsConfigurationPacket) {
            const flags = packet.flags
            
            console.log("Flags: ", flags)
        }
        if (packet instanceof ClientboundKnownPacksConfigurationPacket) {
            const packs = packet.packs
            console.log("Server is asking if we know about these packs: ", packs)

            connection.sendPacket(new ServerboundKnownPacksConfigurationPacket([]))
        }
        if (packet instanceof RegistryDataConfigurationPacket) {
            const key = packet.registryId
            const values = packet.registries

            registry[key] = values
            console.log("Set registry", key, "to", values)
        }
        if (packet instanceof UpdateTagsConfigurationPacket) {
            const tags = packet.tags

            console.log("Tags:", tags)
        }

        packet = wrapper.wrapPacket(await connection.getPacket())
    }
    connection.sendPacket(new AcknowledgeConfigurationPacket())
}

main()