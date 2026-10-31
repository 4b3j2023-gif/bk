const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.primary-nav');

if (menuToggle && primaryNav) {
    menuToggle.addEventListener('click', () => {
        const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', String(!isOpen));
        menuToggle.setAttribute('aria-label', isOpen ? '開啟導覽選單' : '關閉導覽選單');
        primaryNav.classList.toggle('is-open', !isOpen);
    });

    primaryNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', '開啟導覽選單');
            primaryNav.classList.remove('is-open');
        });
    });
}

const playButton = document.querySelector('#play-button');
const volumeButton = document.querySelector('#volume-button');
const seekSlider = document.querySelector('#seek-slider');
const currentTimeLabel = document.querySelector('#current-time');
const playerStatus = document.querySelector('#player-status');
const waveform = document.querySelector('.waveform');
const trackDuration = 18;
const audioSupported = 'AudioContext' in window || 'webkitAudioContext' in window;
let audioContext;
let masterGain;
let audioBuffer;
let activeSource;
let isPlaying = false;
let isMuted = false;
let playbackOffset = 0;
let playbackStartedAt = 0;
let animationFrame;

if (!audioSupported && playButton) {
    playButton.disabled = true;
    playerStatus.textContent = '此瀏覽器不支援音訊播放';
}

function formatTime(seconds) {
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function createDemoBuffer(context) {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, sampleRate * trackDuration, sampleRate);
    const samples = buffer.getChannelData(0);

    function addTone(start, length, frequency, volume, harmonics = false) {
        const firstSample = Math.floor(start * sampleRate);
        const lastSample = Math.min(samples.length, Math.ceil((start + length) * sampleRate));
        const attack = 0.06;
        const release = Math.min(0.35, length * 0.4);

        for (let index = firstSample; index < lastSample; index += 1) {
            const elapsed = (index - firstSample) / sampleRate;
            const remaining = length - elapsed;
            const envelope = Math.min(1, elapsed / attack, remaining / release);
            const fundamental = Math.sin(2 * Math.PI * frequency * elapsed);
            const overtone = harmonics ? Math.sin(4 * Math.PI * frequency * elapsed) * 0.17 : 0;
            samples[index] += (fundamental + overtone) * volume * Math.max(0, envelope);
        }
    }

    const chords = [
        [196, 246.94, 293.66],
        [164.81, 196, 246.94],
        [174.61, 220, 261.63],
        [146.83, 196, 246.94]
    ];
    const melody = [392, 493.88, 587.33, 493.88, 440, 392, 329.63, 392, 440, 523.25, 493.88, 392, 349.23, 392, 440, 493.88, 587.33, 523.25, 440, 392, 329.63, 392, 440, 493.88, 523.25, 493.88, 440, 392, 349.23, 392, 493.88, 587.33, 523.25, 493.88, 440, 392];

    chords.forEach((chord, chordIndex) => {
        const start = chordIndex * 4.5;
        chord.forEach((frequency, noteIndex) => {
            addTone(start, 4.2, frequency, noteIndex === 0 ? 0.11 : 0.075, true);
        });
    });

    melody.forEach((frequency, index) => {
        const start = 0.25 + index * 0.48;
        if (start < trackDuration - 0.25) {
            addTone(start, 0.31, frequency, 0.105, true);
        }
    });

    return buffer;
}

function getPlaybackTime() {
    if (!isPlaying || !audioContext) return playbackOffset;
    return Math.min(trackDuration, audioContext.currentTime - playbackStartedAt);
}

function updatePlayer() {
    const currentTime = getPlaybackTime();
    currentTimeLabel.textContent = formatTime(currentTime);
    seekSlider.value = String(currentTime);
    seekSlider.style.setProperty('--progress', `${(currentTime / trackDuration) * 100}%`);

    if (isPlaying) {
        animationFrame = requestAnimationFrame(updatePlayer);
    }
}

function stopActiveSource() {
    if (!activeSource) return;
    const source = activeSource;
    activeSource = null;
    source.onended = null;
    source.stop();
    source.disconnect();
}

async function startPlayback() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
        playerStatus.textContent = '此瀏覽器不支援音訊播放';
        return;
    }

    try {
        if (!audioContext) {
            audioContext = new AudioContextConstructor();
            masterGain = audioContext.createGain();
            masterGain.gain.value = isMuted ? 0 : 0.8;
            masterGain.connect(audioContext.destination);
            audioBuffer = createDemoBuffer(audioContext);
        }

        if (audioContext.state === 'suspended') await audioContext.resume();

        if (playbackOffset >= trackDuration) playbackOffset = 0;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(masterGain);
        source.onended = () => {
            if (activeSource !== source) return;
            activeSource = null;
            isPlaying = false;
            playbackOffset = 0;
            playButton.classList.remove('is-playing');
            playButton.setAttribute('aria-label', '播放試聽');
            waveform.classList.remove('is-playing');
            playerStatus.textContent = '試聽完成，再聽一次？';
            cancelAnimationFrame(animationFrame);
            updatePlayer();
        };
        activeSource = source;
        playbackStartedAt = audioContext.currentTime - playbackOffset;
        source.start(0, playbackOffset);
        isPlaying = true;
        playButton.classList.add('is-playing');
        playButton.setAttribute('aria-label', '暫停試聽');
        waveform.classList.add('is-playing');
        playerStatus.textContent = '正在播放合成音色示範';
        updatePlayer();
    } catch (error) {
        isPlaying = false;
        playerStatus.textContent = '無法播放音訊，請確認瀏覽器的音訊設定';
        console.error('試聽音訊播放失敗：', error);
    }
}

function pausePlayback() {
    playbackOffset = getPlaybackTime();
    isPlaying = false;
    stopActiveSource();
    cancelAnimationFrame(animationFrame);
    playButton.classList.remove('is-playing');
    playButton.setAttribute('aria-label', '播放試聽');
    waveform.classList.remove('is-playing');
    playerStatus.textContent = '試聽已暫停';
    updatePlayer();
}

if (playButton && audioSupported) {
    playButton.addEventListener('click', () => {
        if (isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    });

    seekSlider.addEventListener('input', () => {
        const shouldResume = isPlaying;
        if (isPlaying) pausePlayback();
        playbackOffset = Number(seekSlider.value);
        currentTimeLabel.textContent = formatTime(playbackOffset);
        if (shouldResume) startPlayback();
    });

    volumeButton.addEventListener('click', () => {
        isMuted = !isMuted;
        if (masterGain) masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.8, audioContext.currentTime, 0.025);
        volumeButton.setAttribute('aria-pressed', String(isMuted));
        volumeButton.setAttribute('aria-label', isMuted ? '取消靜音' : '靜音試聽');
    });
}

document.querySelectorAll('.waveform span').forEach((bar, index) => {
    bar.style.setProperty('--index', String(index));
});