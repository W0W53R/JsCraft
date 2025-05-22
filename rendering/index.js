(async function() {
    const toLoad = [
        "libraries/three.min.js",
        "libraries/three/addons/OrbitControls.js",
        "libraries/three/addons/BufferGeometryUtils.min.js",
        "BlockRegistry.js",
        "ChunkDataParser.js",
        "Chunk.js",
        "World.js"
    ]
    for (let i = 0; i < toLoad.length; i++) {
        const script = document.createElement("script");
        script.src = `./rendering/${toLoad[i]}`;
        script.type = "text/javascript";
        var resolve, promise = new Promise((res) => { resolve = res; });
        script.onload = () => {
            resolve();
        }
        if (toLoad[i].endsWith(".m.js")) {
            script.type = "module";
        }
        document.head.appendChild(script);
        await promise;
    }
})()