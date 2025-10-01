// Initialize luxy.js with sensible fallbacks
(function() {
	const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced || !window.luxy) return; // Respect reduced motion or missing lib

	const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;

	// Tune speeds differently for touch to avoid over-feeling laggy
	const baseConfig = {
		wrapper: '#luxy',
		targets: '.parallax',
		wrapperSpeed: isTouch ? 0.15 : 0.08,
		targetSpeed: isTouch ? 0.32 : 0.24,
		targetPercentage: 0.1
	};

	try {
		luxy.init(baseConfig);
	} catch (e) {
		console.warn('Luxy initialization failed:', e);
	}
})();

// Dynamic vertical alignment for polaroid frames to center on mapped content rows
// (Removed dynamic polaroid positioning: simplified to fixed center baseline)

// Optional: If you later add elements you want parallaxed dynamically:
//   const el = document.createElement('div');
//   el.className = 'parallax';
//   el.setAttribute('data-speed-y', '20');
//   document.querySelector('#luxy').appendChild(el);

// Background music playlist logic
(function() {
	const files = [
		{ src: 'Music/Perfect.mp3', title: 'Perfect', artist: 'Ed Sheeran' },
		{ src: 'Music/You Are The Reason.mp3', title: 'You Are The Reason', artist: 'Calum Scott' },
        { src: 'Music/All of Me.mp3', title: 'All of Me', artist: 'John Legend' }
	];
	const toggleBtn = document.getElementById('audioToggle');
	const volumeSlider = document.getElementById('bgVolume');
	const trackTitleEl = document.getElementById('trackTitle');
	const trackArtistEl = document.getElementById('trackArtist');
	const trackListEl = document.getElementById('trackList'); // now inside player bar
	const autoplayNote = document.getElementById('autoplayNote');
	if (!toggleBtn || !volumeSlider) return; // UI not present

	let currentIndex = 0;
	let audio = new Audio(); // primary playing element
	let fadingOutAudio = null; // secondary element for crossfade
	let userInteracted = false;
	let playing = false;
	let fadeInterval = null;

	// Restore volume
	const savedVol = localStorage.getItem('bgVolume');
	if (savedVol !== null) {
		volumeSlider.value = savedVol;
		audio.volume = parseInt(savedVol, 10) / 100;
	} else {
		audio.volume = volumeSlider.value / 100;
	}

	function fadeText(el, newText) {
		if(!el) return;
		el.style.transition = 'opacity .45s ease, transform .45s ease';
		el.style.opacity = '0';
		el.style.transform = 'translateY(4px)';
		setTimeout(()=>{
			el.textContent = newText;
			el.style.opacity = '1';
			el.style.transform = 'translateY(0)';
		}, 250);
	}

	function updateTrackTitle() {
		if (trackTitleEl) fadeText(trackTitleEl, files[currentIndex].title);
		if (trackArtistEl) fadeText(trackArtistEl, files[currentIndex].artist || '—');
		if (trackListEl) {
			[...trackListEl.children].forEach((li, i)=>{
				if (i === currentIndex) li.classList.add('active'); else li.classList.remove('active');
			});
		}
	}

	function buildTrackList(){
		if(!trackListEl) return;
		trackListEl.innerHTML='';
		files.forEach((f,i)=>{
			const li=document.createElement('li');
			li.textContent = f.title;
			li.setAttribute('data-index', i);
			li.addEventListener('click', ()=>{
				loadTrack(i);
				if(playing) play();
			});
			trackListEl.appendChild(li);
		});
	}

	function loadTrack(index) {
		currentIndex = (index + files.length) % files.length;
		// Prepare crossfade if currently playing
		if(playing) {
			// Move current audio to fadingOutAudio and create a fresh audio for new track
			if(fadingOutAudio) {
				try { fadingOutAudio.pause(); } catch(e){}
			}
			fadingOutAudio = audio;
			const newAudio = new Audio();
			audio = newAudio;
			// Set initial volume to 0 for fade-in
			const targetVol = parseInt(volumeSlider.value, 10) / 100;
			audio.volume = 0;
			audio.src = files[currentIndex].src;
			audio.load();
			updateTrackTitle();
			audio.play().then(()=>{
				// Fade in new track
				fadeTo(targetVol, 1300);
			}).catch(err=>{ console.warn('Crossfade new track play failed:', err); });
			// Fade out and cleanup old track
			if(fadingOutAudio){
				const oldRef = fadingOutAudio;
				try {
					const startVol = oldRef.volume;
					const startTime = performance.now();
					const dur = 1300;
					function fadeOld(t){
						const prog = Math.min(1, (t-startTime)/dur);
						oldRef.volume = startVol * (1-prog);
						if(prog < 1) requestAnimationFrame(fadeOld); else { try { oldRef.pause(); } catch(e){} }
					}
					requestAnimationFrame(fadeOld);
				}catch(e){}
			}
		} else {
			// Simple load (not yet playing)
			audio.src = files[currentIndex].src;
			audio.load();
			updateTrackTitle();
		}
	}

	function setPlayingUI(on) {
		playing = on;
		if (on) {
			toggleBtn.textContent = 'Pause';
			toggleBtn.classList.add('playing');
			toggleBtn.setAttribute('aria-pressed', 'true');
		} else {
			toggleBtn.textContent = 'Play';
			toggleBtn.classList.remove('playing');
			toggleBtn.setAttribute('aria-pressed', 'false');
		}
	}

	function fadeTo(target, ms) {
		if (fadeInterval) cancelAnimationFrame(fadeInterval);
		const start = audio.volume;
		const delta = target - start;
		if (Math.abs(delta) < 0.0001) { audio.volume = target; return; }
		const startTime = performance.now();
		function step(t) {
			const elapsed = t - startTime;
			const progress = Math.min(1, elapsed / ms);
			// Use smooth easing (easeInOutQuad)
			const eased = progress < 0.5 ? 2*progress*progress : -1 + (4 - 2*progress) * progress;
			audio.volume = Math.min(1, Math.max(0, start + delta * eased));
			if (progress < 1) {
				fadeInterval = requestAnimationFrame(step);
			} else {
				fadeInterval = null;
			}
		}
		fadeInterval = requestAnimationFrame(step);
	}

	function play() {
		userInteracted = true;
		const targetVol = parseInt(volumeSlider.value, 10) / 100;
		// Start from a low volume if currently near 0 to avoid pop
		if (audio.volume < 0.005) audio.volume = 0;
		setPlayingUI(true);
		audio.play().then(() => {
			if (autoplayNote) autoplayNote.hidden = true;
			fadeTo(targetVol, 700);
		}).catch(err => {
			console.warn('Playback blocked or failed:', err);
			setPlayingUI(false);
			if (autoplayNote) autoplayNote.hidden = false;
		});
	}

	function pause() {
		// Fade down then pause to avoid click artifacts
		const current = audio.volume;
		fadeTo(0, 600);
		setTimeout(() => { if (!playing) { audio.pause(); audio.currentTime = audio.currentTime; } }, 610);
		setPlayingUI(false);
	}

	function nextTrack() {
		// loadTrack handles crossfade if playing
		loadTrack(currentIndex + 1);
		if (!playing) {
			// If not playing yet, do nothing else
			return;
		}
	}

	// Button toggle
	toggleBtn.addEventListener('click', () => {
		if (!playing) play(); else pause();
	});

	// Volume change
	let pendingVolumeFrame = null;
	volumeSlider.addEventListener('input', () => {
		const target = parseInt(volumeSlider.value, 10) / 100;
		localStorage.setItem('bgVolume', volumeSlider.value);
		if (!playing) { audio.volume = target; return; }
		if (pendingVolumeFrame) cancelAnimationFrame(pendingVolumeFrame);
		pendingVolumeFrame = requestAnimationFrame(() => {
			fadeTo(target, 400);
		});
	});

	// Track end
	audio.addEventListener('ended', () => nextTrack());

	// Try autoplay immediately with a gentle fade from 0 to chosen volume
	const targetVolume = audio.volume;
	audio.volume = 0;
	buildTrackList();
	loadTrack(0);
	setPlayingUI(true);
	audio.play().then(() => {
		fadeTo(targetVolume, 1600);
		if (autoplayNote) autoplayNote.hidden = true;
	}).catch(() => {
		audio.volume = targetVolume;
		setPlayingUI(false);
		if (autoplayNote) autoplayNote.hidden = false;
	});

	// If user interacts anywhere and autoplay was blocked but they haven't pressed Play yet
	function globalFirstInteraction() {
		if (!playing && autoplayNote && !autoplayNote.hidden) {
			// Attempt play automatically now that user interacted
			play();
		}
		window.removeEventListener('click', globalFirstInteraction);
		window.removeEventListener('keydown', globalFirstInteraction);
		window.removeEventListener('touchstart', globalFirstInteraction);
	}
	window.addEventListener('click', globalFirstInteraction);
	window.addEventListener('keydown', globalFirstInteraction);
	window.addEventListener('touchstart', globalFirstInteraction);
})();

// Load polaroid frames from external JSON for easier management
(function(){
	const cluster = document.querySelector('.polaroid-cluster');
	if(!cluster) return;
	fetch('photos.json')
		.then(r=> r.ok ? r.json() : Promise.reject(r.status))
		.then(list => {
			if(!Array.isArray(list)) return;
			const frag = document.createDocumentFragment();
			list.forEach(item => {
				if(!item || !item.src) return;
				const fig = document.createElement('figure');
				fig.className = 'polaroid';
				fig.style.setProperty('--x', item.x || '0');
				if(item.dy) fig.style.setProperty('--dy', item.dy);
				if(item.rot) fig.style.setProperty('--rot', item.rot);
				fig.innerHTML = `\n  <img src="${item.src}" alt="${item.alt || ''}" loading="lazy" />\n  <figcaption>${item.caption || ''}</figcaption>\n`;
				frag.appendChild(fig);
			});
			cluster.appendChild(frag);
		})
		.catch(err => console.warn('Polaroid load failed:', err));
})();
