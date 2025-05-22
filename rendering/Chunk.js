class Chunk {
    constructor(x, z, chunkBytes, dimensionHeight) {
        const chunkData = parseChunkData(chunkBytes, dimensionHeight);
        this.height = dimensionHeight;
        this.chunkData = chunkData;
        this.chunkBytes = chunkBytes;
        this.pos = { x, z };
        this.blocks = this.#generateBlocksFromPackedArray(chunkData.chunkSections);
    }
    #generateBlocksFromPackedArray(chunkSections) {
        // Blocks are laid out in 4096 blocks per chunk sections, with an ordering of y, z, x
        // We need it to be in the order of x, y, z

        const blocks = []
        for (let x = 0; x < 16; x++) {
            blocks[x] = []
            for (let y = 0; y < this.height; y++) {
                blocks[x][y] = []
                for (let z = 0; z < 16; z++) {
                    const blockId = BlockRegistry.getByState(chunkSections[Math.floor(y / 16)][((y % 16) * 256) + ((z % 16) * 16) + (15-x)]).id
                    blocks[x][y].push(blockId)
                }
            }
        }
        return blocks
    }
    getBlockId(x, y, z) {
        return this.blocks[x][y][z]
    }
    toString() {
        return `Chunk(${this.pos.x}, ${this.pos.z})`;
    }
    getBlockNames() {
        const names = []
        for (let x = 0; x < 16; x++) {
            names.push([])
            for (let y = 0; y < this.height; y++) {
                names[x].push([])
                for (let z = 0; z < 16; z++) {
                    names[x][y][z] = BlockRegistry.getById(this.blocks[x][y][z]).name
                }
            }
        }
        return names
    }
}