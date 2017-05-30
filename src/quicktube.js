const KEY_CODES = {
    ENTER: 13,
};

const YOUTUBE_API = 'https://www.youtube.com/iframe_api';
const YOUTUBE_EMBED = 'https://www.youtube.com/embed/';
const VIMEO_API = 'https://player.vimeo.com/api/player.js';
const VIMEO_EMBED = 'https://player.vimeo.com/video/';
const FIRST_SCRIPT_TAG = document.getElementsByTagName('script')[0];
const IFRAME_CLASS = 'quicktube__iframe';

// Mobile Safari exhibits a number of documented bugs with the
// youtube player API
// https://groups.google.com/forum/#!topic/youtube-api-gdata/vPgKhCu4Vng
const isMobileSafari = () => (/Apple.*Mobile.*Safari/).test(navigator.userAgent);

const trackEvent = (event) => {
    const settings = Object.assign({
        eventCategory: 'Videos',
        eventAction: 'GTM',
        eventLabel: '',
    }, event);

    if (typeof window.ga === 'function') {
        window.ga('send', 'event', settings.eventCategory, settings.eventAction, settings.eventLabel);
    }
};

const createPlayerUrl = (playerEmbedUrl, playerId, options) => {
    let url = `${playerEmbedUrl}${playerId}?autoplay=1`;
    const optionKeys = Object.keys(options);
    optionKeys.forEach((key) => {
        url += `&${key}=${options[key]}`;
    });
    return url;
};

const getCurrentSegment = (currentPosition, duration, numberOfSegments = 4) => {
    const percentage = (currentPosition / duration);
    // Ensure value is rounded to nearest whole segment eg. 1, 2, 3 , 4
    return (Math.floor(percentage * numberOfSegments) / numberOfSegments).toFixed(2);
};

const guid = () => {
    const s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };

    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

class Quicktube {

    constructor(videoId, videoGUID, videoEmbedUrl, options = {}) {
        this.videoId = videoId;
        this.videoGUID = videoGUID;
        this.videoEl = document.querySelector(`[data-quicktube-quid="${this.videoGUID}"]`);
        this.videoPoster = this.videoEl.querySelector('[data-quicktube-poster]');

        // Bound functions
        this.onClick = this.onClick.bind(this);
        this.stopVideo = this.stopVideo.bind(this);
        this.onPlayerReady = this.onPlayerReady.bind(this);
        this.onPlayerStateChange = this.onPlayerStateChange.bind(this);
        this.onPlayerError = this.onPlayerError.bind(this);

        // Booleans
        this.isMobileSafari = isMobileSafari();
        this.isVimeo = this.videoEl.hasAttribute('data-quicktube-vimeo');

        // Settings
        this.options = Object.assign({
            trackAnalytics: false,
            activeClass: 'quicktube--playing',
            pausedClass: 'quicktube--paused',
            posterFrameHiddenClass: 'quicktube__poster--hidden',
        }, options);

        const playerOptions = !this.isVimeo ? {
            showInfo: 0,
            autohide: 1,
            color: 'white',
            playerapi: 'ytplayer',
            enablejsapi: 1,
            wmode: 'transparent',
        } : {
            autopause: 0,
        };

        this.playerUrl = createPlayerUrl(videoEmbedUrl, this.videoId, playerOptions);

        // Initial actions
        // Need to have unique id's so that multiple of the same video can exist on a page without breaking
        const playEl = this.videoEl.querySelector('[data-quicktube-play]');
        playEl.setAttribute('data-play-guid', this.videoGUID);
        const uniquePlayButton = document.querySelector(`[data-play-guid="${this.videoGUID}"]`);

        uniquePlayButton.addEventListener('click', this.onClick);

        uniquePlayButton.addEventListener('keydown', (event) => {
            if (event.keyCode === KEY_CODES.ENTER) {
                this.onClick();
            }
        });
    }

    onClick() {
        const iframeContainer = this.videoEl.querySelector('[data-quicktube-video]');
        const videoIframes = iframeContainer.getElementsByTagName('iframe');
        // defines whether video has already been loaded and you want to play again
        let iframe = false;
        if (videoIframes.length > 0) {
            iframe = videoIframes[0];
        }

        if (!iframe) {
            this.createIframePlayer(iframeContainer);

            // TODO Figure out what this is doing and why!
            YT.gaLastAction = 'p';
        }

        // Only trigger force video play if not Mobile safari as playVideo function not supported
        if (!this.isMobileSafari) {
            if (this.quicktubePlayer) {
                if (this.isVimeo) {
                    this.quicktubePlayer.play();
                } else {
                    // It doesn't have playVideo function in the initial state. Is added after video is ready
                    const isLoaded = this.quicktubePlayer.playVideo;

                    if (isLoaded) {
                        this.quicktubePlayer.playVideo();
                    }
                }
            }
        }

        // Check if video isn't already playing
        if (!this.videoEl.getAttribute('data-video-playing')) {
            this.hidePosterFrame();
            this.addActiveState();
        }
    }

    addActiveState() {
        this.videoEl.classList.add(this.options.activeClass);
        this.videoEl.classList.remove(this.options.pausedClass);
    }

    removeActiveState() {
        this.videoEl.classList.remove(this.options.activeClass);
        this.videoEl.classList.add(this.options.pausedClass);
        this.videoEl.removeAttribute('data-video-playing');
    }

    stopVideo() {
        if (!this.quicktubePlayer) {
            return;
        }

        if (this.isVimeo) {
            this.quicktubePlayer.unload();
        } else {
            this.quicktubePlayer.stopVideo();
        }

        this.removeActiveState();
        this.showPosterFrame();
    }

    hidePosterFrame() {
        this.videoPoster.classList.add(this.options.posterFrameHiddenClass);
    }

    showPosterFrame() {
        this.videoPoster.classList.remove(this.options.posterFrameHiddenClass);
    }

    createIframePlayer(iframeContainer) {
        const iframe = document.createElement('iframe');
        iframe.src = this.playerUrl;
        iframe.width = '100%';
        iframe.id = this.videoGUID;
        iframe.className = IFRAME_CLASS;
        iframeContainer.appendChild(iframe);

        if (this.isVimeo) {
            this.quicktubePlayer = new Vimeo.Player(this.videoGUID);

            this.quicktubePlayer.on('play', () => {
                console.log(this.videoGUID, ': Vimeo played!');
            });

            this.quicktubePlayer.on('pause', () => {
                console.log(this.videoGUID, ': Vimeo paused!');
            });
            // this.quicktubePlayer.on('timeupdate', () => {
            //     console.log(this.videoGUID, ': Vimeo time update!');
            // });
            this.quicktubePlayer.on('loaded', () => {
                console.log(this.videoGUID, ': Vimeo Video loaded!');
            });
            this.quicktubePlayer.on('error', () => {
                console.log(this.videoGUID, ': Vimeo Error!');
            });

            // Might wanna check this functionality, may want to leave stopped player
            // state so user can nav to other related videos?
            this.quicktubePlayer.on('ended', () => {
                this.stopVideo();
            });
        } else {
            this.quicktubePlayer = new YT.Player(this.videoGUID, {
                events: {
                    onReady: this.onPlayerReady,
                    onStateChange: this.onPlayerStateChange,
                    onError: this.onPlayerError,
                },
            });
        }
    }

    onPlayerReady(event) {
        const isPlaying = this.videoEl.getAttribute('data-video-playing');
        if (!this.isMobileSafari) {
            if (isPlaying) {
                // TODO evaluate if this is needed
                // Not sure it ever gets to this point
                this.stopVideo();
            } else {
                this.videoEl.setAttribute('data-video-playing', true);
                event.target.playVideo();
            }
        }
    }

    onPlayerPlay() {

    }

    onPlayerPause() {

    }

    onPlayerEnd() {

    }

    // listen for play, pause, percentage play, and end states
    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.videoEl.setAttribute('data-video-playing', true);
            this.addActiveState();
            // Report % played every second
            setTimeout(this.onPlayerPercent.bind(this, event.target), 1000);
        }

        if (event.data === YT.PlayerState.PAUSED) {
            this.removeActiveState();
        }

        const videoData = event.target.getVideoData();
        let label = videoData.title;
        // Get title of the current page
        const pageTitle = document.title;

        // TODO figure out what this is all doing and test it
        if (this.options.trackAnalytics) {
            if (event.data === YT.PlayerState.PLAYING && YT.gaLastAction === 'p') {
                label = `Video Played - ${videoData.title}`;
                trackEvent({
                    event: 'youtube',
                    eventAction: pageTitle,
                    eventLabel: label,
                });
                YT.gaLastAction = '';
            }

            if (event.data === YT.PlayerState.PAUSED) {
                label = `Video Paused - ${videoData.title}`;
                trackEvent({
                    event: 'youtube',
                    eventAction: pageTitle,
                    eventLabel: label,
                });
                YT.gaLastAction = 'p';
            }
        }

        if (event.data === YT.PlayerState.ENDED) {
            console.log('youtube ended');
            this.stopVideo();
        }
    }

    // report the % played if it matches 0%, 25%, 50%, 75% or completed
    onPlayerPercent(originalEvent) {
        const event = originalEvent;

        if (this.options.trackAnalytics) {
            if (event.getPlayerState() === YT.PlayerState.PLAYING) {
                const videoDuration = event.getDuration();
                const videoProgress = event.getCurrentTime();
                let currentSegment;

                // If less than 1.5 seconds from the end of the video
                if (videoDuration - videoProgress <= 1.5) {
                    currentSegment = 1;
                } else {
                    currentSegment = getCurrentSegment(videoProgress, videoDuration);
                }

                // Only fire tracking event at 0, .25, .50, .75 or 1 segment mark
                if (!event.previousSegment || currentSegment > event.previousSegment) {
                    const videoData = event.getVideoData();
                    const pageTitle = document.title;
                    event.previousSegment = currentSegment;
                    const label = `${currentSegment * 100}% Video played - ${videoData.title}`;
                    trackEvent({
                        event: 'youtube',
                        eventAction: pageTitle,
                        eventLabel: label,
                    });
                }

                if (event.previousSegment !== 1) {
                    setTimeout(this.onPlayerPercent.bind(this, event), 1000);
                }
            }
        }
    }

    // catch all to report errors through the GTM data layer
    // once the error is exposed to GTM, it can be tracked in UA as an event!
    onPlayerError(event) {
        if (this.options.trackAnalytics) {
            trackEvent({
                event: 'error',
                eventAction: 'GTM',
                eventLabel: `youtube:${event.target.src}-${event.data}`,
            });
        }
    }

}

// This seems to be a requirement of the YouTube Player API for iframe embeds
// https://developers.google.com/youtube/iframe_api_reference#Requirements
window.onYouTubeIframeAPIReady = () => {
    // TODO investigate whether this is a set requirement
};

const insertApiScript = (url, hasBeenCreated) => {
    if (!hasBeenCreated) {
        const newScriptTag = document.createElement('script');
        newScriptTag.src = url;
        FIRST_SCRIPT_TAG.parentNode.insertBefore(newScriptTag, FIRST_SCRIPT_TAG);
    }
};

const quicktubeInit = () => {
    const videos = Array.prototype.slice.call(document.querySelectorAll('[data-quicktube]'));
    videos.forEach((video) => {
        let videoDomain;
        if (video.hasAttribute('data-quicktube-vimeo')) {
            // Inject the Vimeo Player API
            insertApiScript(VIMEO_API, window.Vimeo);
            videoDomain = VIMEO_EMBED;
        } else {
            // Inject the YouTube API
            insertApiScript(YOUTUBE_API, window.YT);
            videoDomain = YOUTUBE_EMBED;
        }
        const videoId = video.getAttribute('data-quicktube');
        const options = JSON.parse(video.getAttribute('data-quicktube-options'));
        const videoGUID = guid();
        video.setAttribute('data-quicktube-quid', videoGUID);
        const player = new Quicktube(videoId, videoGUID, videoDomain, options);
        return player;
    });
};

// Need to figure out the best way to export these to use inside tests as well as projects
module.exports = {
    init: quicktubeInit,
    Quicktube: Quicktube,
};