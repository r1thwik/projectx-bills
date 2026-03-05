const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;

    const domain = process.env.ZOHO_DOMAIN || '.in';
    const res = await axios.post(`https://accounts.zoho${domain}/oauth/v2/token`, null, {
        params: {
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token',
        },
    });

    if (res.data.error) throw new Error(`Zoho auth: ${res.data.error}`);

    cachedToken = res.data.access_token;
    tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return cachedToken;
}

module.exports = { getAccessToken };
