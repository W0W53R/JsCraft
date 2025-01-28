async function checkVerification() {
    /**
     * Try using minecraft token
     * if pass:
     *  return true
     * if fail:
     *  try using refresh token
     *  if pass:
     *    reset minecraft token
     *    return true
     *  if fail:
     *    Direct user to ./verify.html
     */
    var mine_token = localStorage.getItem("jscraft.mc_token")
    const mine_token_return = await getAccountDetails(mine_token)
    console.log("Mine Token: ", mine_token)
    if (mine_token_return) {
        return true;
    } else {
        // Use refresh token
        var refresh_token = localStorage.getItem("jscraft.ms_refresh_token")
        const refresh_token_return = useRefreshToken(refresh_token)
        console.log("Microsoft Token: ", refresh_token_return)
        if (refresh_token_return) {
            // Reverify
            mine_token = useAccessToken(refresh_token_return)
            const mine_token_return = await getAccountDetails(mine_token)
            console.log("Minecraft Token: ", mine_token)
            if (mine_token_return) {
                return true;
            } else {
                const popover = document.createElement("div")
                popover.popover = ""
                popover.innerHTML = "<h1>Your verification expired! Refresh it <a href='./verify.html'>Here</a></h1>"
                document.body.appendChild(popover)
                popover.showPopover()
                return false;
            }
        } else {
            const popover = document.createElement("div")
            popover.popover = ""
            popover.innerHTML = "<h1>Your verification expired! Refresh it <a href='./verify.html'>Here</a></h1>"
            document.body.appendChild(popover)
            popover.showPopover()
            return false;
        }
    }
}


async function getAccountDetails(mine_token) {
    const mine_data = await libcurl.fetch("https://api.minecraftservices.com/minecraft/profile", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + mine_token,
            "Accept": "application/json"
        }
    })
    if (!mine_data.ok) {
        return false;
    }
    const mine_data_json = await mine_data.json();
    localStorage.setItem("jscraft.uuid", mine_data_json.id)
    localStorage.setItem("jscraft.username", mine_data_json.name)
    return mine_data_json
}


async function useRefreshToken(refresh_token) {
    const data = await libcurl.fetch("https://login.live.com/oauth20_token.srf", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        },
        body: urlEncode({
            "scope": "service::user.auth.xboxlive.com::MBI_SSL",
            "client_id": "00000000402B5328",
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        })
    });
    if (!data.ok) {
        return false;
    }
    const back = await data.json();
    const microsoft_access_token = back.access_token.toString();
    const microsoft_refresh_token = back.refresh_token;
    console.log("Access Token: ", microsoft_access_token);
    console.log("Refresh Token: ", microsoft_refresh_token);
    localStorage.setItem("jscraft.ms_refresh_token", microsoft_refresh_token);
    return microsoft_access_token;
}

async function useAccessToken(microsoft_access_token) {
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
    xsts_userhash = xsts_json.DisplayClaims.xui[0].uhs
    xsts_token = xsts_json.Token
    
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
    const mine_json = await mine_auth.json()
    const mine_token = mine_json.access_token
    localStorage.setItem("jscraft.mc_token", mine_token)
    return mine_token
}