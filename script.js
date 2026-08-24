(() => {
    "use strict";

    const progressBar = document.getElementById("progressBar");
    const skeletonLoading = document.getElementById("skeletonLoading");

    // --- Kijelző felismerés ---
    const isDesktop = window.innerWidth >= 768;
    const videoSrc = isDesktop ? "video1_slow.mp4" : "video_slow.mp4";

    // --- ScrollyVideo.js inicializálás ---
    const scrollyVideo = new ScrollyVideo({
        scrollyVideoContainer: "scrolly-video-container",
        src: videoSrc,
        cover: false,
        trackScroll: false,
        onReady: () => {
            hideLoader();
        }
    });

    // --- iOS Safari fix: Háttérből visszatéréskor a videó dekóder felébresztése ---
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && scrollyVideo && scrollyVideo.video) {
            const current = scrollyVideo.video.currentTime;
            const p = scrollyVideo.video.play();
            if (p !== undefined) {
                p.then(() => {
                    scrollyVideo.video.pause();
                    scrollyVideo.video.currentTime = current;
                }).catch(() => {});
            }
        }
    });

    // --- Loader elrejtése/megjelenítése ---
    let hasHiddenLoader = false;
    function hideLoader() {
        if (!hasHiddenLoader) {
            skeletonLoading.classList.add("hidden");
            hasHiddenLoader = true;
        }
    }
    
    function showLoader() {
        skeletonLoading.classList.remove("hidden");
        hasHiddenLoader = false;
    }

    // --- Biztonsági háló: max 4 másodperc után mindenképp elrejtjük a loadert ---
    setTimeout(() => {
        hideLoader();
    }, 4000);

    // --- BFCache és Vissza gomb probléma (Safari/iOS/Chrome) ---
    // 1. Amikor a felhasználó rákattint a galéria linkre, felhúzzuk a loadert, és visszatekerünk a tetejére
    document.querySelectorAll('a.gallery-link-btn').forEach(link => {
        link.addEventListener('click', (e) => {
            // Ha új lapon nyitja meg, ne avatkozzunk közbe
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            
            e.preventDefault();
            showLoader();
            
            setTimeout(() => {
                // Titokban visszaugorjuk az oldalt a legtetejére a betöltő képernyő mögött
                window.scrollTo(0, 0);
                targetProgress = 0;
                currentVideoProgress = 0;
                if (scrollyVideo && typeof scrollyVideo.setTargetTimePercent === 'function') {
                    scrollyVideo.setTargetTimePercent(0);
                }
                
                // Majd továbbítjuk a galériára
                window.location.href = link.href;
            }, 400); // 400ms hagy időt a fade-in animációnak
        });
    });

    // 2. Ha a böngésző "Vissza" gombjával jön, a BFCache azonnal visszaadja az oldalt
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            // Biztosítjuk, hogy a tetején állunk
            window.scrollTo(0, 0);
            targetProgress = 0;
            currentVideoProgress = 0;
            if (scrollyVideo && typeof scrollyVideo.setTargetTimePercent === 'function') {
                scrollyVideo.setTargetTimePercent(0);
            }
            
            // Rövid idő után eltüntetjük a betöltőt
            setTimeout(() => {
                hideLoader();
            }, 200);
        }
    });

    // --- Scroll progress bar és egyedi videó vezérlés ---
    function getScrollProgress() {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        
        // Kiszámoljuk az "effektív" görgetést (kivonjuk belőle a sticky zónákban töltött időt)
        let pausedScroll = 0;
        let maxPausedScroll = 0;
        const sections = Array.from(document.querySelectorAll('.content-section'));
        
        sections.forEach(sec => {
            const top = sec.offsetTop;
            const pauseDuration = Math.max(0, sec.offsetHeight - window.innerHeight);
            if (pauseDuration > 0) {
                if (scrollY > top) {
                    pausedScroll += Math.min(scrollY - top, pauseDuration);
                }
                maxPausedScroll += pauseDuration;
            }
        });
        
        const effectiveScroll = scrollY - pausedScroll;
        const effectiveMaxScroll = maxScroll - maxPausedScroll;
        
        return effectiveMaxScroll > 0 ? Math.max(0, Math.min(1, effectiveScroll / effectiveMaxScroll)) : 0;
    }

    let targetProgress = 0;
    let currentVideoProgress = 0;
    let isRendering = false;
    const EASING = 0.05; // Minél kisebb, annál lágyabban lassul le és gyorsul fel

    window.addEventListener("scroll", () => {
        targetProgress = getScrollProgress();
        progressBar.style.transform = `scaleX(${targetProgress})`;
        
        // Ha nem fut a renderelés, elindítjuk
        if (!isRendering) {
            isRendering = true;
            requestAnimationFrame(renderSmoothVideo);
        }
    }, { passive: true });

    function renderSmoothVideo() {
        const diff = targetProgress - currentVideoProgress;
        
        // Csak akkor frissítünk, ha még van érdemi különbség (0.0001 pontosság)
        if (Math.abs(diff) > 0.0001) {
            currentVideoProgress += diff * EASING;
            
            if (scrollyVideo) {
                if (typeof scrollyVideo.setTargetTimePercent === 'function') {
                    scrollyVideo.setTargetTimePercent(currentVideoProgress);
                } else if (scrollyVideo.video && !isNaN(scrollyVideo.video.duration)) {
                    scrollyVideo.setTargetTime(currentVideoProgress * scrollyVideo.video.duration);
                }
            }
            
            // Nappal-Éjszaka átmenet és Audio Crossfade kiszámítása
            const nightOverlay = document.getElementById('night-overlay');
            if (nightOverlay) {
                let nightRatio = 0;
                // 40% görgetésig nappal, 40-60% között átmenet, 60% felett éjszaka
                if (currentVideoProgress > 0.6) {
                    nightRatio = 1;
                } else if (currentVideoProgress > 0.4) {
                    nightRatio = (currentVideoProgress - 0.4) / 0.2;
                }
                
                // Optikai átmenet
                nightOverlay.style.opacity = nightRatio;
                
                // Zenei átmenet
                if (typeof window.isPlaying !== 'undefined' && window.isPlaying) {
                    // A böngészők audio volume-ja 0 és 1 közötti érték
                    if (window.birdsAudio) window.birdsAudio.volume = Math.max(0, 1 - nightRatio);
                    if (window.cricketsAudio) window.cricketsAudio.volume = nightRatio;
                }
            }
            
            requestAnimationFrame(renderSmoothVideo);
        } else {
            // Megállítjuk a ciklust, amíg a felhasználó újra nem görget
            currentVideoProgress = targetProgress; // Pontosítjuk a legvégét
            isRendering = false;
        }
    }
    
    // Kezdeti indítás
    isRendering = true;
    requestAnimationFrame(renderSmoothVideo);

    // --- Fade-in animációk Observer (Teljesítmény-barát) ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // 15% láthatóság esetén aktiválódik
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Ha egyszer beúszott, nem animáljuk újra, hogy kíméljük a gépet
                // observer.unobserve(entry.target); 
                // Jelenleg hagyjuk, hogy el- és feltűnjön görgetéskor, mivel könnyű animáció
            } else {
                entry.target.classList.remove('is-visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.fade-in-section').forEach(section => {
        observer.observe(section);
    });

    // --- Kettős Természethang (Nappal -> Éjszaka) ---
    window.isPlaying = false;
    window.birdsAudio = new Audio('birds.mp3');
    window.cricketsAudio = new Audio('crickets.mp3');
    
    // Folyamatos ismétlés beállítása
    window.birdsAudio.loop = true;
    window.cricketsAudio.loop = true;
    
    const iconMuted = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
    const iconPlaying = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

    const audioToggle = document.getElementById('audioToggle');
    if (audioToggle) {
        audioToggle.addEventListener('click', () => {
            if (!window.isPlaying) {
                // A hangerőt a jelenlegi görgetés alapján (nightRatio) állítja be a renderSmoothVideo
                window.birdsAudio.play().catch(e => console.log('Audio lejátszási hiba:', e));
                window.cricketsAudio.play().catch(e => console.log('Audio lejátszási hiba:', e));
                
                audioToggle.querySelector('.icon').innerHTML = iconPlaying;
                audioToggle.classList.add('playing');
                window.isPlaying = true;
            } else {
                window.birdsAudio.pause();
                window.cricketsAudio.pause();
                
                audioToggle.querySelector('.icon').innerHTML = iconMuted;
                audioToggle.classList.remove('playing');
                window.isPlaying = false;
            }
        });
    }

})();
