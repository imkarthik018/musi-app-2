const CLIENT_ID = '5061bee8e0a84d35a3aef36dc488de31'; // Replace with your Spotify Client ID
const REDIRECT_URI = 'http://127.0.0.1:5500/callback.html'; // Replace with your redirect URI

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const RESPONSE_TYPE = 'code';
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-library-modify',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'app-remote-control',
    'streaming',
    'user-top-read',
    'user-read-recently-played'
];

// PKCE functions
function generateCodeVerifier(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

const spotifyAuth = {
    login: async () => {
        const codeVerifier = generateCodeVerifier(128);
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        localStorage.setItem('code_verifier', codeVerifier);

        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES.join('%20')}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
        window.location.href = authUrl;
    },

    handleCallback: async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const codeVerifier = localStorage.getItem('code_verifier');

        if (code && codeVerifier) {
            try {
                const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: REDIRECT_URI,
                        client_id: CLIENT_ID, // Include client_id for PKCE
                        code_verifier: codeVerifier
                    })
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    throw new Error(`HTTP error! status: ${tokenResponse.status}, response: ${errorText}`);
                }

                const data = await tokenResponse.json();
                spotifyAuth.saveTokens(data.access_token, data.refresh_token, data.expires_in);
                localStorage.removeItem('code_verifier'); // Clean up code_verifier
                window.location.href = '/'; // Redirect to home page
            } catch (error) {
                console.error('spotifyAuth.js: Error exchanging code for tokens:', error);
                // Optionally, redirect to an error page or show a message
                window.location.href = '/?error=auth_failed';
            }
        } else {
            console.error('spotifyAuth.js: No authorization code or code_verifier found.');
            window.location.href = '/?error=no_code_or_verifier';
        }
    },

    saveTokens: (accessToken, refreshToken, expiresIn) => {
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
        localStorage.setItem('spotify_token_expires_at', Date.now() + expiresIn * 1000);
    },

    getAccessToken: () => {
        const accessToken = localStorage.getItem('spotify_access_token');
        const expiresAt = localStorage.getItem('spotify_token_expires_at');

        if (!accessToken || !expiresAt) {
            return null;
        }

        if (Date.now() < expiresAt) {
            return accessToken;
        }

        return spotifyAuth.refreshAccessToken();
    },

    getRefreshToken: () => {
        return localStorage.getItem('spotify_refresh_token');
    },

    refreshAccessToken: async () => {
        const refreshToken = spotifyAuth.getRefreshToken();
        if (!refreshToken) {
            spotifyAuth.clearTokens();
            return null;
        }

        try {
            const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: CLIENT_ID // Include client_id for refresh token request
                })
            });

            if (!refreshResponse.ok) {
                const errorText = await refreshResponse.text();
                throw new Error(`HTTP error! status: ${refreshResponse.status}, response: ${errorText}`);
            }

            const data = await refreshResponse.json();
            spotifyAuth.saveTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
            return data.access_token;
        } catch (error) {
            console.error('spotifyAuth.js: Error refreshing access token:', error);
            spotifyAuth.clearTokens();
            return null;
        }
    },

    clearTokens: () => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expires_at');
        // Optionally, redirect to login page
        window.location.href = '/';
    },

    isAuthenticated: () => {
        const token = spotifyAuth.getAccessToken();
        return !!token;
    }
};

export { spotifyAuth };