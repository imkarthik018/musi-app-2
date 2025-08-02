import { spotifyAuth } from './spotifyAuth.js';
import { spotifyApi } from './spotifyApi.js';
import { createCarousel } from './carousel.js';
import { createHeroGrid } from './heroGrid.js';

// --- Global State ---
let spotifyPlayer = null;
let deviceId = null;
let progressInterval = null;
let lastPlayerState = null;

// --- SDK Ready Promise ---
// This promise will resolve when the Spotify SDK is ready.
const sdkReady = new Promise(resolve => {
    document.addEventListener('spotifySdkReady', () => {
        console.log('Spotify SDK is ready (main.js listener).');
        resolve();
    });
});

// --- Main Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('main.js: DOMContentLoaded fired.');

    const spotifyLoginButton = document.getElementById('spotify-login-button');
    const preAuthContent = document.getElementById('pre-auth-content');
    const authenticatedContent = document.getElementById('authenticated-content');

    if (spotifyAuth.isAuthenticated()) {
        console.log('main.js: User is authenticated.');
        console.log('preAuthContent classList BEFORE hiding:', preAuthContent.classList.value);
        preAuthContent.classList.add('hidden');
        console.log('preAuthContent classList AFTER hiding:', preAuthContent.classList.value);
        console.log('authenticatedContent classList BEFORE showing:', authenticatedContent.classList.value);
        authenticatedContent.classList.remove('hidden');
        console.log('authenticatedContent classList AFTER showing:', authenticatedContent.classList.value);
        initializeApp();
    } else {
        console.log('main.js: User is not authenticated.');
        preAuthContent.classList.remove('hidden');
        authenticatedContent.classList.add('hidden');
        spotifyLoginButton.addEventListener('click', () => {
            console.log('main.js: Login button clicked.');
            spotifyAuth.login();
        });
    }
});

// --- Application Initialization (for authenticated users) ---
async function initializeApp() {
    // 1. Wait for the SDK to be ready
    await sdkReady;

    // 2. Initialize the Spotify Player
    initializeSpotifyPlayer();

    // 3. Load dynamic content
    await loadDynamicContent();

    // 4. Set up all UI event listeners
    initializeUIEventListeners();
}

// --- Spotify Player Initialization ---
function initializeSpotifyPlayer() {
    const token = spotifyAuth.getAccessToken();
    if (!token) {
        console.error('No access token for Spotify Player.');
        return;
    }

    console.log('Initializing Spotify Player...');
    spotifyPlayer = new Spotify.Player({
        name: 'Musi Web Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });
    console.log('Spotify Player instance created:', spotifyPlayer);

    addPlayerListeners();
    spotifyPlayer.connect();
    console.log('Spotify Player connect() called.');
}

function addPlayerListeners() {
    console.log('Adding Spotify Player listeners...');
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Player is ready with Device ID', device_id);
        deviceId = device_id;
        spotifyApi.transferPlayback(deviceId);
    });

    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
    });

    spotifyPlayer.addListener('player_state_changed', (state) => {
        console.log('Player state changed:', state);
        if (state) {
            lastPlayerState = state;
            updateNowPlayingUI(state);
        }
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Authentication Error:', message);
        spotifyAuth.clearTokens();
    });

    spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Account Error:', message);
    });

    spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Playback Error:', message);
    });

    console.log('Spotify Player listeners added.');
}

function updateNowPlayingUI(state) {
    console.log('Updating Now Playing UI with state:', state);
    const floatingBar = document.getElementById('floating-now-playing');
    const track = state.track_window.current_track;
    const playPauseWrapper = document.getElementById('play-pause-button-wrapper');

    if (!track) {
        floatingBar.classList.remove('visible');
        playPauseWrapper.classList.remove('playing');
        clearInterval(progressInterval);
        progressInterval = null;
        return;
    }

    // --- UI Elements ---
    const albumArtEl = floatingBar.querySelector('img');
    const trackNameEl = floatingBar.querySelector('h4');
    const trackInfoEl = floatingBar.querySelector('p');
    const playPauseIcon = floatingBar.querySelector('#play-pause-button i');
    const progressBar = floatingBar.querySelector('.h-1 > div');
    const currentTimeEl = floatingBar.querySelector('.flex.justify-between span:first-child');
    const totalTimeEl = floatingBar.querySelector('.flex.justify-between span:last-child');

    // --- Update static track info ---
    albumArtEl.src = track.album.images[0]?.url || '';
    trackNameEl.textContent = track.name;
    trackInfoEl.textContent = `${track.artists.map(a => a.name).join(', ')} • ${track.album.name}`;
    totalTimeEl.textContent = formatTime(track.duration_ms);

    // --- Update play/pause button ---
    console.log('Current state.paused:', state.paused);
    playPauseIcon.classList.toggle('fa-play', state.paused);
    playPauseIcon.classList.toggle('fa-pause', !state.paused);

    // --- Toggle glowing effect ---
    if (!state.paused) {
        console.log('Adding "playing" class to playPauseWrapper.');
        playPauseWrapper.classList.add('playing');
        progressBar.classList.add('glowing'); // Add glowing class
    } else {
        console.log('Removing "playing" class from playPauseWrapper.');
        playPauseWrapper.classList.remove('playing');
        progressBar.classList.remove('glowing'); // Remove glowing class
    }

    // --- Progress Update Logic ---
    clearInterval(progressInterval); // Clear previous interval

    const updateProgress = () => {
        if (!lastPlayerState) return;

        const { position, duration, timestamp, paused } = lastPlayerState;
        let currentPosition = position;

        if (!paused) {
            currentPosition += (Date.now() - timestamp);
        }
        
        // Ensure currentPosition doesn't exceed duration
        currentPosition = Math.min(currentPosition, duration);

        progressBar.style.width = `${(currentPosition / duration) * 100}%`;
        currentTimeEl.textContent = formatTime(currentPosition);
    };

    updateProgress(); // Update immediately

    if (!state.paused) {
        progressInterval = setInterval(updateProgress, 1000);
    }

    floatingBar.classList.add('visible');
}

// --- UI Event Listeners ---
function initializeUIEventListeners() {
    // Player Controls
    document.getElementById('play-pause-button').addEventListener('click', () => {
        console.log('Play/Pause button clicked.');
        spotifyPlayer?.togglePlay();
    });
    document.getElementById('prev-button').addEventListener('click', () => spotifyPlayer?.previousTrack());
    document.getElementById('next-button').addEventListener('click', () => spotifyPlayer?.nextTrack());

    // Progress Bar Seek
    document.getElementById('progress-bar-container').addEventListener('click', (e) => {
        if (!lastPlayerState) return;

        const progressBar = e.currentTarget;
        const clickX = e.clientX - progressBar.getBoundingClientRect().left;
        const progressBarWidth = progressBar.offsetWidth;
        const duration = lastPlayerState.duration;

        const seekPercentage = clickX / progressBarWidth;
        const seekPositionMs = Math.round(duration * seekPercentage);

        spotifyPlayer?.seek(seekPositionMs);
    });

    // Spacebar to toggle play/pause
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            event.preventDefault(); // Prevent default spacebar behavior (e.g., scrolling)
            spotifyPlayer?.togglePlay();
        }
    });

    // Content Playback (Carousels & Hero Grid)
    document.getElementById('authenticated-content').addEventListener('click', (e) => {
        const playButton = e.target.closest('.play-button');
        if (playButton && deviceId) {
            const uri = playButton.dataset.uri;
            const type = playButton.dataset.type;
            console.log(`Playing ${type}: ${uri}`);
            spotifyApi.startPlayback(deviceId, uri);
        }
    });

    // Tab Switching
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            contentSections.forEach(s => s.classList.remove('active'));
            document.getElementById(tabId)?.classList.add('active');
            navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tabId));
            history.pushState(null, null, `#${tabId}`);
        });
    });

    // Set initial tab
    const initialTab = window.location.hash.substring(1) || 'home-content';
    document.querySelector(`.nav-item[data-tab="${initialTab}"]`)?.click();
}

// --- Dynamic Content Loading ---
async function loadDynamicContent() {
    try {
        console.log('Loading dynamic content...');
        
        // Load featured playlists (temporarily commented out due to 404 error)
        // const featuredPlaylists = await spotifyApi.getFeaturedPlaylists(6, 0);
        // if (featuredPlaylists && featuredPlaylists.playlists) {
        //     createCarousel('featured-playlists-carousel', 'Featured Playlists', featuredPlaylists.playlists.items);
        // }
        
        // Load new releases (temporarily commented out due to TypeError)
        // const newReleases = await spotifyApi.getNewReleases(6, 0);
        // if (newReleases && newReleases.albums) {
        //     createCarousel('new-releases-carousel', 'New Releases', newReleases.albums.items);
        // }
        
        // Load user's top tracks
        const topTracks = await spotifyApi.getUserTopItems('tracks', 6, 0);
        if (topTracks && topTracks.items) {
            createHeroGrid('hero-grid-container', topTracks.items);
        }
        
        console.log('Dynamic content loaded successfully');
    } catch (error) {
        console.error('Error loading dynamic content:', error);
    }
}

// --- Utility Functions ---
function formatTime(ms) {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
};