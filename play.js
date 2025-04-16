const loadingTitle = document.getElementById("loading-title");
const searchParams = new URLSearchParams(window.location.search);
const host = searchParams.get("host");
const port = parseInt(searchParams.get("port") || "25565");
const wispConnection = new WispConnection(constants.WISP_URL);

var registry = {}
var worldData = {}
var playerData = {}
var entities = {}

async function main() {
    await libcurl.load_wasm();
    libcurl.set_websocket(constants.WISP_URL);

    await new Promise((resolve, reject) => {
        wispConnection.addEventListener("open", resolve);
        wispConnection.addEventListener("error", reject);
    });

    const verifier = new MinecraftVerifier();
    if (!await verifier.getVerified()) {
        return;
    }

    const accountDetails = await verifier.getAccountDetails();

    console.log("Account details:", accountDetails);

    const connection = new MinecraftConnection(wispConnection, host, port);
    const wrapper = new PacketWrapper();

    connection.sendPacket(new HandshakePacket(769, host, port, 2)); // Protocol version 766 for 1.20.6

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
            "minecraft:brand",
            join_buffer(
                to_string("vanilla")
            )
        )
    )
    connection.sendPacket(
        new ClientInformationConfigurationPacket(
            "en_us", // Locale
            12,       // viewDistance
            0,       // chatMode
            true,    // chatColors
            0x7f,    // skinPart
            1,       // mainHand
            true,   // textFiltering
            true,    // allowServerListings
            0        // particleStatus
        ) 
    )

    var packet = wrapper.wrapPacket(await connection.getPacket())
    while (!(packet instanceof FinishConfigurationPacket)) {
        console.log("Recieved Packet: ", packet)
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

    connection.switchState(MinecraftConnection.STATE.PLAY)
    wrapper.switchState(MinecraftConnection.STATE.PLAY)

    const loginPlayPacket = wrapper.wrapPacket(await connection.getPacket())
    if (!loginPlayPacket instanceof LoginPlayPacket) {
        throw new Error("Expected to get the login play packet, but instead got: ", loginPlayPacket)
    }
    console.log("Login Play Packet:", loginPlayPacket)
    playerData.id = loginPlayPacket.entityId
    entities[playerData.id] = {
        name: "Player"
    }

    var packet = wrapper.wrapPacket(await connection.getPacket())
    while (true) {
        console.log("Recieved Packet: ", packet)
        if (packet instanceof SynchronizePlayerPositionPlayPacket) {
            connection.sendPacket(new ConfirmTeleportationPlayPacket(packet.teleportId))
        }
        if (packet instanceof PlayerAbilitesPlayPacket) {
            console.log("Abilites: ", packet)
        }
        if (packet instanceof ClientboundSetHeldItemPlayPacket) {
            console.log("Selected slot: ", packet.slot)
        }
        if (packet instanceof EntityEventPlayPacket) {
            console.log("Set entity data of", entities[packet.entityId].name, "to", packet.entityStatus)
            entities[packet.entityId].status = packet.entityStatus
        }
        if (packet instanceof CommandsPlayPacket) {
            console.log("Added command tree: ", packet)
        }
        if (packet instanceof RecipeBookSettingsPlayPacket) {
            console.log("Added recipe flags: ", packet)
        }
        if (packet instanceof RecipeBookAddPlayPacket) {
            console.log("Added Recipes", packet)
        }
        if (packet instanceof ServerDataPlayPacket) {
            console.log("Added server data: ", packet)
        }
        if (packet instanceof PlayerInfoUpdatePlayPacket) {
            console.log("Updated player list: ", packet)
        }

        packet = wrapper.wrapPacket(await connection.getPacket())
    }
}

main()