class World {
    static cubeNeighbors = [
        {
            pos: [-1, 0, 0],
            corners: [
                [0, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
                [0, 1, 1]
            ]
        },
        {
            pos: [1, 0, 0],
            corners: [
                [1, 0, 0],
                [1, 0, 1],
                [1, 1, 0],
                [1, 1, 1]
            ]
        },
        { // Verticals
            pos: [0, -1, 0],
            corners: [
                [0, 0, 0],
                [0, 0, 1],
                [1, 0, 0],
                [1, 0, 1]
            ]
        },
        {
            pos: [0, 1, 0],
            corners: [
                [0, 1, 0],
                [1, 1, 0],
                [0, 1, 1],
                [1, 1, 1]
            ]
        },
        {
            pos: [0, 0, -1],
            corners: [
                [0, 0, 0],
                [1, 0, 0],
                [0, 1, 0],
                [1, 1, 0]
            ]
        },
        {
            pos: [0, 0, 1],
            corners: [
                [0, 0, 1],
                [0, 1, 1],
                [1, 0, 1],
                [1, 1, 1]
            ]
        }
    ]
    constructor(dimensionHeight) {
        const _this = this;

        this.dimensionHeight = dimensionHeight;
        this.chunks = {}
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setAnimationLoop(function() {
            _this.render()
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 100;
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        this.controls.addEventListener("change", function() {
            _this.render()
        })
        
        // this.light = new THREE.DirectionalLight(0xffffff, 1);
        // this.light.position.set(1, 1, 1).normalize();
        // this.scene.add(this.light);

        this.lights = []
        this.lights.push(new THREE.DirectionalLight(0xffffff, 1)); // Soft white light
        this.lights[0].position.set(1, 1, 1).normalize();
        this.lights.push(new THREE.HemisphereLight(0xB1E1FF, 0x444444, 1)); // Ambient light
        for (let light of this.lights) {
            this.scene.add(light);
        }
    }

    addChunk(chunk) {
        this.chunks[chunk.pos.x] = this.chunks[chunk.pos.x] || {}
        this.chunks[chunk.pos.x][chunk.pos.z] = chunk;
        this.createChunkMesh(chunk); // Create mesh for ONLY this chunk
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    createChunkMesh(chunk) {
        var positions = []
        var normals = []
        // var uvs = []
        var namesToColors = new Map()
        namesToColors.set("bedrock", new THREE.Color(0.1, 0.1, 0.1));
        namesToColors.set("grass_block", new THREE.Color(0, 1, 0));
        namesToColors.set("dirt", new THREE.Color(0.5, 0.25, 0));
        namesToColors.set("water", new THREE.Color(0, 0, 0.9));
        namesToColors.set("sand", new THREE.Color(0.5, 0.5, 0));
        namesToColors.set("sandstone", new THREE.Color(0.4, 0.4, 0));
        namesToColors.set("stone", new THREE.Color(0.25, 0.25, 0.25));
        namesToColors.set("deepslate", new THREE.Color(0.15, 0.15, 0.15));
        namesToColors.set("andesite", new THREE.Color(0.7, 0.7, 0.7));
        namesToColors.set("diorite", new THREE.Color(1, 1, 1));
        namesToColors.set("granite", new THREE.Color(1, 0.7, 0.7));
        namesToColors.set("pink_terracotta", new THREE.Color(0, 0, 0));


        var colors = []
        var indicies = []

        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < this.dimensionHeight; y++) {
                for (let z = 0; z < 16; z++) {
                    const realX = chunk.pos.x * 16 + x;
                    const realY = y;
                    const realZ = chunk.pos.z * 16 + z;
                    const blockId = chunk.getBlockId(x, y, z);
                    const blockName = BlockRegistry.getById(blockId).name;
                    if (blockName == "air") {
                        continue;
                    }
                    for (let {pos, corners} of World.cubeNeighbors) {
                        let neighborId;
                        if (pos[0] + x < 0 || pos[0] + x >= 16 || pos[1] + y < 0 || pos[1] + y >= this.dimensionHeight || pos[2] + z < 0 || pos[2] + z >= 16) {
                            neighborId = 0; // assume air outside chunk
                        } else {
                            neighborId = chunk.getBlockId(x + pos[0], y + pos[1], z + pos[2]);
                        }

                        const neighborName = BlockRegistry.getById(neighborId).name;
                        if (neighborName == "air") {
                            const index = positions.length / 3;

                            for (let corner of corners) {
                                positions.push(x + corner[0], y + corner[1], z + corner[2]);
                                normals.push(pos[0], pos[1], pos[2]);

                                if (!namesToColors.has(blockName)) {
                                    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
                                    namesToColors.set(blockName, color);
                                }
                                const color = namesToColors.get(blockName);
                                colors.push(color.r, color.g, color.b);
                            }
                            
                            indicies.push(
                                index, index + 2, index + 1,
                                index + 1, index + 2, index + 3
                            );
                        }
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.MeshPhongMaterial( {
            side: THREE.DoubleSide,
            vertexColors: true
        } );
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        geometry.setIndex(indicies);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunk.pos.x * -16, 0, chunk.pos.z * 16);
        this.scene.add(mesh);
    }
}
