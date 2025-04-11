class PacketWrapper { // Only for Clientbound packets
    constructor() {
        this.state = MinecraftConnection.STATE.HANDSHAKE; // Default state
    }
    switchState(state) {
        if (Object.values(MinecraftConnection.STATE).includes(state)) {
            this.state = state;
        } else {
            throw new Error("Invalid state: " + state);
        }
    }
    wrapPacket(packet) {
        const reader = new MineDataView(packet);
        const id = reader.get_varint(); // Read the packet ID
        switch (this.state) {
            case MinecraftConnection.STATE.HANDSHAKE:
                throw new Error("No clientbound packets are sent in HANDSHAKE state. Please switch to a valid state before verbosifying packets.");
            case MinecraftConnection.STATE.STATUS:
                switch (id) {
                    case 0x00: // Status Response
                        return new StatusResponseStatusPacket(reader.get_string());
                    case 0x01: // Pong Response
                        return new PongResponseStatusPacket(reader.get_long());
                    default:
                        throw new Error("Unknown status packet ID: " + id);
                }
            case MinecraftConnection.STATE.LOGIN:
                switch (id) {
                    case 0x00: // Disconnect Packet
                        return new DisconnectLoginPacket(reader.get_string());
                    case 0x01: // Encryption Request Packet
                        return new EncryptionRequestLoginPacket(
                            reader.get_string(), // Server ID
                            reader.get_byte_array(), // Public Key
                            reader.get_byte_array(),  // Verify Token
                            reader.get_byte() != 0 // Should Authenticate
                        );
                    case 0x02: // Login Success Packet
                        const uuid = reader.get_bytes(16); // UUID
                        const username = reader.get_string(); // Username
                        const skinLength = reader.get_varint(); // Skin data length
                        var skinData = []
                        for (let i = 0; i < skinLength; i++) {
                            const thisSkin = []
                            thisSkin.push(reader.get_string()); // Name
                            thisSkin.push(reader.get_string()); // Value
                            if (reader.get_byte() !== 0) { // Has Signature
                                thisSkin.push(reader.get_string()); // Signature
                            }
                            skinData.push(thisSkin);
                        }
                        return new LoginSuccessLoginPacket(
                            uuid,
                            username, // Username
                            skinData // Skin data array
                        );
                    case 0x03: // Set Compression Packet
                        const threshold = reader.get_varint();
                        if (threshold < 0) {
                            throw new Error("Compression threshold must be non-negative, got: " + threshold);
                        }
                        return new SetCompressionLoginPacket(threshold);
                    case 0x04: // Plugin Request Packet
                        return new PluginRequestLoginPacket(
                            reader.get_varint(), // Channel ID
                            reader.get_string(), // Channel
                            reader.get_rest() // Data
                        );
                    case 0x05: // Cookie Request Packet
                        return new CookieRequestLoginPacket(
                            reader.get_string() // Cookie
                        );
                    default:
                        throw new Error("Unknown login packet ID: " + id);
                }
                case MinecraftConnection.STATE.CONFIGURATION:
                    switch (id) {
                        case 0x00: // Cookie Request
                            return new CookieRequestConfigurationPacket(reader.get_string());
                        case 0x01: // Plugin Message
                            return new ConfigurationPluginMessageConfigurationPacket(
                                reader.get_string(),
                                reader.get_rest()
                            );
                        case 0x02: // Disconnect
                            return new DisconnnectConfigurationPacket(reader.get_string());
                        case 0x03: // Finish Configuration
                            return new FinishConfigurationPacket();
                        case 0x04: // Keep Alive
                            return new ClientboundKeepAliveConfigurationPacket(reader.get_long());
                        case 0x05: // Ping
                            return new PingConfigurationPacket(reader.get_long());
                        case 0x06: // Reset Chat
                            return new ResetChatConfigurationPacket();
                        case 0x07: { // Registry Data
                            const registryId = reader.get_varint();
                            const registryCount = reader.get_varint();
                            const registries = [];
                            for (let i = 0; i < registryCount; i++) {
                                const name = reader.get_string();
                                const entryCount = reader.get_varint();
                                const entries = [];
                                for (let j = 0; j < entryCount; j++) {
                                    const entryName = reader.get_string();
                                    const hasData = reader.get_byte() !== 0;
                                    const data = hasData ? reader.get_nbt() : undefined
                                    entries[entryName] = data
                                }
                                registries.push({ name, entries });
                            }
                            return new RegistryDataConfigurationPacket(registryId, registries);
                        }
                        case 0x08: // Remove Resource Pack
                            return new RemoveResourcePackConfigurationPacket(reader.get_uuid());
                        case 0x09: // Add Resource Pack
                            return new AddResourcePackConfigurationPacket(
                                reader.get_uuid(),
                                reader.get_string(),
                                reader.get_byte_array(),
                                reader.get_byte() !== 0,
                                reader.get_string()
                            );
                        case 0x0A: // Store Cookie
                            return new StoreCookieConfigurationPacket(
                                reader.get_string(),
                                reader.get_byte_array()
                            );
                        case 0x0B: // Transfer
                            return new TransferConfigurationPacket(
                                reader.get_string(),
                                reader.get_varint()
                            );
                        case 0x0C: { // Feature Flags
                            const length = reader.get_varint();
                            const flags = [];
                            for (let i = 0; i < length; i++) {
                                flags.push(reader.get_string());
                            }
                            return new FeatureFlagsConfigurationPacket(flags);
                        }
                        case 0x0D: { // Update Tags
                            const tagCount = reader.get_varint();
                            const tags = [];
                            for (let i = 0; i < tagCount; i++) {
                                const name = reader.get_string();
                                const idCount = reader.get_varint();
                                const ids = [];
                                for (let j = 0; j < idCount; j++) {
                                    ids.push(reader.get_varint());
                                }
                                tags.push({ name, ids });
                            }
                            return new UpdateTagsConfigurationPacket(tags);
                        }
                        case 0x0E: { // Known Packs
                            const packCount = reader.get_varint();
                            const packs = [];
                            for (let i = 0; i < packCount; i++) {
                                packs.push({
                                    namespace: reader.get_string(),
                                    id: reader.get_string(),
                                    version: reader.get_string()
                                });
                            }
                            return new ClientboundKnownPacksConfigurationPacket(packs);
                        }
                        case 0x0F: { // Custom Report Details
                            const count = reader.get_varint();
                            const details = [];
                            for (let i = 0; i < count; i++) {
                                const title = reader.get_string();
                                const description = reader.get_string();
                                details.push({ title, description });
                            }
                            return new CustomReportDetailsConfigurationPacket(details);
                        }
                        case 0x10: { // Server Links
                            const count = reader.get_varint();
                            const links = [];
                            for (let i = 0; i < count; i++) {
                                const isBuiltin = reader.get_byte() !== 0;
                                const nameOrId = isBuiltin ? reader.get_varint() : reader.get_string();
                                const url = reader.get_string();
                                links.push({
                                    isBuiltin,
                                    id: isBuiltin ? nameOrId : undefined,
                                    name: !isBuiltin ? nameOrId : undefined,
                                    url
                                });
                            }
                            return new ServerLinksConfigurationPacket(links);
                        }
                        case 0x11: // Client Information
                            return new ClientInformationConfigurationPacket(
                                reader.get_string(),
                                reader.get_byte(),
                                reader.get_varint(),
                                reader.get_byte() !== 0,
                                reader.get_ubyte(),
                                reader.get_varint(),
                                reader.get_byte() !== 0,
                                reader.get_byte() !== 0,
                                reader.get_varint()
                            );
                        case 0x12: // Cookie Response
                            return new CookieResponseConfigurationPacket(
                                reader.get_string(),
                                reader.get_byte_array()
                            );
                        case 0x13: // Plugin Message
                            return new ServerboundPluginMessageConfigurationPacket(
                                reader.get_string(),
                                reader.get_rest()
                            );
                        case 0x14: // Acknowledge
                            return new AcknowledgeConfigurationPacket();
                        case 0x15: // Keep Alive (Serverbound)
                            return new ServerboundKeepAliveConfigurationPacket(reader.get_long());
                        case 0x16: // Pong
                            return new PongConfigurationPacket(reader.get_long());
                        case 0x17: // Resource Pack Response
                            return new ResourcePackResponseConfigurationPacket(
                                reader.get_uuid(),
                                reader.get_varint()
                            );
                        case 0x18: { // Known Packs (Serverbound)
                            const count = reader.get_varint();
                            const packs = [];
                            for (let i = 0; i < count; i++) {
                                packs.push({
                                    namespace: reader.get_string(),
                                    id: reader.get_string(),
                                    version: reader.get_string()
                                });
                            }
                            return new ServerboundKnownPacksConfigurationPacket(packs);
                        }
                        default:
                            throw new Error("Unknown configuration packet ID: " + id);
                    }                
            case MinecraftConnection.STATE.PLAY:
                switch (id) {
                    case(0x2c): {
                        return new LoginPlayPacket() // TODO:
                    }
                }
                break;
            default:
                throw new Error("Unknown state: " + this.state);
        }
    }
}