class MinecraftVerifier {
    static urlEncode(object) {
        let out = []
        Object.keys(object).forEach(function(key){
            const value = object[key]
            out.push(encodeURIComponent(key) + "=" + encodeURIComponent(value))
        })
        return out.join("&")
    }

    constructor() {
        
    }
    async getAccountDetails() {
        const mine_token = localStorage.getItem("jscraft.mc_token");
        if (!mine_token) {
            return null;
        }
        try {
            const response = await libcurl.fetch(`https://api.minecraftservices.com/minecraft/profile`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    'Authorization': `Bearer ${mine_token}`
                }
            });
            if (!response.ok) {
                throw new Error("Failed to fetch account details.");
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching account details:", error);
            return null;
        }
    }
    async getVerified(allowRedirect = true) {
        /*
           Try using minecraft token
           if pass:
            return true
           if fail:
            try using refresh token
            if pass:
              reset minecraft token
              return true
            if fail:
              Direct user to ./verify.html
         */
        const accountDetails = await this.getAccountDetails();
        if (accountDetails) {
            return true; // Successfully verified with Minecraft token
        } else {
            console.log("Minecraft token expired or invalid. Attempting to use refresh token.");
            // Use refresh token
            const refreshToken = localStorage.getItem("jscraft.ms_refresh_token");
            console.log("Refresh Token: ", refreshToken);
            if (!refreshToken) {
                console.log("No refresh token found. Redirecting to verification page.");
                if (allowRedirect) {
                    this.showVerificationExpired();
                }
                return false;
            }
            console.log("Using refresh token to get new access token.");
            const msToken = await this.useRefreshToken(refreshToken);
            console.log("Refresh Token: ", msToken);
            if (msToken) {
                // Get mc access token using the 
                const mcToken = await this.useAccessToken(msToken);
                if (!mcToken) {
                    console.log("Failed to get Minecraft access token. Redirecting to verification page.");
                    if (allowRedirect) {
                        this.showVerificationExpired();
                    }
                    return false;
                }
                console.log("Minecraft access token: ", mcToken);
                // Reset the Minecraft token in local storage
                localStorage.setItem("jscraft.mc_token", mcToken);
                const newAccountDetails = await this.getAccountDetails();
                if (newAccountDetails) {
                    return true;
                } else {
                    if (allowRedirect) {
                        this.showVerificationExpired();
                    }
                    return false;
                }
            } else {
                if (allowRedirect) {
                    this.showVerificationExpired();
                }
                return false;
            }
        }
    }
    async useAccessToken(microsoft_access_token) {
        const xbl_auth = await libcurl.fetch("https://user.auth.xboxlive.com/user/authenticate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": "user.auth.xboxlive.com",
                    "RpsTicket": microsoft_access_token
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT"
            })
        });
        if (!xbl_auth.ok) {
            alert("The protocol failed!")
            return;
        }
        const xbl_json = await xbl_auth.json()
        const xbl_token = xbl_json.Token
        
        const xsts_auth = await libcurl.fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [xbl_token]
                },
                "RelyingParty": "rp://api.minecraftservices.com/",
                "TokenType": "JWT"
            })
        });
        if (!xsts_auth.ok) {
            alert("The protocol failed!")
            return;
        }
        const xsts_json = await xsts_auth.json()
        const xsts_userhash = xsts_json.DisplayClaims.xui[0].uhs
        const xsts_token = xsts_json.Token
        
        const mine_auth = await libcurl.fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "identityToken": `XBL3.0 x=${xsts_userhash};${xsts_token}`
            })
        })
        if (!mine_auth.ok) {
            alert("The protocol failed!")
            return;
        }
        const mine_json = await mine_auth.json()
        const mine_token = mine_json.access_token
        console.log("Minecraft Access Token: ", mine_token)
        localStorage.setItem("jscraft.mc_token", mine_token)
        return mine_token
    }
    async useRefreshToken(refreshToken) {
        const data = await libcurl.fetch("https://login.live.com/oauth20_token.srf", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: MinecraftVerifier.urlEncode({
                "scope": "service::user.auth.xboxlive.com::MBI_SSL",
                "client_id": "00000000402B5328",
                "grant_type": "refresh_token",
                "refresh_token": refreshToken
            })
        });
        if (!data.ok) {
            return false;
        }
        const back = await data.json();
        const microsoftAccessToken = back.access_token.toString();
        const microsoftRefreshToken = back.refresh_token;
        console.log("Access Token: ", microsoftAccessToken);
        console.log("Refresh Token: ", microsoftRefreshToken);
        localStorage.setItem("jscraft.ms_refresh_token", microsoftRefreshToken);
        return microsoftAccessToken;
    }
    async aquireRefreshTokenFromURL(url) {
        const code = url.split("code=")[1].split("&")[0]; // Extract the code from the URL
        const microsoft_auth = await libcurl.fetch("https://login.live.com/oauth20_token.srf", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: MinecraftVerifier.urlEncode({
                "client_id": "00000000402B5328", // minecraft launcher
                "scope": "service::user.auth.xboxlive.com::MBI_SSL",
                "code": code,
                "redirect_uri": "https://login.live.com/oauth20_desktop.srf",
                "grant_type": "authorization_code"
            })
        })
        if (!microsoft_auth.ok) {
            return false;
        }
        const auth_json = await microsoft_auth.json()
        const microsoft_access_token = auth_json.access_token.toString()
        const microsoft_refresh_token = auth_json.refresh_token
        console.log("Access Token: ", microsoft_access_token)
        console.log("Refresh Token: ", microsoft_refresh_token)
        localStorage.setItem("jscraft.ms_refresh_token", microsoft_refresh_token)
        
        return true;
    }
    showVerificationExpired() {
        alert("Your verification has expired. Please re-verify your account.");
        window.location.href = "./verify.html"; // Redirect to the verification page
    }
    async joinServer(playerUUID, serverHash) {
        // If it works, the site will return 204 No Content, meaning the join was successful
        const response = await libcurl.fetch("https://sessionserver.mojang.com/session/minecraft/join", {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                accessToken: localStorage.getItem("jscraft.mc_token"),
                selectedProfile: playerUUID,
                serverId: serverHash
            })
        })
        if (!response.ok) {
            console.error("Failed to join server:", response.statusText);
            return false;
        }
        console.log("Successfully joined the server!");
        return true; // Successfully joined the server
    }
}