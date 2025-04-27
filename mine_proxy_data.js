const COMPONENT_TYPE = {"minecraft:custom_data": 0,"minecraft:max_stack_size": 1,"minecraft:max_damage": 2,"minecraft:damage": 3,"minecraft:unbreakable": 4,"minecraft:custom_name": 5,"minecraft:item_name": 6,"minecraft:item_model": 7,"minecraft:lore": 8,"minecraft:rarity": 9,"minecraft:enchantments": 10,"minecraft:can_place_on": 11,"minecraft:can_break": 12,"minecraft:attribute_modifiers": 13,"minecraft:custom_model_data": 14,"minecraft:tooltip_display": 15,"minecraft:repair_cost": 16,"minecraft:creative_slot_lock": 17,"minecraft:enchantment_glint_override": 18,"minecraft:intangible_projectile": 19,"minecraft:food": 20,"minecraft:consumable": 21,"minecraft:use_remainder": 22,"minecraft:use_cooldown": 23,"minecraft:damage_resistant": 24,"minecraft:weapon": 26,"minecraft:enchantable": 27,"minecraft:equippable": 28,"minecraft:repairable": 29,"minecraft:glider": 30,"minecraft:tooltip_style": 31,"minecraft:death_protection": 32,"minecraft:blocks_attacks": 33,"minecraft:stored_enchantments": 34,"minecraft:dyed_color": 35,"minecraft:map_color": 36,"minecraft:map_id": 37,"minecraft:map_decorations": 38,"minecraft:map_post_processing": 39,"minecraft:charged_projectiles": 40,"minecraft:bundle_contents": 41,"minecraft:potion_contents": 42,"minecraft:potion_duration_scale": 43,"minecraft:suspicious_stew_effects": 44,"minecraft:writable_book_content": 45,"minecraft:written_book_content": 46,"minecraft:trim": 47,"minecraft:debug_stick_state": 48,"minecraft:entity_data": 49,"minecraft:bucket_entity_data": 50,"minecraft:block_entity_data": 51,"minecraft:instrument": 52,"minecraft:provides_trim_material": 53,"minecraft:ominous_bottle_amplifier": 54,"minecraft:jukebox_playable": 55,"minecraft:provides_banner_pattern": 56,"minecraft:recipes": 57,"minecraft:lodestone_tracker": 58,"minecraft:firework_explosion": 59,"minecraft:fireworks": 60,"minecraft:profile": 61,"minecraft:banner_patterns": 63,"minecraft:base_color": 64,"minecraft:pot_decorations": 65,"minecraft:block_state": 67,"minecraft:bees": 68,"minecraft:lock": 69,"minecraft:container_loot": 70,"minecraft:break_sound": 71}
function to_short(number) {
    if (!Number.isInteger(number) || number < -32768 || number > 32767) {
        throw new Error("Input must be an integer between -32768 and 32767.");
    }

    const buffer = new ArrayBuffer(2); // 2 bytes for a 16-bit short
    const view = new DataView(buffer);
    view.setInt16(0, number, false); // Use big-endian (network byte order)
    return buffer;
}
function to_byte(number) {
    if (!Number.isInteger(number) || number < -128 || number > 127) {
        throw new Error("Input must be an integer between -128 and 127.");
    }

    const buffer = new ArrayBuffer(1); // 1 byte for a byte
    const view = new DataView(buffer);
    view.setInt8(0, number); // Use big-endian (network byte order)
    return buffer;
}
function to_ubyte(number) {
    if (!Number.isInteger(number) || number < 0 || number > 255) {
        throw new Error("Input must be an integer between 0 and 255.");
    }

    const buffer = new ArrayBuffer(1); // 1 byte for an unsigned byte
    const view = new DataView(buffer);
    view.setUint8(0, number); // Use big-endian (network byte order)
    return buffer;
}

function to_ushort(number) {
    if (!Number.isInteger(number) || number < 0 || number > 65535) {
        throw new Error("Input must be an integer between 0 and 65535.");
    }

    const buffer = new ArrayBuffer(2); // 2 bytes for a 16-bit short
    const view = new DataView(buffer);
    view.setUint16(0, number, false); // Use big-endian (network byte order)
    return buffer;
}

function to_int(number) {
    const buffer = new ArrayBuffer(4); // 2 bytes for a 16-bit short
    const view = new DataView(buffer);
    view.setInt32(0, number, false); // Use big-endian (network byte order)
    return buffer;
}

function to_uint(number) {
    const buffer = new ArrayBuffer(4); // 2 bytes for a 16-bit short
    const view = new DataView(buffer);
    view.setUint32(0, number, false); // Use big-endian (network byte order)
    return buffer;
}

function to_long(number) {
    const buffer = new ArrayBuffer(8); // 8 bytes for a 64-bit long
    const view = new DataView(buffer);
    view.setBigInt64(0, BigInt(number), false); // Use big-endian (network byte order)
    return buffer;
}

function to_double(number) {
    const buffer = new ArrayBuffer(8)
    const view = new Float64Array(buffer)
    view[0] = number
    return buffer
}

function to_float(number) {
    const buffer = new ArrayBuffer(4)
    const view = new Float32Array(buffer)
    view[0] = number
    return buffer
}

function to_varint(number) {
    if (!Number.isInteger(number) || number < -2147483647 || number > 2147483647) {
        throw new Error("Input must be an integer between -2147483647 and 2147483647.");
    }

    const bytes = [];
    do {
        let temp = number & 0b01111111; // Get the lower 7 bits of the number
        number >>>= 7; // Logical right shift by 7
        if (number !== 0) {
            temp |= 0b10000000; // Set the continuation bit if more bytes follow
        }
        bytes.push(temp);
    } while (number !== 0);

    const buffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(buffer);
    view.set(bytes);
    return buffer;
}

function to_varlong(value) {
    // Ensure input is a BigInt.
    if (typeof value !== 'bigint') {
      throw new TypeError('The value must be a BigInt.');
    }
  
    const bytes = [];
  
    do {
      let byteVal = Number(value & 0x7Fn);
      value >>= 7n;
      if (value !== 0n) {
        byteVal |= 0x80;
      }
      bytes.push(byteVal);
    } while (value !== 0n);
    return new Uint8Array(bytes).buffer;
  }

function to_string(string) {
    if (!(typeof string === "string")) {
        throw new TypeError("to_string(string): string is not of type String")
    }
    const size = string.length
    return join_buffer(to_varint(size), convertTextToBinary(string).buffer)
}
function to_bytearray(bytes) {
    const size = (bytes.length || bytes.byteLength) || 0
    return join_buffer(to_varint(size), bytes)
}

function to_boolean(boolean) {
    if (!(typeof boolean === "boolean")) {
        throw new TypeError("to_boolean(boolean): boolean is not of type Boolean")
    }
    return new Uint8Array(boolean ? 1 : 0)
}
function to_position(x, y, z) {
    const blob = ((BigInt(x) & 0x3FFFFFFn) << 38n) | ((BigInt(z) & 0x3FFFFFFn) << 12n) | (BigInt(y) & 0xFFFn)
    const buffer = new ArrayBuffer(8)
    const view = new BigUint64Array(buffer)
    view[0] = blob
    return buffer
}

function join_buffer(...buffers) {
    // Calculate the total byte length of all buffers
    const totalLength = buffers.reduce((sum, buffer) => sum + (buffer ? buffer.length||buffer.byteLength : 0), 0);

    // Create a new ArrayBuffer with the combined length
    const resultBuffer = new ArrayBuffer(totalLength);
    const resultView = new Uint8Array(resultBuffer);

    // Copy each buffer into the result buffer
    let offset = 0;
    for (const buffer of buffers) {
        if (buffer == undefined) continue;
        const view = new Uint8Array(buffer);
        resultView.set(view, offset);
        offset += view.length;
    }

    return resultBuffer;
}

function buffer_to_base64(buffer) {
    let binary = String.fromCharCode(...buffer)
    return btoa(binary)
}

function pad_with(buffer, pad, length) {
    var buffer = buffer
    if (typeof buffer == "string") {
        buffer = convertTextToBinary(buffer)
    }
    const new_buf = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
        if (buffer[i]) {
            new_buf[i] = buffer[i]
        } else {
            new_buf[i] = pad
        }
    }
    return new_buf
}

function to_uuid(uuidstring) {
    if (typeof uuidstring !== 'string') {
        return uuidstring
    } else {
        const bytes = uuidstring.replace(/-/g, '').match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        const buffer = new ArrayBuffer(16);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < 16; i++) {
            view[i] = bytes[i] || 0; // Default to 0 if undefined
        }
        return buffer;
    }
}

class MineDataView {
    constructor(buffer) {
        this.buffer = new Uint8Array(buffer);
        this.view = new DataView(this.buffer.buffer);
        this.pointer = 0;
    }

    get_varint() {
        let value = 0;
        let position = 0;
        let currentByte;

        do {
            if (position >= 35) throw new Error("VarInt is too big");
            currentByte = this.buffer[this.pointer++];
            value |= (currentByte & 0x7F) << position;
            position += 7;
        } while (currentByte & 0x80);

        return value;
    }
    
    get_varlong() {
        let value = 0n;
        let position = 0;
        let currentByte;

        do {
            if (position >= 70) { // 70 bits is a reasonable cutoff for VarLong
                throw new Error("VarLong is too big");
            }
            currentByte = this.buffer[this.pointer++];
            value |= BigInt(currentByte & 0x7F) << BigInt(position);
            position += 7;
        } while (currentByte & 0x80);

        return value;
    }

    get_string() {
        const length = this.get_varint();
        return this.get_pstring(length);
    }

    get_pstring(length) {
        if (length < 0) {
            throw new Error("Length must be a non-negative integer.");
        }
        const stringBytes = this.buffer.slice(this.pointer, this.pointer + length);
        this.pointer += length;
        return convertBinaryToText(stringBytes);
    }

    get_uint() {
        const value = this.view.getUint32(this.pointer, false)
        this.pointer += 4;
        return value;
    }

    get_int() {
        const value = this.view.getInt32(this.pointer, false)
        this.pointer += 4;
        return value
    }

    get_short() {
        const value = this.view.getInt16(this.pointer, false);
        this.pointer += 2;
        return value;
    }

    get_ushort() {
        const value = this.view.getUint16(this.pointer, false);
        this.pointer += 2;
        return value;
    }

    get_float() {
        const value = this.view.getFloat32(this.pointer, false)
        this.pointer += 4;
        return value
    }

    get_double() {
        const value = this.view.getFloat64(this.pointer, false)
        this.pointer += 8;
        return value
    }

    get_long() {
        const value = this.view.getBigInt64(this.pointer, false);
        this.pointer += 8;
        return value;
    }

    get_ulong() {
        const value = this.view.getBigUint64(this.pointer, false);
        this.pointer += 8;
        return value;
    }

    get_rest() {
        return new Uint8Array(this.buffer.slice(this.pointer))
    }
    
    get_byte() {
        const value = this.view.getInt8(this.pointer, false)
        this.pointer += 1
        return value
    }

    get_boolean() {
        return this.get_byte() !== 0;
    }

    get_ubyte() {
        const value = this.view.getUint8(this.pointer, false)
        this.pointer += 1
        return value
    }

    get_bytes(length) {
        if (length < 0) {
            throw new Error("Length must be a non-negative integer.");
        }
        const bytes = this.buffer.slice(this.pointer, this.pointer + length);
        this.pointer += length;
        return bytes;
    }

    get_byte_array() {
        const length = this.get_varint();
        const array = this.buffer.slice(this.pointer, this.pointer + length);
        this.pointer += length;
        return array;
    }

    get_varint_array() {
        const length = this.get_varint();
        const array = new Array(length);
        for (let i = 0; i < length; i++) {
            array[i] = this.get_varint();
        }
        return array;
    }

    get_nbt() {
        if (!window.nbt) {
            throw new Error("nbt.js has not been imported (yet).")
        }
        const nbt = window.nbt.parse(this.get_rest())
        this.pointer += nbt.finalPosition
        delete nbt.finalPosition
        return nbt
    }

    get_position() {
        const val = this.get_long();
        return {
            x: Number(val >> 38n) & 0x3FFFFFF,
            y: Number(val & 0xFFFn),
            z: Number(val << 26n >> 38n) & 0x3FFFFFF
        }
    }

    get_command_node() {
        const node = {}

        const flags = this.get_byte()

        node.type = (["root", "literal", "argument"])[flags & 0x03]
        node.isExecutable = (flags & 0x04) !== 0;
        const hasRedirect = (flags & 0x08) !== 0;
        const hasSuggestionType = (flags & 0x10) !== 0;

        const childrenCount = this.get_varint();
        node.childrenIds = []
        for (let i = 0; i < childrenCount; i++) {
            node.childrenIds.push(this.get_varint())
        }

        if (hasRedirect) {
            node.redirectNode = this.get_varint();
        }
        if (node.type != "root") {
            node.name = this.get_string();
        }
        if (node.type == "argument") {
            var parserId = this.get_varint();
            node.parserId = parserId;
            switch(parserId) {
                case(1): { // brigadier:float
                    const flags = this.get_byte()
                    const hasMin = flags & 0x01
                    const hasMax = flags & 0x02
                    if (hasMin) {
                        node.min = this.get_float();
                    }
                    if (hasMax) {
                        node.max = this.get_float();
                    }
                    break;
                }
                case(2): { // brigadier:double
                    const flags = this.get_byte()
                    const hasMin = flags & 0x01
                    const hasMax = flags & 0x02
                    if (hasMin) {
                        node.min = this.get_double();
                    }
                    if (hasMax) {
                        node.max = this.get_double();
                    }
                    break;
                }
                case(3): { // brigadier:integer
                    const flags = this.get_byte()
                    const hasMin = flags & 0x01
                    const hasMax = flags & 0x02
                    if (hasMin) {
                        node.min = this.get_int();
                    }
                    if (hasMax) {
                        node.max = this.get_int();
                    }
                    break;
                }
                case(4): { // brigadier:long
                    const flags = this.get_byte()
                    const hasMin = flags & 0x01
                    const hasMax = flags & 0x02
                    if (hasMin) {
                        node.min = this.get_long();
                    }
                    if (hasMax) {
                        node.max = this.get_long();
                    }
                    break;
                }
                case(5): { // brigadier:string
                    const behavior = this.get_varint();
                    node.behavior = behavior
                    break;
                }
                case(6): { // minecraft:entity
                    const flags = this.get_byte()
                    const onlyOneEntity = (flags & 0x01) !== 0
                    const onlyPlayers = (flags & 0x02) !== 0

                    node.behavior = {
                        onlyOneEntity,
                        onlyPlayers
                    }
                    break;
                }
                case(30): { // minecraft:score_holder
                    const flags = this.get_byte()
                    const multipleEntities = (flags & 0x01) !== 0

                    node.behavior = {
                        onlyOneEntity: !multipleEntities
                    }
                    break;
                }
                case(41): { // minecraft:time
                    node.min = this.get_int()
                    break;
                }
                case(42): { // minecraft:resource_or_tag
                    node.suggestionSource = this.get_string()
                    break;
                }
                case(43): { // minecraft:resource_or_tag_key
                    node.suggestionSource = this.get_string()
                    break;
                }
                case(44): { // minecraft:resource
                    node.suggestionSource = this.get_string()
                    break;
                }
                case(45): { // minecraft:resource_key
                    node.suggestionSource = this.get_string()
                    break;
                }
                default: {

                }
            }
        }
        if (hasSuggestionType) {
            node.suggestionType = this.get_string()
        }
        return node
    }

    get_text_component() {
        const type = this.get_byte()
        if (type == 8) { // string
            const length = this.get_ushort()
            return convertBinaryToText(this.get_bytes(length))
        } else { // compound
            this.pointer -= 1
            return this.get_nbt()
        }
    }
}