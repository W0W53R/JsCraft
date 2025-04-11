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
    const blob = ((new BigInt(x) & 0x3FFFFFFn) << 38n) | ((new BigInt(z) & 0x3FFFFFFn) << 12n) | (new BigInt(y) & 0xFFFn)
    const buffer = new ArrayBuffer(8)
    const view = new BigUint64Array(buffer)
    view[0] = blob
    return buffer
}

function join_buffer(...buffers) {
    // Calculate the total byte length of all buffers
    const totalLength = buffers.reduce((sum, buffer) => sum + (buffer.length||buffer.byteLength), 0);

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

    get_string() {
        const length = this.get_varint();
        const stringBytes = this.buffer.slice(this.pointer, this.pointer + length);
        this.pointer += length;
        return convertBinaryToText(stringBytes);
    }

    get_short() {
        window.thisView = this.view
        const value = this.view.getInt16(this.pointer, false);
        this.pointer += 2;
        return value;
    }

    get_long() {
        const value = this.view.getBigInt64(this.pointer, false);
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

    get_nbt() {
        if (!window.nbt) {
            throw new Error("nbt.js has not been imported (yet).")
        }
        const nbt = nbt.parse(this.get_rest())
        this.pointer += nbt.finalPosition
        delete nbt.finalPosition
        return nbt
    }
}