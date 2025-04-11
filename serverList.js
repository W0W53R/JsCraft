const LOCAL_STORAGE_KEY = "minecraftServerList";
const wispConnection = new WispConnection(constants.WISP_URL);

function getSavedServers() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
}

function saveServers(list) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
}

function promptAddServer() {
    const host = prompt("Enter server host (e.g., lifesteal.net):");
    if (!host) return;

    const portInput = prompt("Enter server port (default 25565):");
    const port = parseInt(portInput) || 25565;

    const servers = getSavedServers();
    servers.push({ host, port });
    saveServers(servers);
    loadServerList();
}

let selectedServerIndex = null;

function deleteSelectedServer() {
    if (selectedServerIndex === null) {
        alert("Please select a server to delete.");
        return;
    }

    const servers = getSavedServers();
    servers.splice(selectedServerIndex, 1);
    saveServers(servers);
    selectedServerIndex = null;
    loadServerList();
}

function loadServerList() {
    const serverListContainer = document.getElementById("server-list");
    serverListContainer.innerHTML = "";

    const servers = getSavedServers();

    servers.forEach(async (server, index) => {
        const card = document.createElement("div");
        card.className = "server-card";
        card.innerHTML = `<p>Loading <strong>${server.host}</strong>...</p>`;
        card.onclick = () => {
            document.querySelectorAll(".server-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            selectedServerIndex = index;
        };
        serverListContainer.appendChild(card);

        fetchServerStatus(server.host, server.port, card);
    });
}

function joinSelectedServer() {
    if (selectedServerIndex === null) {
        alert("Please select a server to join.");
        return;
    }
    location = `play.html?host=${encodeURIComponent(getSavedServers()[selectedServerIndex].host)}&port=${getSavedServers()[selectedServerIndex].port}`;
}

async function fetchServerStatus(host, port, card) {
    try {
        await new Promise((resolve, reject) => {
            wispConnection.addEventListener("open", resolve);
            wispConnection.addEventListener("error", reject);
        });

        const connection = new MinecraftConnection(wispConnection, host, port);
        const wrapper = new PacketWrapper();
        connection.sendPacket(new HandshakePacket(770, host, port, 1));
        connection.switchState(MinecraftConnection.STATE.STATUS);
        wrapper.switchState(MinecraftConnection.STATE.STATUS);
        connection.sendPacket(new StatusRequestStatusPacket());

        const details = wrapper.wrapPacket(await connection.getPacket());
        const data = JSON.parse(details.jsonResponse);

        const start = Date.now();
        connection.sendPacket(new PingRequestStatusPacket(Date.now() % 2 ** 32));
        await connection.getPacket();
        const ping = Date.now() - start;

        console.log("Server details for", host, data, "Ping:", ping);

        card.innerHTML = `
            ${data.favicon ? `<img class="favicon" src="${data.favicon}" alt="Favicon">` : ''}
            <h2>${host}</h2>
            <p><strong>Players:</strong> ${data.players.online} / ${data.players.max}</p>
            <p><strong>Version:</strong> ${data.version.name}</p>
            <p><strong>Ping:</strong> ${ping} ms</p>
            <p class="status-ok">✅ Online</p>
        `;
    } catch (err) {
        console.error("Error for server:", host, err);
        card.innerHTML = `
            <h2>${host}</h2>
            <p class="status-error">❌ Failed to connect</p>
            <small>${err.message || err.toString()}</small>
        `;
    }
}

// Call it when the page loads
window.addEventListener("load", () => {
    loadServerList();
});
