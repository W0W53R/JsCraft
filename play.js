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

worldData = {}
world = undefined;
worldChunks = {}

resource_packs = {}

async function main() {
    const Player = await require("Player");

    var player;

    await instance.start();

    Logger.addBlockedLog("packet");
    Logger.addBlockedLog("packeterr");

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
        const { key, value } = packet.params;
        Logger.log("packet", "Received cookie: ", key, value);
        cookies[key] = value;
    })

    instance.addHandler("add_resource_pack", async (packet) => {
        const { forced, hash, promptMessage, url, uuid } = packet.params;
        Logger.log("packet", "Received resource pack: ", url, uuid);

        const pack = await libcurl.fetch(url);
        if (!pack.ok) {
            instance.sendPacket(new ResourcePackResponseConfigurationPacket(uuid, 2))
        }
        resource_packs[hash] = await pack.bytes();

        instance.sendPacket(new ResourcePackResponseConfigurationPacket(uuid, 0))
    })

    instance.addHandler("cookie_request", (packet) => {
        const { cookie } = packet.params;
        Logger.log("packet", "Server asked for this cookie:", cookie)
        instance.sendPacket(new CookieResponseLoginPacket(cookie, cookies[cookie]))
    })

    instance.addHandler("transfer", (packet) => {
        const { host, port } = packet.params;
        Logger.log("packet", "Received transfer: ", host, port);
        instance.transfer(host, port);

        instance.sendPacket(new HandshakePacket(769, host, port, 3)) // 2 = login 1 = status 3 = transfer
        instance.switchState(MinecraftConnection.STATE.LOGIN)
        instance.sendPacket(new LoginStartLoginPacket(instance.accountDetails.name, instance.accountDetails.id))
    })
    
    instance.addHandler("success", (packet) => {
        const { skins, username, uuid } = packet.params;
        Logger.log("packet", "Successfully logged in as: ", username, uuid, skins);

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
    })

    instance.sendPacket(new LoginStartLoginPacket(instance.accountDetails.name, instance.accountDetails.id))

    instance.addHandler("custom_payload", (packet) => {
        const { channel, data } = packet.params;
        if (channel === "minecraft:brand") {
            const reader = new MineDataView(data.buffer);
            Logger.log("packet", "Received brand: ", reader.get_string());
        } else {
            Logger.log("packet", "Received custom payload: ", channel, data);
        }
    })

    instance.addHandler("feature_flags", (packet) => {
        const { features } = packet.params;
        Logger.log("packet", "Received feature flags: ", features);
    })

    instance.addHandler("select_known_packs", (packet) => {
        const { packs } = packet.params;
        Logger.log("packet", "Received need-to-know packs: ", packs);

        instance.sendPacket(new ServerboundKnownPacksConfigurationPacket([]))
    })

    instance.addHandler("keep_alive", (packet) => {
        const { keepAliveId } = packet.params;
        Logger.log("packet", "Received keep-alive: ", keepAliveId);

        if (instance.state == MinecraftConnection.STATE.CONFIGURATION) {
            instance.sendPacket(new KeepAliveConfigurationPacket(keepAliveId));
        } else if (instance.state == MinecraftConnection.STATE.PLAY) {
            instance.sendPacket(new KeepAlivePlayPacket(keepAliveId));
        }
    })

    instance.addHandler("registry_data", (packet) => {
        const { id, entries } = packet.params;
        registry[id] = entries;
        Logger.log("packet", "Received registry data: ", id, entries);
    })

    instance.addHandler("tags", (packet) => {
        const recvTags = packet.params.tags;
        Logger.log("packet", "Received tags: ", recvTags);
        tags = recvTags;
    })

    instance.addHandler("finish_configuration", (packet) => {
        Logger.log("packet", "Configuration finished");
        loadingTitle.innerText = "Loading world...";

        instance.switchState(MinecraftConnection.STATE.PLAY); // Switch to PLAY state
        instance.sendPacket(
            new AcknowledgeConfigurationPacket()
        )
    })

    instance.addHandler("login", (packet) => {
        const { doLimitedCrafting, enableRespawnScreen, enforcesSecureChat, entityId, isHardcore, maxPlayers, reducedDebugInfo, simulationDistance, viewDistance, worldNames, worldState } = packet.params;
        playerId = entityId;
        Logger.log("packet", "Recieved login: ", doLimitedCrafting, enableRespawnScreen, enforcesSecureChat, entityId, isHardcore, maxPlayers, reducedDebugInfo, simulationDistance, viewDistance);
        registry["minecraft:worldnames"] = worldNames;

        world = new World(registry["minecraft:dimension_type"].filter(e => e.key == worldState.name)[0].value.value.height.value);

        player = new Player(world)

        loadingTitle.remove()

        player.dimension = worldState.name;
        player.gamemode = worldState.gamemode;
        worldData.hashedSeed = worldState.hashedSeed;
        worldData.isDebug = worldState.isDebug;
        worldData.isFlat = worldState.isFlat;
        worldData.seaLevel = worldState.seaLevel;
        player.prevGamemode = worldState.previousGamemode;
    })

    instance.addHandler("difficulty", (packet) => {
        const { difficulty, locked } = packet.params;
        Logger.log("packet", "Received difficulty: ", difficulty, locked);
    })

    instance.addHandler("abilities", (packet) => {
        const { flags, flyingSpeed, walkingSpeed } = packet.params;
        Logger.log("packet", "Received abilities: ", flags, flyingSpeed, walkingSpeed);
    })

    instance.addHandler("held_item_slot", (packet) => {
        const { slot } = packet.params;
        Logger.log("packet", "Received held item slot: ", slot);
    })

    instance.addHandler("declare_recipes", (packet) => {
        const { recipes } = packet.params;
        Logger.log("packet", "Received declare recipes: ", recipes);
    })

    instance.addHandler("entity_status", (packet) => {
        const { entityId, entityStatus } = packet.params;
        Logger.log("packet", "Received entity status: ", entityId, entityStatus);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].entityStatus = entityStatus;
    })

    instance.addHandler("declare_commands", (packet) => {
        const { nodes } = packet.params;
        Logger.log("packet", "Received declare commands: ", nodes);
    })

    instance.addHandler("recipe_book_settings", (packet) => {
        const { craftingGuiOpen, craftingFilteringCraftable, smeltingGuiOpen, smeltingFilteringCraftable, blastGuiOpen, blastFilteringCraftable, smokerGuiOpen, smokerFilteringCraftable } = packet.params;
        Logger.log("packet", "Received recipe book settings: ", craftingGuiOpen, craftingFilteringCraftable, smeltingGuiOpen, smeltingFilteringCraftable, blastGuiOpen, blastFilteringCraftable, smokerGuiOpen, smokerFilteringCraftable);
    })

    instance.addHandler("recipe_book_add", (packet) => {
        const { entries, replace } = packet.params;
        Logger.log("packet", "Received recipe book add: ", entries);
        if (replace) {
            recipe_book = entries;
        } else {
            recipe_book.push(...entries);
        }
    })

    instance.addHandler("position", (packet) => {
        var { x, y, z, dx, dy, dz, yaw, pitch, flags, teleportId } = packet.params;
        Logger.log("packet", "Received position: ", x, y, z, dx, dy, dz, yaw, pitch, flags, teleportId);
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
        Logger.log("packet", "Received server data: ", motd);
    })

    instance.addHandler("player_info", (packet) => {
        const { action, data } = packet.params;
        Logger.log("packet", "Received player info: ", action, data);
    })

    instance.addHandler("initialize_world_border", (packet) => {
        const { x, z, oldDiamater, newDiamater, portalTeleportBoundary, speed, warningBlocks, warningTime } = packet.params;
        Logger.log("packet", "Received initalize world border: ", x, z, oldDiamater, newDiamater, portalTeleportBoundary, speed, warningBlocks, warningTime);
    })

    instance.addHandler("update_time", (packet) => {
        const { age, time, tickDayTime } = packet.params;
        Logger.log("packet", "Received update time: ", age, time, tickDayTime);
    })

    instance.addHandler("spawn_position", (packet) => {
        const { location } = packet.params;
        Logger.log("packet", "Received spawn position: ", location);
    })

    instance.addHandler("game_state_change", (packet) => {
        const { reason, gameMode } = packet.params;
        Logger.log("packet", "Received game state change: ", reason, gameMode);
    })

    instance.addHandler("set_ticking_state", (packet) => {
        const { tick_rate, is_frozen } = packet.params;
        Logger.log("packet", "Received set ticking state: ", tick_rate, is_frozen);
    })

    instance.addHandler("step_tick", (packet) => {
        const { tick_steps } = packet.params;
        Logger.log("packet", "Received step tick: ", tick_steps);
    })

    instance.addHandler("update_view_position", (packet) => {
        const { chunkX, chunkZ } = packet.params;
        Logger.log("packet", "Received update view position: ", chunkX, chunkZ);
    })

    instance.addHandler("bundle_delimiter", (packet) => {
        Logger.log("packet", "Received bundle delimiter");
    })

    instance.addHandler("spawn_entity", (packet) => {
        const { entityId, x, y, z, velocityX, velocityY, velocityZ, yaw, pitch, type } = packet.params;
        Logger.log("packet", "Received spawn entity: ", entityId, x, y, z, velocityX, velocityY, velocityZ, yaw, pitch, type);
        entities[entityId] = { position: { x, y, z, yaw, pitch }, velocity: { dx: velocityX, dy: velocityY, dz: velocityZ }, type };
        player.position = { x, y, z, yaw, pitch };
        player.velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };

        world.camera.position.set(x, y, z);
    })

    instance.addHandler("entity_metadata", (packet) => {
        const { entityId, metadata } = packet.params;
        Logger.log("packet", "Received entity metadata: ", entityId, metadata);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].metadata = metadata;

        if (entityId === playerId) {
            player.metadata = metadata;
        }
    })

    instance.addHandler("entity_velocity", (packet) => {
        const { entityId, velocityX, velocityY, velocityZ } = packet.params;
        Logger.log("packet", "Received entity velocity: ", entityId, velocityX, velocityY, velocityZ);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };
        if (entityId === playerId) {
            player.velocity = { dx: velocityX, dy: velocityY, dz: velocityZ };
        }
    })

    instance.addHandler("entity_update_attributes", (packet) => {
        const { entityId, properties } = packet.params;
        Logger.log("packet", "Received entity update attributes: ", entityId, properties);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].attributes = entities[entityId].attributes || {};
        for (let property of properties) {
            entities[entityId].attributes[property.key] = { value: property.value, modifiers: property.modifiers };
        }
        if (entityId === playerId) {
            player.attributes = entities[entityId].attributes;
        }
    })

    instance.addHandler("window_items", (packet) => {
        const { windowId, items, stateId } = packet.params;
        Logger.log("packet", "Received window items: ", windowId, items);
        player.inventory[windowId] = items;
    })

    instance.addHandler("rel_entity_move", (packet) => {
        const { entityId, dX, dY, dZ, onGround } = packet.params;
        Logger.log("packet", "Received rel entity move: ", entityId, dX, dY, dZ, onGround);
        entities[entityId] = entities[entityId] || {}
        entities[entityId].position = entities[entityId].position || {}
        for (let [pos, delta] of [["x", dX], ["y", dY], ["z", dZ]]) {
            entities[entityId].position[pos] = entities[entityId].position[pos] + delta;
        }
        entities[entityId].onGround = onGround;
        if (entityId === playerId) {
            player.position = entities[entityId].position;
            player.onGround = onGround;
        }
    })

    instance.addHandler("advancements", (packet) => {
        const { reset, advancementMapping, identifiers, progressMapping } = packet.params;
        Logger.log("packet", "Received advancements: ", reset, advancementMapping, identifiers, progressMapping);
        // player.advancements = player.advancements || {}
        // if (reset) {
        //     player.advancements = {};
        // }
        // for (let [advancement, progress] of Object.entries(progressMapping)) {
        //     player.advancements[advancement] = progress;
        // }
    })

    instance.addHandler("update_health", (packet) => {
        const { health, food, foodSaturation } = packet.params;
        Logger.log("packet", "Received update health: ", health, food, foodSaturation);
        player.health = health;
        player.food = food;
        player.saturation = foodSaturation;
    })

    instance.addHandler("experience", (packet) => {
        const { experienceBar, level, totalExperience } = packet.params;
        Logger.log("packet", "Received experience: ", experienceBar, level, totalExperience);
        player.experience = { experienceBar, level, totalExperience };
    })

    instance.addHandler("chunk_batch_start", (packet) => {
        Logger.log("packet", "Received chunk batch start");
    })

    instance.addHandler("chunk_batch_finish", (packet) => {
        Logger.log("packet", "Received chunk batch finish");
    })

    instance.addHandler("map_chunk", (packet) => {
        const { x, z, blockEntities, blockLight, blockLightMask, chunkData, emptyBlockLightMask, emptySkyLightMask, heightmaps, skyLight, skyLightMask } = packet.params;
        Logger.log("packet", "Received map chunk: ", x, z, blockEntities, blockLight, blockLightMask, chunkData, emptyBlockLightMask, emptySkyLightMask, heightmaps, skyLight, skyLightMask);
        
        
        // worldChunks[x] = worldChunks[x] || {}
        // worldChunks[x][z] = { blockEntities, heightmaps };

        const dimensionHeight = registry["minecraft:dimension_type"].filter(e => e.key == player.dimension)[0].value.value.height.value;

        // worldChunks[x][z] = new Chunk(x, z, chunkData, dimensionHeight);
        world.addChunk(new Chunk(x, z, chunkData, dimensionHeight))
        world.render()
    })
}

main()