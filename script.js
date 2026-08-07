/* script.js */
(() => {
    "use strict";

    // Gördülési pozíció visszaállításának tiltása frissítéskor
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const progressBar = document.getElementById("progressBar");
    const skeletonLoading = document.getElementById("skeletonLoading");
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const menuList = document.getElementById("menuList");

    const canvas = document.getElementById("sequenceCanvas");
    const context = canvas.getContext("2d", { alpha: false }); // Teljesítményoptimalizálás: nincs alpha csatorna

    const frameCount = 240;
    const images = new Array(frameCount + 1);
    
    let currentFrameIndex = 1;
    let lastDrawnFrame = -1;
    let hasHiddenLoader = false;
    let isTicking = false;

    const currentFramePath = index => `frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    // Canvas átméretezése Retina / HiDPI kijelző támogatással a tűéles megjelenítésért
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        
        context.scale(dpr, dpr);
        
        if (images[currentFrameIndex] && images[currentFrameIndex].complete) {
            renderImage(images[currentFrameIndex]);
        }
    }
    window.addEventListener("resize", resizeCanvas);

    // Kép kirajzolása "object-fit: cover" logikával
    function renderImage(img) {
        if (!img || !img.complete || img.naturalWidth === 0) return;
        
        const canvasWidth = window.innerWidth;
        const canvasHeight = window.innerHeight;
        
        const hRatio = canvasWidth / img.width;
        const vRatio = canvasHeight / img.height;
        const ratio = Math.max(hRatio, vRatio);
        
        const centerShift_x = (canvasWidth - img.width * ratio) / 2;
        const centerShift_y = (canvasHeight - img.height * ratio) / 2;
        
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.drawImage(img, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
    }

    // Hatékony előtöltési stratégia (Smart Preload DOM manipuláció nélkül)
    const preloadImages = () => {
        let loadedCount = 0;

        const loadImage = (index) => {
            return new Promise((resolve) => {
                if (images[index]) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.src = currentFramePath(index);
                
                img.onload = () => {
                    images[index] = img;
                    loadedCount++;

                    // Ha az első kép megvan, eltüntetjük a loadert
                    if (index === 1 && !hasHiddenLoader) {
                        renderImage(img);
                        skeletonLoading.classList.add("hidden");
                        hasHiddenLoader = true;
                    }
                    resolve();
                };
                img.onerror = () => resolve(); // Hibakezelés: ne akadjon el a Promise
            });
        };

        // 1. Fázis: Elsődleges váz betöltése (minden 5. kép a gyors válaszidőért)
        const loadSkeletonFrames = async () => {
            const promises = [];
            for (let i = 1; i <= frameCount; i += 5) {
                promises.push(loadImage(i));
            }
            await Promise.all(promises);
        };

        // 2. Fázis: A maradék képek háttérbeli betöltése
        const loadRemainingFrames = async () => {
            for (let i = 1; i <= frameCount; i++) {
                if (!images[i]) {
                    await loadImage(i);
                }
            }
        };

        loadSkeletonFrames().then(() => {
            loadRemainingFrames();
        });
    };

    // Görgetési progress kiszámítása
    function updateScrollAnimation() {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollTop / maxScroll)) : 0;

        // Progress bar frissítése
        progressBar.style.transform = `scaleX(${progress})`;

        // Cél képkocka meghatározása
        const targetFrame = Math.min(frameCount, Math.max(1, Math.floor(progress * (frameCount - 1)) + 1));
        currentFrameIndex = targetFrame;

        // Csak akkor rajzolunk újra, ha változott a képkocka, ÉS a kép elérhető a memóriában
        if (currentFrameIndex !== lastDrawnFrame) {
            let imgToDraw = images[currentFrameIndex];

            // Tartalék mechanizmus: Ha a pontos kép még nem töltődött le, keressük a legközelebbi meglévőt
            if (!imgToDraw || !imgToDraw.complete) {
                for (let i = currentFrameIndex; i >= 1; i--) {
                    if (images[i] && images[i].complete) {
                        imgToDraw = images[i];
                        break;
                    }
                }
            }

            if (imgToDraw && imgToDraw.complete) {
                renderImage(imgToDraw);
                lastDrawnFrame = currentFrameIndex;
            }
        }

        isTicking = false;
    }

    // Scroll eseménykezelő requestAnimationFrame optimalizációval (Nincs felesleges CPU terhelés)
    window.addEventListener("scroll", () => {
        if (!isTicking) {
            window.requestAnimationFrame(updateScrollAnimation);
            isTicking = true;
        }
    }, { passive: true });

    // Mobil menü kezelése
    function toggleMenu() {
        const active = menuList.classList.toggle("active");
        hamburgerBtn.setAttribute("aria-expanded", String(active));
    }

    hamburgerBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
    hamburgerBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMenu(); }
    });

    document.querySelectorAll(".menu-list a").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute("href"));
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
            menuList.classList.remove("active");
            hamburgerBtn.setAttribute("aria-expanded", "false");
        });
    });

    document.addEventListener("click", (e) => {
        if (!hamburgerBtn.contains(e.target) && !menuList.contains(e.target)) {
            menuList.classList.remove("active");
            hamburgerBtn.setAttribute("aria-expanded", "false");
        }
    });

    // Inicializálás
    resizeCanvas();
    preloadImages();

    // Biztonsági időzítő a loader eltüntetésére, ha valamiért elakadna a hálózat
    setTimeout(() => {
        if (!hasHiddenLoader) {
            skeletonLoading.classList.add("hidden");
            hasHiddenLoader = true;
        }
    }, 4000);

})();
