function parseChunkData(chunkData, dimensionHeight) {
    const reader = new MineDataView(chunkData.buffer);
    const arraySize = Math.floor(dimensionHeight / 16);

    const chunkSections = []
    const biomeSections = []

    for (let i = 0; i < arraySize; i++) {
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

            const numLongs = reader.get_varint();
            const chunkSection = [];
            for (let j = 0; j < numLongs; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(64 - bitIndex - bpe)) & ((1 << bpe) - 1);
                    chunkSection.push(mapping[value]);
                    bitIndex += bpe;
                }
            }
            chunkSection.length = 4096;
            chunkSections.push(chunkSection);
        } else if (bpe == 15) { // Direct
            const chunkSection = [];
            for (let j = 0; j < blockCount; j++) {
                const long = reader.get_ulong();
                var bitIndex = 0;
                while (bitIndex + bpe <= 64) {
                    const value = Number(long >> BigInt(64 - bitIndex - bpe)) & ((1 << bpe) - 1);
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
                    const value = Number(long >> BigInt(64 - bitIndex - bpe)) & ((1 << bpe) - 1);
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
                    const value = Number(long >> BigInt(64 - bitIndex - bpe)) & ((1 << bpe) - 1);
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