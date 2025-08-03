import { spotifyAuth } from './spotifyAuth.js';
import { spotifyApi } from './spotifyApi.js';
import { createCarousel } from './carousel.js';
import { createHeroGrid } from './heroGrid.js';

// --- Global State ---
let spotifyPlayer = null;
let deviceId = null;
let progressInterval = null;
let lastPlayerState = null;
let currentPlaybackQueue = []; // Stores track objects for custom queue
let currentTrackIndex = -1; // Index of the currently playing track in the queue

// --- Utility Functions ---
function formatTime(ms) {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function playTrackAndQueueRecommendations(initialTrack, seedArtistIds) {
    // console.log('playTrackAndQueueRecommendations called with:', initialTrack, seedArtistIds);
    currentPlaybackQueue = [initialTrack];
    currentTrackIndex = 0;

    try {
        const recommendations = await spotifyApi.getRecommendations(
            seedArtistIds.slice(0, 5), // Max 5 artist seeds
            [initialTrack.id], // Use the initial track as a seed
            10 // Get 10 recommended tracks
        );

        if (recommendations && recommendations.tracks) {
            // Filter out the initial track if it appears in recommendations
            const filteredRecommendations = recommendations.tracks.filter(track => track.id !== initialTrack.id);
            currentPlaybackQueue = currentPlaybackQueue.concat(filteredRecommendations);
            // console.log('Updated playback queue:', currentPlaybackQueue);
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }

    // Start playback of the first track in the new queue
    if (currentPlaybackQueue.length > 0) {
        spotifyApi.startPlayback(deviceId, currentPlaybackQueue[currentTrackIndex].uri);
    }
}

async function playNextTrackInQueue() {
    if (currentTrackIndex < currentPlaybackQueue.length - 1) {
        currentTrackIndex++;
        const nextTrack = currentPlaybackQueue[currentTrackIndex];
        // console.log('Playing next track in queue:', nextTrack);
        await spotifyApi.startPlayback(deviceId, nextTrack.uri);
    } else {
        // console.log('End of playback queue.');
        // Optionally, fetch more recommendations or stop playback
    }
}

async function playPreviousTrackInQueue() {
    if (currentTrackIndex > 0) {
        currentTrackIndex--;
        const prevTrack = currentPlaybackQueue[currentTrackIndex];
        // console.log('Playing previous track in queue:', prevTrack);
        await spotifyApi.startPlayback(deviceId, prevTrack.uri);
    } else {
        // console.log('Beginning of playback queue.');
    }
}

// --- Library Page Carousel State and Functions ---
let albums = []; // This will be populated by Spotify data
let cards = [];
let dots = [];
let currentIndex = 0;
let isAnimating = false;

function updateCarousel(newIndex) {
    if (isAnimating || albums.length === 0) return;
    isAnimating = true;
    currentIndex = (newIndex + albums.length) % albums.length;

    cards.forEach((card, i) => {
        const offset = (i - currentIndex + albums.length) % albums.length;
        card.classList.remove("center", "left-1", "left-2", "right-1", "right-2", "hidden");

        if (offset === 0) card.classList.add("center");
        else if (offset === 1) card.classList.add("right-1");
        else if (offset === 2) card.classList.add("right-2");
        else if (offset === albums.length - 1) card.classList.add("left-1");
        else if (offset === albums.length - 2) card.classList.add("left-2");
        else card.classList.add("hidden");
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === currentIndex);
    });

    const albumName = document.querySelector("#library-content .member-name");
    const albumDetails = document.querySelector("#library-content .member-role");

    albumName.style.opacity = "0";
    albumDetails.style.opacity = "0";

    setTimeout(() => {
        albumName.textContent = albums[currentIndex].name;
        albumDetails.textContent = albums[currentIndex].details;
        albumName.style.opacity = "1";
        albumDetails.style.opacity = "1";
    }, 300);

    setTimeout(() => {
        isAnimating = false;
    }, 800);
}

function transitionToPlayer(playlistId) {
    document.body.classList.add("player-transition");
    setTimeout(() => {
        window.location.href = `/player?playlistId=${playlistId}`;
    }, 500);
}

async function initializeLibraryPage() {
    const albumName = document.querySelector("#library-content .member-name");
    const albumDetails = document.querySelector("#library-content .member-role");
    const leftArrow = document.querySelector("#library-content .nav-arrow.left");
    const rightArrow = document.querySelector("#library-content .nav-arrow.right");
    const carouselTrack = document.querySelector("#library-content .carousel-track");
    const dotsContainer = document.querySelector("#library-content .dots");
    const customCursor = document.getElementById("custom-cursor");

    try {
        // console.log("Attempting to fetch user playlists...");
        const userPlaylists = await spotifyApi.getUserPlaylists(20); // Fetch up to 20 playlists
        // console.log("User Playlists fetched:", userPlaylists);
        if (userPlaylists && userPlaylists.items && userPlaylists.items.length > 0) {
            // console.log("Playlists found. Populating carousel.");
            albums = userPlaylists.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                details: `${playlist.tracks.total} Tracks`, // You can fetch duration later if needed
                imageUrl: playlist.images.length > 0 ? playlist.images[0].url : 'https://via.placeholder.com/150' // Placeholder if no image
            }));

            // Clear existing hardcoded cards and dots
            carouselTrack.innerHTML = '';
            dotsContainer.innerHTML = '';

            // Dynamically create cards and dots
            albums.forEach((album, i) => {
                const cardDiv = document.createElement('div');
                cardDiv.classList.add('card');
                cardDiv.dataset.index = i;
                cardDiv.innerHTML = `<img src="${album.imageUrl}" alt="${album.name} Album">`;
                carouselTrack.appendChild(cardDiv);

                const dotDiv = document.createElement('div');
                dotDiv.classList.add('dot');
                dotDiv.dataset.index = i;
                dotsContainer.appendChild(dotDiv);
            });

            // Re-select cards and dots after dynamic creation
            cards = document.querySelectorAll("#library-content .card");
            dots = document.querySelectorAll("#library-content .dot");

            // Attach event listeners to newly created cards and dots
            cards.forEach((card, i) => {
                card.addEventListener("click", () => {
                    transitionToPlayer(albums[i].id);
                });
            });

            dots.forEach((dot, i) => dot.addEventListener("click", () => updateCarousel(i)));

            // Initialize carousel
            updateCarousel(0);

            // Attach hover FX for cards
            cards.forEach(card => {
                card.addEventListener("mouseenter", () => {
                    customCursor.classList.add("hover-scale");
                });
                card.addEventListener("mouseleave", () => {
                    customCursor.classList.remove("hover-scale");
                });
            });

        } else {
            // console.log("No Spotify playlists found or error fetching.");
            albumName.textContent = "No Playlists Found";
            albumDetails.textContent = "Please check your Spotify library.";
        }
    } catch (error) {
        console.error("Error initializing carousel with Spotify data:", error);
        albumName.textContent = "Error Loading Playlists";
        albumDetails.textContent = "Please try again later.";
    }

    // Custom Cursor Implementation
    let mouseX = 0, mouseY = 0;

    window.addEventListener("mousemove", e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function renderCursor() {
        customCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);

    // Add event listeners for carousel navigation
    leftArrow.addEventListener("click", () => {
        updateCarousel(currentIndex - 1);
    });

    rightArrow.addEventListener("click", () => {
        updateCarousel(currentIndex + 1);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            updateCarousel(currentIndex - 1);
        } else if (e.key === "ArrowRight") {
            updateCarousel(currentIndex + 1);
        }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                updateCarousel(currentIndex + 1);
            } else {
                updateCarousel(currentIndex - 1);
            }
        }
    }
}

// --- Dynamic Content Loading ---
async function loadDynamicContent() {
    try {
        // console.log('Loading dynamic content...');
        
        // Load featured playlists
        const featuredPlaylists = await spotifyApi.getFeaturedPlaylists(6, 0);
        if (featuredPlaylists && featuredPlaylists.playlists) {
            createCarousel('featured-playlists-carousel', 'Featured Playlists', featuredPlaylists.playlists.items);
        }
        
        // Load new releases
        const newReleases = await spotifyApi.getNewReleases(6, 0);
        if (newReleases && newReleases.albums) {
            createCarousel('new-releases-carousel', 'New Releases', newReleases.albums.items);
        }
        
        // Load user's top tracks
        const topTracks = await spotifyApi.getUserTopItems('tracks', 6, 0);
        if (topTracks && topTracks.items) {
            createHeroGrid('hero-grid-container', topTracks.items);
        }

        // Load recently played tracks for "Jump Back In" carousel
        const recentlyPlayed = await spotifyApi.getRecentlyPlayed(6);
        if (recentlyPlayed && recentlyPlayed.items) {
            // The recently played items are 'play history objects', which contain a 'track' object.
            // We need to map them to the format expected by createCarousel.
            const carouselItems = recentlyPlayed.items.map(item => ({
                id: item.track.id,
                name: item.track.name,
                artists: item.track.artists,
                images: item.track.album.images,
                uri: item.track.uri,
                type: item.track.type
            }));
            createCarousel('jump-back-in-carousel-container', 'Jump Back In', carouselItems);
        }
        
        // console.log('Dynamic content loaded successfully');
    } catch (error) {
        console.error('Error loading dynamic content:', error);
    }
}

// --- SDK Ready Promise ---
// This promise will resolve when the Spotify SDK is ready.
const sdkReady = new Promise(resolve => {
    document.addEventListener('spotifySdkReady', () => {
        // console.log('Spotify SDK is ready (main.js listener).');
        resolve();
    });
});

// --- Main Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    // console.log('main.js: DOMContentLoaded fired.');

    const spotifyLoginButton = document.getElementById('spotify-login-button');
    const preAuthContent = document.getElementById('pre-auth-content');
    const authenticatedContent = document.getElementById('authenticated-content');

    // console.log('main.js: Checking authentication status...');
    if (spotifyAuth.isAuthenticated()) {
        // console.log('main.js: User is authenticated. Initializing app...');
        preAuthContent.classList.add('hidden');
        authenticatedContent.classList.remove('hidden');
        initializeApp();
    } else {
        // console.log('main.js: User is not authenticated. Showing login content...');
        preAuthContent.classList.remove('hidden');
        authenticatedContent.classList.add('hidden');
        spotifyLoginButton.addEventListener('click', () => {
            // console.log('main.js: Login button clicked. Redirecting to Spotify login...');
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

    // console.log('Initializing Spotify Player...');
    spotifyPlayer = new Spotify.Player({
        name: 'Musi Web Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });
    // console.log('Spotify Player instance created:', spotifyPlayer);

    addPlayerListeners();
    spotifyPlayer.connect();
    // console.log('Spotify Player connect() called.');
}

function addPlayerListeners() {
    // console.log('Adding Spotify Player listeners...');
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        // console.log('Player is ready with Device ID', device_id);
        deviceId = device_id;
        spotifyApi.transferPlayback(deviceId);
    });

    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        // console.log('Device ID has gone offline', device_id);
    });

    spotifyPlayer.addListener('player_state_changed', (state) => {
        // console.log('Player state changed:', state);
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

    // console.log('Spotify Player listeners added.');
}

function updateNowPlayingUI(state) {
    // console.log('Updating Now Playing UI with state:', state);
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
    // console.log('Current state.paused:', state.paused);
    playPauseIcon.classList.toggle('fa-play', state.paused);
    playPauseIcon.classList.toggle('fa-pause', !state.paused);

    // --- Toggle glowing effect ---
    if (!state.paused) {
        // console.log('Adding "playing" class to playPauseWrapper.');
        playPauseWrapper.classList.add('playing');
        progressBar.classList.add('glowing'); // Add glowing class
    } else {
        // console.log('Removing "playing" class from playPauseWrapper.');
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
        // console.log('Play/Pause button clicked.');
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
            // console.log(`Playing ${type}: ${uri}`);
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

            if (tabId === 'library-content') {
                initializeLibraryPage();
            } else if (tabId === 'home-content') {
                loadDynamicContent();
            }
        });
    });

    // Set initial tab
    const initialTab = window.location.hash.substring(1) || 'home-content';
    document.querySelector(`.nav-item[data-tab="${initialTab}"]`)?.click();
}