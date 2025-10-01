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
		.then(raw => {
			let baseY = 0;
			let items = [];
			if(Array.isArray(raw)) {
				// Legacy flat array
				items = raw.map(r => ({ ...r, y: r.y }));
			} else if(raw && typeof raw === 'object' && Array.isArray(raw.items)) {
				baseY = Number(raw.baseY) || 0;
				items = raw.items.map(r => ({ ...r }));
			} else {
				return; // invalid format
			}
			const frag = document.createDocumentFragment();
			items.forEach(item => {
				if(!item || !item.src) return;
				const fig = document.createElement('figure');
				fig.className = 'polaroid';
				if(item.x) fig.style.left = item.x;
				let topVal = 0;
				if(typeof item.y !== 'undefined') {
					// direct y wins
					const parsed = parseFloat(item.y);
					topVal = isNaN(parsed) ? 0 : parsed;
				} else if(typeof item.offsetY !== 'undefined') {
					const parsed = parseFloat(item.offsetY);
					topVal = baseY + (isNaN(parsed) ? 0 : parsed);
				}
				fig.style.top = topVal + 'px';
				if(item.rot) fig.style.transform = `rotate(${item.rot})`;
				fig.innerHTML = `\n  <img src="${item.src}" alt="${item.alt || ''}" loading="lazy" />\n  <figcaption>${item.caption || ''}</figcaption>\n`;
				frag.appendChild(fig);
			});
			cluster.appendChild(frag);
		})
		.catch(err => console.warn('Polaroid load failed:', err));
})();

// Message carousel logic
(function(){
	const root = document.querySelector('.message-carousel');
	if(!root) return;

	let messages = []; // will be loaded from messages.json

	const prevBtn = root.querySelector('.mc-prev');
	const nextBtn = root.querySelector('.mc-next');
	const viewport = root.querySelector('.mc-viewport');
	let stage = viewport ? viewport.querySelector('.mc-stage') : null;
	const dotsWrap = root.querySelector('.mc-dots');

	if(!prevBtn || !nextBtn || !viewport || !dotsWrap) return;

	let current = 0; let animating = false; let slides = [];

	function buildDots(){
		dotsWrap.innerHTML='';
		messages.forEach((_,i)=>{
			const b=document.createElement('button');
			b.type='button';
			b.setAttribute('role','tab');
			b.setAttribute('aria-label', 'Show message '+(i+1));
			b.addEventListener('click', ()=> goTo(i));
			dotsWrap.appendChild(b);
		});
	}

	function applyDotState(){
		[...dotsWrap.children].forEach((b,i)=>{
			if(i===current){ b.setAttribute('aria-selected','true'); b.tabIndex=0; } else { b.setAttribute('aria-selected','false'); b.tabIndex=-1; }
		});
	}

	function createSlide(i){
		const data = messages[i];
		const art = document.createElement('article');
		art.className='mc-slide';
		art.setAttribute('data-index', i);
		art.setAttribute('tabindex','0');
		// Format timestamp if present
		let dateLine = '';
		if(data.timestamp){
			const d = new Date(data.timestamp);
			if(!isNaN(d.getTime())){
				const mm = String(d.getMonth()+1).padStart(2,'0');
				const dd = String(d.getDate()).padStart(2,'0');
				const yy = String(d.getFullYear()).slice(-2);
				let hrs = d.getHours();
				const min = String(d.getMinutes()).padStart(2,'0');
				const ampm = hrs >= 12 ? 'PM' : 'AM';
				hrs = hrs % 12; if(hrs === 0) hrs = 12; // convert 0 or 12 -> 12, 13 ->1 etc.
				const hh = String(hrs).padStart(2,'0');
				dateLine = `<p class="mc-date" aria-label="Message timestamp">${mm}/${dd}/${yy} ${hh}:${min} ${ampm}</p>`;
			}
		}
		art.innerHTML = `\n <p class="mc-message">${data.text}</p>\n <p class="mc-meta">${data.from}</p>${dateLine?`\n ${dateLine}`:''}\n`;
		return art;
	}

	function updateButtons(){
		// Wrap-around active: we never disable, but you requested disabled state earlier. We'll allow infinite loop but keep subtle disabled removal.
		prevBtn.disabled = false;
		nextBtn.disabled = false;
	}

	function mountInitial(){
		if(!stage){
			stage = document.createElement('div');
			stage.className = 'mc-stage';
			viewport.appendChild(stage);
		}
		stage.innerHTML='';
		if(messages.length === 0){
			const placeholder = document.createElement('article');
			placeholder.className='mc-slide active';
			placeholder.innerHTML='<p class="mc-message">No messages yet.</p><p class="mc-meta" aria-hidden="true">Add some to messages.json</p>';
			stage.appendChild(placeholder);
			slides=[placeholder];
			return; // no dots if empty
		}
		const first = createSlide(0);
		first.classList.add('active');
		stage.appendChild(first);
		slides=[first];
		buildDots();
		applyDotState();
		updateButtons();
	}

	function goTo(target){
		if(animating || target===current) return;
		const dir = target > current ? 'right' : 'left';
		animateTo(target, dir);
	}

	function animateTo(target, direction){
		animating = true;
		if(!stage){ mountInitial(); animating=false; return; }
		const old = stage.querySelector('.mc-slide.active');
		if(!old){ animating=false; return; }
		// Phase 1: fade out old
		old.classList.add('fading-out');
		old.style.transition='opacity .42s ease, transform .42s ease, filter .42s ease';
		const oldHeight = old.getBoundingClientRect().height;
		stage.style.height = oldHeight + 'px'; // lock height for animation
		setTimeout(()=>{
			// Remove old after fade
			old.remove();
			// Phase 2: create and fade in incoming
			const incoming = createSlide(target);
			incoming.classList.add('pre-incoming');
			stage.appendChild(incoming);
			const newH = incoming.getBoundingClientRect().height;
			// Animate stage height from old to new (even if smaller)
			// Animate height change
			requestAnimationFrame(()=>{ stage.style.height = newH + 'px'; });
			requestAnimationFrame(()=>{
				incoming.classList.remove('pre-incoming');
				incoming.classList.add('active');
				incoming.style.transition='opacity .55s ease, transform .55s ease, filter .55s ease';
				incoming.focus({ preventScroll:true });
				setTimeout(()=>{
					stage.style.height='';
					slides=[incoming];
					current = (target + messages.length) % messages.length;
					applyDotState();
					updateButtons();
					animating=false;
				}, 600);
			});
		}, 430);
	}

	function next(){ goTo( (current+1) % messages.length ); }
	function prev(){ goTo( (current-1+messages.length) % messages.length ); }

	prevBtn.addEventListener('click', prev);
	nextBtn.addEventListener('click', next);

	root.addEventListener('keydown', e=>{
		if(e.key==='ArrowRight'){ e.preventDefault(); next(); }
		else if(e.key==='ArrowLeft'){ e.preventDefault(); prev(); }
	});

	// Swipe support (simple)
	let startX=null; let startY=null; const threshold=40;
	viewport.addEventListener('touchstart', e=>{ if(e.touches.length===1){ startX=e.touches[0].clientX; startY=e.touches[0].clientY; }});
	viewport.addEventListener('touchend', e=>{ if(startX===null) return; const dx=e.changedTouches[0].clientX-startX; const dy=e.changedTouches[0].clientY-startY; if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>threshold){ dx<0 ? next(): prev(); } startX=null; startY=null; });

	// Fetch external messages
	fetch('messages.json', { cache: 'no-store' })
		.then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status)))
		.then(list => {
			if(!Array.isArray(list)) throw new Error('Invalid messages format');
			messages = list.filter(m=> m && typeof m.text === 'string' && m.text.trim().length > 0);
			current = 0;
			mountInitial();
		})
		.catch(err => {
			console.warn('Message load failed:', err);
			messages = [];
			mountInitial();
		});
})();