class Packet {
    constructor(id, ...data) {
        this.id = id
        this.data = join_buffer(...data)
    }
    build() {
        return join_buffer(
            to_varint(this.data.length || this.data.byteLength),
            to_varint(this.id),
            this.data
        )
    }
    buildWithoutLength() {
        return join_buffer(
            to_varint(this.id),
            this.data
        )
    }
    get length() {
        return this.data.length || this.data.byteLength
    }
}
// STATUS: Handshake
class HandshakePacket extends Packet {
    constructor(protocolVersion, serverAddress, serverPort, nextState) {
        super(0x00, join_buffer(
            to_varint(protocolVersion),
            to_string(serverAddress),
            to_ushort(serverPort),
            to_varint(nextState)
        ))
        this.protocolVersion = protocolVersion;
        this.serverAddress = serverAddress;
        this.serverPort = serverPort;
        this.nextState = nextState;
    }
}
// STATUS: Status
class StatusResponseStatusPacket extends Packet {
    constructor(jsonResponse) {
        super(0x00, to_string(jsonResponse))
        this.jsonResponse = jsonResponse;
    }
}
class PongResponseStatusPacket extends Packet {
    constructor(timestamp) {
        super(0x01, to_long(timestamp));
        this.timestamp = timestamp;
    }
}
class StatusRequestStatusPacket extends Packet {
    constructor() {
        super(0x00, new ArrayBuffer())
    }
}
class PingRequestStatusPacket extends Packet {
    constructor(timestamp) {
        super(0x01, to_long(timestamp))
        this.timestamp = timestamp;
    }
}
// STATUS: Login
class DisconnectLoginPacket extends Packet {
    constructor(reason) {
        super(0x00, convertTextToBinary(reason))
        this.reason = reason
    }
}
class EncryptionRequestLoginPacket extends Packet {
    constructor(serverId, publicKey, verifyToken, shouldAuthenticate) {
        super(0x01, to_string(serverId), to_bytearray(publicKey), to_bytearray(verifyToken), to_boolean(shouldAuthenticate))
        this.serverId = serverId;
        this.publicKey = publicKey;
        this.verifyToken = verifyToken;
        this.shouldAuthenticate = shouldAuthenticate;
    }
}
class LoginSuccessLoginPacket extends Packet {
    constructor(uuid, username, skins) {
        super(0x02,
            to_uuid(uuid),
            to_string(username),
            to_varint(skins.length),
            join_buffer(
                ...(skins.map((item)=>{
                    return join_buffer(
                        to_string(item[0]),
                        to_string(item[1]),
                        to_boolean(item[2] != undefined),
                        item[2] != undefined ? to_string(item[2]) : undefined)
                }))
            )
        )
        this.uuid = uuid
        this.username = username
        this.skins = skins
    }
}
class SetCompressionLoginPacket extends Packet {
    constructor(threshold) {
        super(0x03, to_varint(threshold))
        this.threshold = threshold;
    }
}
class PluginRequestLoginPacket extends Packet {
    constructor(messageId, channel, content) {
        super(0x04, to_varint(messageId), to_string(channel), content)
        this.messageId = messageId;
        this.channel = channel;
        this.content = content;
    }
}
class CookieRequestLoginPacket extends Packet {
    constructor(key) {
        super(0x05, to_string(key))
        this.key = key
    }
}
class LoginStartLoginPacket extends Packet {
    constructor(username, uuid) {
        super(0x00, to_string(username), to_uuid(uuid))
        this.username = username;
        this.uuid = uuid;
    }
}
class EncryptionResponseLoginPacket extends Packet {
    constructor(sharedSecret, verifyToken) {
        super(0x01, to_bytearray(sharedSecret), to_bytearray(verifyToken))
        this.sharedSecret = sharedSecret;
        this.verifyToken = verifyToken;
    }
}
class LoginPluginResponseLoginPacket extends Packet {
    constructor(messageId, success, content) {
        super(0x02, to_varint(messageId), to_boolean(success), content || new ArrayBuffer())
        this.messageId = messageId;
        this.success = success;
        this.content = content;
    }
}
class LoginAcknowledgeLoginPacket extends Packet {
    constructor() {
        super(0x03, new ArrayBuffer())
        // This packet has no data
    }
}
class CookieResponseLoginPacket extends Packet {
    constructor(key, value) {
        super(0x04, to_string(key), to_bytearray(value || ""))
        this.key = key;
        this.value = value || ""; // Default to empty string if no value is provided
    }
}
// STATUS: Configuration
class CookieRequestConfigurationPacket extends Packet {
    constructor(key) {
        super(0x00, to_string(key))
        this.key = key
    }
}
class ConfigurationPluginMessageConfigurationPacket extends Packet {
    constructor(channel, content) {
        super(0x01, to_string(channel), content || new ArrayBuffer())
        this.channel = channel;
        this.content = content;
    }
}
class DisconnnectConfigurationPacket extends Packet {
    constructor(reason) {
        super(0x02, convertTextToBinary(reason || ""))
        this.reason = reason || ""; // Default to empty string if no reason is provided
    }
}
class FinishConfigurationPacket extends Packet {
    constructor() {
        super(0x03, new ArrayBuffer())
        // This packet has no data
    }
}
class ClientboundKeepAliveConfigurationPacket extends Packet {
    constructor(magicNumber) {
        super(0x04, to_long(magicNumber));
        this.magicNumber = magicNumber;
    }
}
class PingConfigurationPacket extends Packet {
    constructor(timestamp) {
        super(0x05, to_long(timestamp));
        this.timestamp = timestamp;
    }
}
class ResetChatConfigurationPacket extends Packet {
    constructor() {
        super(0x06, new ArrayBuffer())
        // This packet has no data
    }
}
class RegistryDataConfigurationPacket extends Packet {
    constructor(registryId, registries) {
        super(0x07, new ArrayBuffer());
        this.registries = registries;
        this.registryId = registryId;
    }
}
class RemoveResourcePackConfigurationPacket extends Packet {
    constructor(uuid) {
        super(0x08, to_uuid(uuid));
        this.uuid = uuid;
    }
}
class AddResourcePackConfigurationPacket extends Packet {
    constructor(uuid, url, hash, forced, promptMessage) {
        super(0x09, 
            to_uuid(uuid),
            to_string(url),
            to_bytearray(hash),
            to_boolean(forced || false), // Default to false if not provided
            to_string(promptMessage || "") // Handle optional prompt message
        );
        this.uuid = uuid;
        this.url = url;
        this.hash = hash;
        this.forced = forced || false; // Default to false if not provided
        this.promptMessage = promptMessage || ""; // Default to empty string if not provided
    }
}
class StoreCookieConfigurationPacket extends Packet {
    constructor(key, value) {
        super(0x0A, to_string(key), to_bytearray(value || "")); // Default to empty string if no value is provided
        this.key = key;
        this.value = value || ""; // Default to empty string if no value is provided
    }
}
class TransferConfigurationPacket extends Packet {
    constructor(serverAddress, serverPort) {
        super(0x0B, 
            to_string(serverAddress),
            to_varint(serverPort)
        );
        this.serverAddress = serverAddress;
        this.serverPort = serverPort;
    }
}
class FeatureFlagsConfigurationPacket extends Packet {
    constructor(flags) {
        const flagsBuffer = join_buffer(
            to_varint(flags.length),
            ...flags.map(flag => to_string(flag))
        );
        super(0x0C, flagsBuffer);
        this.flags = flags;
    }
}
class UpdateTagsConfigurationPacket extends Packet {
    constructor(tags) {
        super(0x0D);
        this.tags = tags;
    }
}
class ClientboundKnownPacksConfigurationPacket extends Packet {
    constructor(packs) {
        const packsBuffer = join_buffer(
            to_varint(packs.length),
            ...packs.map(pack => {
                return join_buffer(
                    to_string(pack.namespace),
                    to_string(pack.id),
                    to_string(pack.version)
                );
            })
        );
        super(0x0E, packsBuffer);
        this.packs = packs;
    }
}
class CustomReportDetailsConfigurationPacket extends Packet {
    constructor(details) {
        super(0x0F,
            to_varint(details.length), // Length of the details array
            ...details.map(detail => {
                return join_buffer(
                    to_string(detail.title), // Type of the detail
                    to_string(detail.description) // Message of the detail
                );
            })
        )
        this.details = details; // Store the details array for later use
    }
}
class ServerLinksConfigurationPacket extends Packet {
    /*
    0	Bug Report	Displayed on connection error screen; included as a comment in the disconnection report.
    1	Community Guidelines	
    2	Support	
    3	Status	
    4	Feedback	
    5	Community	
    6	Website	
    7	Forums	
    8	News	
    9	Announcements
    */
    constructor(links) {
        const linksBuffer = join_buffer(
            to_varint(links.length),
            ...links.map(link => {
                return join_buffer(
                    to_boolean(link.isBuiltin),
                    link.isBuiltin ? to_varint(link.id) : to_string(link.name), // Name of the link
                    to_string(link.url) // URL of the link
                );
            })
        );
        super(0x10, linksBuffer);
        this.links = links; // Store the links array for later use
    }
}
class ClientInformationConfigurationPacket extends Packet {
    constructor(locale, viewDistance, chatMode, chatColors, skinParts, mainHand, textFiltering, allowServerListings, particleStatus) {
        super(0x00,
            to_string(locale), // Locale of the client
            to_byte(viewDistance), // View distance setting
            to_varint(chatMode), // Chat mode setting
            to_boolean(chatColors), // Chat colors enabled/disabled
            to_ubyte(skinParts), // Skin parts as a byte array
            to_varint(mainHand), // Main hand preference (0 for left, 1 for right)
            to_boolean(textFiltering), // Text filtering enabled/disabled
            to_boolean(allowServerListings), // Allow server listings enabled/disabled
            to_varint(particleStatus) // Particle status enabled/disabled
        );
        this.locale = locale;
        this.viewDistance = viewDistance;
        this.chatMode = chatMode;
        this.chatColors = chatColors;
        this.skinParts = skinParts;
        this.mainHand = mainHand;
        this.textFiltering = textFiltering;
        this.allowServerListings = allowServerListings;
        this.particleStatus = particleStatus;
    }
}
class CookieResponseConfigurationPacket extends Packet {
    constructor(key, value) {
        super(0x01, to_string(key), to_bytearray(value || "")); // Default to empty string if no value is provided
        this.key = key;
        this.value = value || ""; // Default to empty string if no value is provided
    }
}
class ServerboundPluginMessageConfigurationPacket extends Packet {
    constructor(channel, content) {
        super(0x02, to_string(channel), content || new ArrayBuffer())
        this.channel = channel;
        this.content = content;
    }
}
class AcknowledgeConfigurationPacket extends Packet {
    constructor() {
        super(0x03, new ArrayBuffer())
        // This packet has no data
    }
}
class ServerboundKeepAliveConfigurationPacket extends Packet {
    constructor(magicNumber) {
        super(0x04, to_long(magicNumber));
        this.magicNumber = magicNumber;
    }
}
class PongConfigurationPacket extends Packet {
    constructor(timestamp) {
        super(0x05, to_long(timestamp));
        this.timestamp = timestamp;
    }
}
class ResourcePackResponseConfigurationPacket extends Packet {
    constructor(uuid, response) {
        super(0x06,
            to_uuid(uuid), // UUID of the resource pack
            to_varint(response) // Response code (0 for accepted, 1 for declined, 2 for failed)
        );
        this.uuidlo = uuid;
        this.response = response; // Store the response code for later use
    }
}
class ServerboundKnownPacksConfigurationPacket extends Packet {
    constructor(packs) {
        const packsBuffer = join_buffer(
            to_varint(packs.length),
            ...packs.map(pack => {
                return join_buffer(
                    to_string(pack.namespace),
                    to_string(pack.id),
                    to_string(pack.version)
                );
            })
        );
        super(0x07, packsBuffer);
        this.packs = packs; // Store the packs array for later use
    }
}
class KeepAliveConfigurationPacket extends Packet {
    constructor(magicNumber) {
        super(0x08, to_long(magicNumber));
        this.magicNumber = magicNumber;
    }
}
// STATE: Play
class LoginPlayPacket extends Packet {
    constructor(entityId, isHardcore, dimensionNames, maxPlayers, viewDistance, simulationDistance, reducedDebugInfo, 
                enableRespawnScreen, doLimitedCrafting, dimensionType, dimensionName, hashedSeed, gameMode, previousGameMode, 
                isDebug, isFlat, hasDeathLocation, deathDimensionName, deathLocation, portalCooldown, seaLevel, enforcesSecureChat) {
        super(0x2c,
            to_int(entityId),
            to_boolean(isHardcore),
            to_varint(dimensionNames.length),
            ...dimensionNames.map((dim)=>{ to_string(dim) }),
            to_varint(maxPlayers),
            to_varint(viewDistance),
            to_varint(simulationDistance),
            to_boolean(reducedDebugInfo),
            to_boolean(enableRespawnScreen),
            to_boolean(doLimitedCrafting),
            to_varint(dimensionType),
            to_string(dimensionName),
            to_long(hashedSeed),
            to_ubyte(gameMode),
            to_byte(previousGameMode),
            to_boolean(isDebug),
            to_boolean(isFlat),
            to_boolean(hasDeathLocation),
            hasDeathLocation ? to_string(deathDimensionName) : undefined,
            deathLocation ? to_string(deathLocation) : undefined,
            to_varint(portalCooldown),
            to_varint(seaLevel),
            to_boolean(enforcesSecureChat)
        );

        this.entityId = entityId;
        this.isHardcore = isHardcore;
        this.dimensionNames = dimensionNames;
        this.maxPlayers = maxPlayers;
        this.viewDistance = viewDistance;
        this.simulationDistance = simulationDistance;
        this.reducedDebugInfo = reducedDebugInfo;
        this.enableRespawnScreen = enableRespawnScreen;
        this.doLimitedCrafting = doLimitedCrafting;
        this.dimensionType = dimensionType;
        this.dimensionName = dimensionName;
        this.hashedSeed = hashedSeed;
        this.gameMode = gameMode;
        this.previousGameMode = previousGameMode;
        this.isDebug = isDebug;
        this.isFlat = isFlat;
        this.hasDeathLocation = hasDeathLocation;
        this.deathDimensionName = deathDimensionName;
        this.deathLocation = deathLocation;
        this.portalCooldown = portalCooldown;
        this.seaLevel = seaLevel;
        this.enforcesSecureChat = enforcesSecureChat;
    }
}
class SynchronizePlayerPositionPlayPacket extends Packet {
    constructor(teleportId, x, y, z, vx, vy, vz, yaw, pitch, flags) {
        super(0x42,
            to_varint(teleportId),
            to_double(x),
            to_double(y),
            to_double(z),
            to_double(vx),
            to_double(vy),
            to_double(vz),
            to_float(yaw),
            to_float(pitch),
            to_int(flags)
        )
        this.teleportId = teleportId;
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.yaw = yaw;
        this.pitch = pitch;
        this.flags = flags;
    }
}
class ConfirmTeleportationPlayPacket extends Packet {
    constructor(teleportId) {
        super(0x00,
            to_varint(teleportId)
        )
    }
}
class ChangeDifficultyPlayPacket extends Packet {
    constructor(difficulty, locked) {
        super(0x0b,
            to_byte(difficulty),
            to_boolean(locked)
        )
    }
}
class PlayerAbilitesPlayPacket extends Packet {
    constructor(flags, flyingSpeed, fovModifier) {
        super(0x3a,
            to_byte(flags),
            to_float(flyingSpeed),
            to_float(fovModifier)
        )
        this.flags = flags;
        this.flyingSpeed = flyingSpeed;
        this.fovModifier = fovModifier;
    }
}
class ClientboundSetHeldItemPlayPacket extends Packet {
    constructor(slot) {
        super(0x63, to_varint(slot))
        this.slot = slot
    }
}
class UpdateRecipesPlayPacket extends Packet {
    constructor(properties, stonecutterRecipes) {
        super(
            0x7e,
            to_varint(properties.length),
            ...properties.map(function(property){
                return join_buffer(
                    to_string(property.setId),
                    to_varint(property.value.length),
                    ...property.value.map(to_varint)
                )
            }),
            to_varint(stonecutterRecipes.length),
            ...stonecutterRecipes.map(function(recipe){
                return join_buffer(
                    to_varint(recipe.idType),
                    ...(recipe.idType == 0 
                    ? [to_string(recipe.name) ]
                    : recipe.ids.map(to_varint))
                )
            })
        )
    }
}
class EntityEventPlayPacket extends Packet {
    constructor(entityId, entityStatus) {
        super(0x1f,
            to_int(entityId),
            to_byte(entityStatus)
        )
        this.entityId = entityId;
        this.entityStatus = entityStatus;
    }
}
class CommandsPlayPacket extends Packet {
    constructor(nodes, startNode) {
        super(0x11)
        this.nodes = nodes
        this.startNode = startNode
    }
}
class RecipeBookSettingsPlayPacket extends Packet {
    constructor(
        craftingBookOpen, craftingBookFilterActive, smeltingBookOpen, 
        smeltingBookFilterActive, blastFurnaceBookOpen, blastFurnaceBookFilterActive, 
        smokerBookOpen, smokerBookFilterActive) {
        super(0x46,
            to_boolean(craftingBookOpen),
            to_boolean(craftingBookFilterActive),
            to_boolean(smeltingBookOpen),
            to_boolean(smeltingBookFilterActive),
            to_boolean(blastFurnaceBookOpen),
            to_boolean(blastFurnaceBookFilterActive),
            to_boolean(smokerBookOpen),
            to_boolean(smokerBookFilterActive)
        )
        this.craftingBookOpen = craftingBookOpen
        this.craftingBookFilterActive = craftingBookFilterActive
        this.smeltingBookOpen = smeltingBookOpen
        this.smeltingBookFilterActive = smeltingBookFilterActive
        this.blastFurnaceBookOpen = blastFurnaceBookOpen
        this.blastFurnaceBookFilterActive = blastFurnaceBookFilterActive
        this.smokerBookOpen = smokerBookOpen
        this.smokerBookFilterActive = smokerBookFilterActive
    }
}
class RecipeBookAddPlayPacket extends Packet {
    constructor(recipes, replace) {
        super(0x44)
    }
}
class ServerDataPlayPacket extends Packet {
    constructor(motd, icon) {
        super(0x50)
        this.motd = motd
        this.icon = icon
    }
}
class PlayerInfoUpdatePlayPacket extends Packet {
    constructor(players) {
        super(0x40)
        this.players = players
    }
}
class InitalizeWorldBorderPlayPacket extends Packet {
    constructor(x, z, oldDiamater, newDiamater, speed, portalTeleportBoundary, warningBlocks, warningTime) {
        super(0x26,
            to_double(x),
            to_double(z),
            to_double(oldDiamater),
            to_double(newDiamater),
            to_varlong(speed),
            to_varint(portalTeleportBoundary),
            to_varint(warningBlocks),
            to_varint(warningTime)
        )
        this.x = x
        this.z = z
        this.oldDiamater = oldDiamater
        this.newDiamater = newDiamater
        this.speed = speed
        this.portalTeleportBoundary = portalTeleportBoundary
        this.warningBlocks = warningBlocks
        this.warningTime = warningTime
    }
}
class UpdateTimePlayPacket extends Packet {
    constructor(worldAge, timeOfDay, timeOfDayIncreasing) {
        super(0x6b,
            to_long(worldAge),
            to_long(timeOfDay),
            to_boolean(timeOfDayIncreasing)
        )
        this.worldAge = worldAge
        this.timeOfDay = timeOfDay
        this.timeOfDayIncreasing = timeOfDayIncreasing
    }
}
class SetDefaultSpawnPositionPlayPacket extends Packet {
    constructor(x, y, z, angle) {
        super(0x5b,
            to_position(x, y, z),
            to_float(angle)
        )
        this.x = x
        this.y = y
        this.z = z
        this.angle = angle
    }
}
class GameEventPlayPacket extends Packet {
    constructor(event, value) {
        super(0x23,
            to_ubyte(event),
            to_float(value)
        )
        this.event = event
        this.value = value
    }
}
class SetTickingStatePlayPacket extends Packet {
    constructor(tickRate, frozen) {
        super(0x78,
            to_float(tickRate),
            to_boolean(frozen)
        )
        this.tickRate = tickRate
        this.frozen = frozen
    }
}
class StepTickPlayPacket extends Packet {
    constructor(ticks) {
        super(0x79,
            to_varint(ticks)
        )
        this.ticks = ticks
    }
}
class SetCenterChunkPlayPacket extends Packet {
    constructor(chunkX, chunkZ) {
        super(0x58,
            to_varint(chunkX),
            to_varint(chunkZ)
        )
        this.chunkX = chunkX
        this.chunkZ = chunkZ
    }
}
class BundleDelimiterPlayPacket extends Packet {
    constructor() {
        super(0x00)
    }
}
class SpawnEntityPlayPacket extends Packet {
    constructor(id, uuid, type, x, y, z, pitch, yaw, headYaw, data, vx, vy, vz) {
        super(0x01)
        this.id = id;
        this.uuid = uuid;
        this.type = type;
        this.x = x
        this.y = y
        this.z = z
        this.pitch = pitch
        this.yaw = yaw
        this.headYaw = headYaw
        this.data = data
        this.vx = vx
        this.vy = vy
        this.vz = vz
    }
}
class KeepAlivePlayPacket extends Packet {
    constructor(id) {
        super(0x1A, to_varint(id))
        this.id = id
    }
}