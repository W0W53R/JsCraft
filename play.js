const loadingTitle = document.getElementById("loading-title");
const searchParams = new URLSearchParams(window.location.search);
const host = searchParams.get("host");
const port = parseInt(searchParams.get("port") || "25565");
const instance = new MinecraftInstance({ host, port });

cookies = {}

registry = {}
tags = {}
recipe_book = []

entities = {}
playerId = null;

playerData = {
    inventory: [],
    position: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    velocity: { dx: 0, dy: 0, dz: 0 }
}

worldData = {}
worldChunks = {}

async function main() {
    await instance.start();

    instance.sendPacket(new HandshakePacket(769, host, port, 2)) // 2 = login 1 = status 3 = transfer

    instance.switchState(MinecraftConnection.STATE.LOGIN); // Switch to STATUS state

    instance.addHandler("disconnect", (packet) => {
        console.error("Disconnected from server: ", packet.params.reason);
        loadingTitle.innerText = "Disconnected from server: " + packet.params.reason;
    })

    instance.addHandler("encryption_begin", async (packet) => {
        loadingTitle.innerText = "Encrypting...";
        const { publicKey, verifyToken, shouldAuthenticate, serverId } = packet.params;
        const pemKey = "-----BEGIN PUBLIC KEY-----\n" +
                       buffer_to_base64(publicKey).replace(/(.{64})/g, "$&\n") + // Add newlines every 64 characters
                       "\n-----END PUBLIC KEY-----";

        const sharedSecret = new Uint8Array(16);
        crypto.getRandomValues(sharedSecret)

        const serverHash = await mcHexDigest(
            serverId,
            sharedSecret,
            publicKey,
        );

        if (shouldAuthenticate) {
            await instance.joinServer(serverHash);
        }

        const pki = forge.pki;
        const publickey = pki.publicKeyFromPem(pemKey)

        const encryptedSharedSecret = convertTextToBinary(publickey.encrypt(convertBinaryToText(sharedSecret)));
        const encryptedVerifyToken = convertTextToBinary(publickey.encrypt(convertBinaryToText(verifyToken)));

        if (encryptedSharedSecret.length !== 128 || encryptedVerifyToken.length !== 128) {
            console.error("Encryption failed: Encrypted data is not 128 bytes long.");
            return;
        }

        instance.connection.enableEncryption(sharedSecret);
        instance.connection.sendPacket(
            new EncryptionResponseLoginPacket(
                encryptedSharedSecret,
                encryptedVerifyToken
            )
        );
        
        instance.connection.enableEncryptionSend();
    })

    instance.addHandler("compress", (packet) => {
        const { threshold } = packet.params;
        instance.connection.setCompressionLimit(threshold);
    })

    instance.addHandler("store_cookie", (packet) => {
        const { cookie, value } = packet.params;
        console.log("Received cookie: ", cookie, value);
        cookies[cookie] = value;
    })

    instance.addHandler("transfer", (packet) => {
        const { host, port } = packet.params;
        console.log("Received transfer: ", host, port);
        instance.transfer(host, port);

        instance.sendPacket(new HandshakePacket(769, host, port, 2)) // 2 = login 1 = status 3 = transfer
    })


    var configurationResolve, configurationPromise = new Promise((resolve) => {configurationResolve = resolve})

    instance.addHandler("success", (packet) => {
        const { skins, username, uuid } = packet.params;
        console.log("Successfully logged in as: ", username, uuid, skins);

        loadingTitle.innerText = "Configuring...";
        instance.switchState(MinecraftConnection.STATE.CONFIGURATION); // Switch to PLAY state

        instance.sendPacket(
            new LoginAcknowledgeLoginPacket()
        )

        instance.sendPacket(
            new ServerboundPluginMessageConfigurationPacket("minecraft:brand", to_string("JSCraft"))
        )

        instance.sendPacket(
            new ClientInformationConfigurationPacket(
                "en_us",
                12,     
                0,      
                true,   
                0x7f,   
                1,      
                true,   
                true,   
                0       
            )
        )

        configurationResolve()
    })

    instance.sendPacket(new LoginStartLoginPacket(instance.accountDetails.name, instance.accountDetails.id))

    await configurationPromise;

    instance.addHandler("custom_payload", (packet) => {
        const { channel, data } = packet.params;
        if (channel === "minecraft:brand") {
            const reader = new MineDataView(data.buffer);
            console.log("Received brand: ", reader.get_string());
        } else {
            console.log("Received custom payload: ", channel, data);
        }
    })

    instance.addHandler("feature_flags", (packet) => {
        const { features } = packet.params;
        console.log("Received feature flags: ", features);
    })

    instance.addHandler("select_known_packs", (packet) => {
        const { packs } = packet.params;
        console.log("Received need-to-know packs: ", packs);

        instance.sendPacket(new ServerboundKnownPacksConfigurationPacket([]))
    })

    instance.addHandler("keep_alive", (packet) => {
        const { keepAliveId } = packet.params;
        console.log("Received keep-alive: ", keepAliveId);

        if (instance.state == MinecraftConnection.STATE.CONFIGURATION) {
            instance.sendPacket(new KeepAliveConfigurationPacket(keepAliveId));
        } else if (instance.state == MinecraftConnection.STATE.PLAY) {
            instance.sendPacket(new KeepAlivePlayPacket(keepAliveId));
        }
    })

    instance.addHandler("registry_data", (packet) => {
        const { id, entries } = packet.params;
        registry[id] = entries;
        console.log("Received registry data: ", id, entries);
    })

    instance.addHandler("tags", (packet) => {
        const recvTags = packet.params.tags;
        console.log("Received tags: ", recvTags);
        tags = recvTags;
    })

    var resolvePlay, promisePlay = new Promise((resolve) => {resolvePlay = resolve})

    instance.addHandler("finish_configuration", (packet) => {
        console.log("Configuration finished");
        loadingTitle.innerText = "Loading world...";

        instance.switchState(MinecraftConnection.STATE.PLAY); // Switch to PLAY state
        instance.sendPacket(
            new AcknowledgeConfigurationPacket()
        )

        resolvePlay()
    })

    await promisePlay;

    instance.addHandler("login", (packet) => {
        const { doLimitedCrafting, enableRespawnScreen, enforcesSecureChat, entityId, isHardcore, maxPlayers, reducedDebugInfo, simulationDistance, viewDistance, worldNames, worldState } = packet.params;
        playerId = entityId;
        console.log("Recieved login: ", doLimitedCrafting, enableRespawnScreen, enforcesSecureChat, entityId, isHardcore, maxPlayers, reducedDebugInfo, simulationDistance, viewDistance);
        registry["minecraft:worldnames"] = worldNames;
        playerData.dimension = worldState.name;
        playerData.gamemode = worldState.gamemode;
        worldData.hashedSeed = worldState.hashedSeed;
        worldData.isDebug = worldState.isDebug;
        worldData.isFlat = worldState.isFlat;
        worldData.seaLevel = worldState.seaLevel;
        playerData.prevGamemode = worldState.previousGamemode;
    })

    instance.addHandler("difficulty", (packet) => {
        const { difficulty, locked } = packet.params;
        console.log("Received difficulty: ", difficulty, locked);
    })

    instance.addHandler("abilities", (packet) => {
        const { flags, flyingSpeed, walkingSpeed } = packet.params;
        console.log("Received abilities: ", flags, flyingSpeed, walkingSpeed);
    })

    instance.addHandler("held_item_slot", (packet) => {
        const { slot } = packet.params;
        console.log("Received held item slot: ", slot);
    })

    instance.addHandler("declare_recipes", (packet) => {
        const { recipes } = packet.params;
        console.log("Received declare recipes: ", recipes);
    })

    instance.addHandler("entity_status", (packet) => {
        const { entityId, entityStatus } = packet.params;
        console.log("Received entity status: ", entityId, entityStatus);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].entityStatus = entityStatus;
    })

    instance.addHandler("declare_commands", (packet) => {
        const { nodes } = packet.params;
        console.log("Received declare commands: ", nodes);
    })

    instance.addHandler("recipe_book_settings", (packet) => {
        const { craftingGuiOpen, craftingFilteringCraftable, smeltingGuiOpen, smeltingFilteringCraftable, blastGuiOpen, blastFilteringCraftable, smokerGuiOpen, smokerFilteringCraftable } = packet.params;
        console.log("Received recipe book settings: ", craftingGuiOpen, craftingFilteringCraftable, smeltingGuiOpen, smeltingFilteringCraftable, blastGuiOpen, blastFilteringCraftable, smokerGuiOpen, smokerFilteringCraftable);
    })

    instance.addHandler("recipe_book_add", (packet) => {
        const { entries, replace } = packet.params;
        console.log("Received recipe book add: ", entries);
        if (replace) {
            recipe_book = entries;
        } else {
            recipe_book.push(...entries);
        }
    })

    instance.addHandler("position", (packet) => {
        var { x, y, z, dx, dy, dz, yaw, pitch, flags, teleportId } = packet.params;
        console.log("Received position: ", x, y, z, dx, dy, dz, yaw, pitch, flags, teleportId);
        entities[playerId] = entities[playerId] || {}
        if (flags.x) {
            x = entities[playerId].position.x + x;
        }
        if (flags.y) {
            y = entities[playerId].position.y + y;
        }
        if (flags.z) {
            z = entities[playerId].position.z + z;
        }
        if (flags.yaw) {
            yaw = entities[playerId].position.yaw + yaw;
        }
        if (flags.pitch) {
            pitch = entities[playerId].position.pitch + pitch;
        }
        entities[playerId].position = { x, y, z, yaw, pitch };
        entities[playerId].velocity = { dx, dy, dz };

        instance.sendPacket(
            new ConfirmTeleportationPlayPacket(teleportId)
        )
    })

    instance.addHandler("server_data", (packet) => {
        const { motd, iconBytes } = packet.params;
        console.log("Received server data: ", motd);
    })

    instance.addHandler("player_info", (packet) => {
        const { action, data } = packet.params;
        console.log("Received player info: ", action, data);
    })

    instance.addHandler("initialize_world_border", (packet) => {
        const { x, z, oldDiamater, newDiamater, portalTeleportBoundary, speed, warningBlocks, warningTime } = packet.params;
        console.log("Received initalize world border: ", x, z, oldDiamater, newDiamater, portalTeleportBoundary, speed, warningBlocks, warningTime);
    })

    instance.addHandler("update_time", (packet) => {
        const { age, time, tickDayTime } = packet.params;
        console.log("Received update time: ", age, time, tickDayTime);
    })

    instance.addHandler("spawn_position", (packet) => {
        const { location } = packet.params;
        console.log("Received spawn position: ", location);
    })

    instance.addHandler("game_state_change", (packet) => {
        const { reason, gameMode } = packet.params;
        console.log("Received game state change: ", reason, gameMode);
    })

    instance.addHandler("set_ticking_state", (packet) => {
        const { tick_rate, is_frozen } = packet.params;
        console.log("Received set ticking state: ", tick_rate, is_frozen);
    })

    instance.addHandler("step_tick", (packet) => {
        const { tick_steps } = packet.params;
        console.log("Received step tick: ", tick_steps);
    })

    instance.addHandler("update_view_position", (packet) => {
        const { chunkX, chunkZ } = packet.params;
        console.log("Received update view position: ", chunkX, chunkZ);
    })

    instance.addHandler("bundle_delimiter", (packet) => {
        console.log("Received bundle delimiter");
    })

    instance.addHandler("spawn_entity", (packet) => {
        const { entityId, x, y, z, velocityX, velocityY, velocityZ, yaw, pitch, type } = packet.params;
        console.log("Received spawn entity: ", entityId, x, y, z, velocityX, velocityY, velocityZ, yaw, pitch, type);
        entities[entityId] = { position: { x, y, z, yaw, pitch }, velocity: { dx: velocityX, dy: velocityY, dz: velocityZ }, type };
        playerData.position = { x, y, z, yaw, pitch };
        playerData.velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };
    })

    instance.addHandler("entity_metadata", (packet) => {
        const { entityId, metadata } = packet.params;
        console.log("Received entity metadata: ", entityId, metadata);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].metadata = metadata;

        if (entityId === playerId) {
            playerData.metadata = metadata;
        }
    })

    instance.addHandler("entity_velocity", (packet) => {
        const { entityId, velocityX, velocityY, velocityZ } = packet.params;
        console.log("Received entity velocity: ", entityId, velocityX, velocityY, velocityZ);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };
        if (entityId === playerId) {
            playerData.velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };
        }
    })

    instance.addHandler("entity_update_attributes", (packet) => {
        const { entityId, properties } = packet.params;
        console.log("Received entity update attributes: ", entityId, properties);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].attributes = entities[entityId].attributes || {};
        for (let property of properties) {
            entities[entityId].attributes[property.key] = { value: property.value, modifiers: property.modifiers };
        }
        if (entityId === playerId) {
            playerData.attributes = entities[entityId].attributes;
        }
    })

    instance.addHandler("window_items", (packet) => {
        const { windowId, items, stateId } = packet.params;
        console.log("Received window items: ", windowId, items);
        playerData.inventory[windowId] = items;
    })

    instance.addHandler("rel_entity_move", (packet) => {
        const { entityId, dX, dY, dZ, onGround } = packet.params;
        console.log("Received rel entity move: ", entityId, dX, dY, dZ, onGround);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].position = entities[entityId].position || {}
        for (let [pos, delta] of [["x", dX], ["y", dY], ["z", dZ]]) {
            entities[entityId].position[pos] = entities[entityId].position[pos] + delta;
        }
        entities[entityId].onGround = onGround;
        if (entityId === playerId) {
            playerData.position = entities[entityId].position;
            playerData.onGround = onGround;
        }
    })

    instance.addHandler("advancements", (packet) => {
        const { reset, advancementMapping, identifiers, progressMapping } = packet.params;
        console.log("Received advancements: ", reset, advancementMapping, identifiers, progressMapping);
        // playerData.advancements = playerData.advancements || {}
        // if (reset) {
        //     playerData.advancements = {};
        // }
        // for (let [advancement, progress] of Object.entries(progressMapping)) {
        //     playerData.advancements[advancement] = progress;
        // }
    })

    instance.addHandler("update_health", (packet) => {
        const { health, food, foodSaturation } = packet.params;
        console.log("Received update health: ", health, food, foodSaturation);
        playerData.health = health;
        playerData.food = food;
        playerData.saturation = foodSaturation;
    })

    instance.addHandler("experience", (packet) => {
        const { experienceBar, level, totalExperience } = packet.params;
        console.log("Received experience: ", experienceBar, level, totalExperience);
        playerData.experience = { experienceBar, level, totalExperience };
    })

    instance.addHandler("chunk_batch_start", (packet) => {
        console.log("Received chunk batch start");
    })

    instance.addHandler("chunk_batch_finish", (packet) => {
        console.log("Received chunk batch finish");
    })

    instance.addHandler("map_chunk", (packet) => {
        const { x, z, blockEntities, blockLight, blockLightMask, chunkData, emptyBlockLightMask, emptySkyLightMask, heightmaps, skyLight, skyLightMask } = packet.params;
        console.log("Received map chunk: ", x, z, blockEntities, blockLight, blockLightMask, chunkData, emptyBlockLightMask, emptySkyLightMask, heightmaps, skyLight, skyLightMask);
        
        
        worldChunks[x] = worldChunks[x] || []
        worldChunks[x][z] = { blockEntities, heightmaps };

        const dimensionHeight = registry["minecraft:dimension_type"].filter(e => e.key == playerData.dimension)[0].value.value.height.value;

        worldChunks[x][z].chunkData = parseChunkData(chunkData, dimensionHeight);
    })
}

main()