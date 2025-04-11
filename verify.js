async function main() {
    await libcurl.load_wasm(); // Load the WebAssembly module for libcurl
    libcurl.set_websocket(constants.WISP_URL); // Set the WebSocket URL for libcurl

    const loadingTitle = document.getElementById("loading-title");

    const input = document.getElementById("blank_url");
    const inputButton = document.getElementById("submit_blank_url");

    const verifier = new MinecraftVerifier();
    if (await verifier.getVerified(false)) {
        loadingTitle.textContent = "You are already verified! Redirecting...";
        setTimeout(() => {
            window.location.href = "./serverList.html"; // Redirect to play page
        }, 2000); // Wait for 2 seconds before redirecting
        return;
    }

    loadingTitle.innerHTML = `Open <a href="https://login.live.com/oauth20_authorize.srf?client_id=00000000402B5328&redirect_uri=https://login.live.com/oauth20_desktop.srf&response_type=code&scope=service::user.auth.xboxlive.com::MBI_SSL">this link</a> and log in. When you see a blank screen, copy the URL and bring it back here.`;
    await new Promise((resolve) => {
        inputButton.addEventListener("click", resolve, { once: true });
    })
    if (await verifier.aquireRefreshTokenFromURL(input.value.trim())) {
        loadingTitle.textContent = "Verification successful! Redirecting...";
        setTimeout(() => {
            window.location.href = "./serverList.html"; // Redirect to play page
        }, 1000); // Wait for 2 seconds before redirecting
    } else {
        loadingTitle.textContent = "Verification failed! Please try again.";
        setTimeout(() => {
            window.location.href = "./verify.html"; // Redirect to verify page
        }, 500); // Wait for 2 seconds before redirecting
    }
}
main()