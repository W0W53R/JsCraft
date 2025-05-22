function parseChunkData(chunkData, dimensionHeight) {
    const reader = new MineDataView(chunkData.buffer);
    const arraySize = Math.floor(dimensionHeight / 16);

    const chunkSections = []
    const biomeSections = []

    for (let i = 0; i < arraySize; i++) {
        var start = reader.pointer;
        const blockCount = reader.get_short();

        var bpe = reader.get_ubyte();
        if (bpe == 0) { // Single Valued
            chunkSections.push(new Array(4096).fill(reader.get_varint()))
            
            const _length = reader.get_varint();
            if (_length != 0) {
                throw new Error("In bits per entry 0, length must be 0, but got: " + _length);
            }
        } else if (4 <= bpe && bpe <= 8) { // Indirect
            const mapping = reader.get_varint_array();
            if (Math.pow(2, bpe) < mapping.length) {
                throw new Error("Invalid bits per entry: " + bpe + " for mapping: " + mapping);
            }
            var fine = true;

            const numLongs = reader.get_varint();
            var chunkSection = [];
            for (let j = 0; j < numLongs; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                    if (mapping[value] == undefined) {
                        // Break on invalid mapping
                        if (fine) {
                            Logger.log("maperr", "Invalid mapping value: " + value + " for map: " + mapping + " for chunk section starting at: " + start);
                        }
                        fine = false;
                        chunkSection.push(10161); // Pink Terracotta for ease of sight
                        // chunkSection = new Array(4096).fill(10161);
                        bitIndex += bpe;
                        // break;
                        continue;
                    }
                    chunkSection.push(mapping[value]);
                    bitIndex += bpe;
                }
            }
            chunkSection.length = 4096;
            chunkSections.push(chunkSection);
            if (!fine) {
                Logger.log("maperr", "Region Bytes: ", chunkData.slice(start, reader.pointer));
            }
        } else if (bpe == 15) { // Direct
            const numLongs = reader.get_varint();
            const chunkSection = [];
            for (let j = 0; j < numLongs; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                    chunkSection.push(value);
                    bitIndex += bpe;
                }
            }
            chunkSection.length = 4096;
            chunkSections.push(chunkSection);
        } else {
            throw new Error("Invalid bits per entry: " + bpe);
        }

        // Biomes
        bpe = reader.get_ubyte()
        if (bpe == 0) { // Single Valued
            biomeSections.push(new Array(256).fill(reader.get_varint()))

            const _length = reader.get_varint();
            if (_length != 0) {
                throw new Error("In bits per entry 0, length must be 0, but got: " + _length);
            }
        } else if (1 <= bpe && bpe <= 3) { // Indirect
            const mapping = reader.get_varint_array(blockCount);

            const numLongs = reader.get_varint();
            const biomeSection = [];
            for (let j = 0; j < numLongs; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                    biomeSection.push(mapping[value]);
                    bitIndex += bpe;
                }
            }
            biomeSection.length = 256;
            biomeSections.push(biomeSection);
        } else if (bpe == 6) { // Direct
            const biomeSection = [];
            for (let j = 0; j < blockCount; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                    biomeSection.push(value);
                    bitIndex += bpe;
                }
            }
            biomeSection.length = 256;
            biomeSections.push(biomeSection);
        }
    }
    return { chunkSections, biomeSections };
}

class BitDataView extends MineDataView {
    constructor(buffer, byteOffset, byteLength) {
        super(buffer, byteOffset, byteLength);
        this.bitOffset = 0;
    }

    get_bit() {
        const byteIndex = Math.floor(this.bitOffset / 8);
        const bitIndex = this.bitOffset % 8;
        const byte = this.getUint8(byteIndex);
        const bit = (byte >> (7 - bitIndex)) & 1;
        this.bitOffset++;
        return bit;
    }

    get_bits(count) {
        let value = 0;
        for (let i = 0; i < count; i++) {
            value = (value << 1) | this.readBit();
        }
        return value;
    }
}

function debugParseChunkSection(bytes) {
    const reader = new MineDataView(bytes.buffer || bytes);

    var start = reader.pointer;
    const blockCount = reader.get_short();
    console.log("Block Count: ", blockCount);

    var bpe = reader.get_ubyte();
    console.log("Bits per entry: ", bpe);
    if (bpe == 0) { // Single Valued
        console.log("Single Valued");
        const value = reader.get_varint();
        console.log("Value: ", value);
        
        const _length = reader.get_varint();
        if (_length != 0) {
            console.log("In bits per entry 0, length must be 0, but got: " + _length);
            throw new Error("In bits per entry 0, length must be 0, but got: " + _length);
        }
    } else if (4 <= bpe && bpe <= 8) { // Indirect
        console.log("Indirect");
        const mapping = reader.get_varint_array();
        console.log("Mapping: ", mapping);
        if (Math.pow(2, bpe) < mapping.length) {
            console.log("Invalid bits per entry: " + bpe + " for mapping: " + mapping);
            throw new Error("Invalid bits per entry: " + bpe + " for mapping: " + mapping);
        }
        var fine = true;

        const numLongs = reader.get_varint();
        console.log("Num Longs: ", numLongs);
        for (let j = 0; j < numLongs; j++) {
            const long = reader.get_ulong();
            console.log("Long: ", long);
            var bitIndex = 0;
            while (bitIndex + bpe <= 64) {
                const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                console.log("\tValue: ", value);
                if (mapping[value] === undefined) {
                    debugger;
                }
                console.log("\tMapped Value: ", BlockRegistry.getByState(mapping[value]));
                if (mapping[value] == undefined) {
                    fine = false;
                    // chunkSection = new Array(4096).fill(10161);
                    bitIndex += bpe;
                    console.log("Invalid mapping value: " + value + " for map: " + mapping + " for chunk section starting at: " + start);
                    break;
                }
                bitIndex += bpe;
            }
        }
    } else if (bpe == 15) { // Direct
        console.log("Direct");
        const numLongs = reader.get_varint();
        console.log("Num Longs: ", numLongs);
        const chunkSection = [];
        for (let j = 0; j < numLongs; j++) {
            const long = reader.get_ulong();
            console.log("Long: ", long);
            var bitIndex = 0;
            while (bitIndex + bpe <= 64) {
                const value = Number(long >> BigInt(/*64 - */bitIndex/* - bpe*/) & BigInt((1 << bpe) - 1));
                chunkSection.push(value);
                console.log("\tValue: ", value);
                console.log("\tMapped Value: ", BlockRegistry.getByState(value));
                bitIndex += bpe;
            }
        }
    } else {
        throw new Error("Invalid bits per entry: " + bpe);
    }
}