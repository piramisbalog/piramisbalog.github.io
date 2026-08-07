(() => {
    "use strict";

    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const progressBar = document.getElementById("progressBar");
    const skeletonLoading = document.getElementById("skeletonLoading");
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const menuList = document.getElementById("menuList");

    const canvas = document.getElementById("sequenceCanvas");
    const context = canvas.getContext("2d");

    const frameCount = 192;
    const images = new Array(frameCount + 1).fill(null);
    let targetFrame = 1;
    let currentLerpedFrame = 1;
    let lastDrawnFrame = 0; // az utoljára ténylegesen kirajzolt (akár fallback) frame indexe
    let lastDrawWasExact = true; // false, ha a lastDrawnFrame csak fallback volt, nem a pontos cél
    let hasHiddenLoader = false;

    const currentFramePath = index => `frames1/frame_${index.toString().padStart(4, '0')}.webp`;

    function isReady(img) {
        return !!(img && img.complete && img.naturalWidth > 0);
    }

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // 2x-nél ne pazaroljunk memóriát/GPU-t
        const w = window.innerWidth;
        const h = window.innerHeight;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Ha van már kirajzolt kép, rajzolja újra, különben próbálja az elsőt
        const img = images[lastDrawnFrame] || images[1];
        if (isReady(img)) {
            renderImage(img);
        }
    }

    // Debounce: mobil címsor be/ki csúszásnál ne fusson feleslegesen sokszor
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 100);
    });

    function renderImage(img) {
        if (!isReady(img)) return false;

        // Fontos: a logikai (CSS) méretekkel számolunk, mert a context már
        // transzformálva van a devicePixelRatio-val (lásd resizeCanvas).
        const cw = window.innerWidth;
        const ch = window.innerHeight;

        const hRatio = cw / img.width;
        const vRatio = ch / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (cw - img.width * ratio) / 2;
        const centerShift_y = (ch - img.height * ratio) / 2;

        context.clearRect(0, 0, cw, ch);
        context.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
        return true;
    }

    // Okos Előtöltés (Smart Preload)
    const preloadImages = () => {
        const preloadContainer = document.createElement('div');
        preloadContainer.style.display = 'none';
        document.body.appendChild(preloadContainer);

        const loadImage = (index) => {
            return new Promise((resolve) => {
                if (images[index]) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.decoding = "async";
                img.src = currentFramePath(index);

                const finish = () => {
                    images[index] = img;
                    preloadContainer.appendChild(img);

                    if (index === 1) {
                        renderImage(img);
                        lastDrawnFrame = 1;
                        if (!hasHiddenLoader) {
                            skeletonLoading.classList.add("hidden");
                            hasHiddenLoader = true;
                        }
                    }
                    resolve();
                };

                // img.decode() előre elvégzi a pixel-dekódolást a háttérben,
                // mielőtt a kép egyáltalán kirajzolásra kerülne. Enélkül az
                // ELSŐ drawImage() hívás szinkron dekódol — ez okozza az
                // apró akadást pont akkor, amikor a kép "előkerül" scroll közben.
                img.onload = () => {
                    if (img.decode) {
                        img.decode().then(finish).catch(finish);
                    } else {
                        finish();
                    }
                };
                img.onerror = resolve;
            });
        };

        const loadSkeleton = async () => {
            const skeletonPromises = [];
            for (let i = 1; i <= frameCount; i += 10) {
                skeletonPromises.push(loadImage(i));
            }
            await Promise.all(skeletonPromises);
        };

        // Párhuzamos, kötegelt betöltés: a böngésző mobilon is jellemzően
        // 6 párhuzamos kapcsolatot enged host-onként — ezt kihasználva
        // sokkal gyorsabban feltöltődnek a hiányzó közbenső képek,
        // mint egyesével, sorban várva egymásra.
        const CONCURRENCY = 6;
        const loadRemaining = async () => {
            const missing = [];
            for (let i = 1; i <= frameCount; i++) {
                if (!images[i]) missing.push(i);
            }

            let cursor = 0;
            async function worker() {
                while (cursor < missing.length) {
                    const i = missing[cursor++];
                    await loadImage(i);
                }
            }

            const workers = Array.from({ length: CONCURRENCY }, worker);
            await Promise.all(workers);
        };

        loadSkeleton().then(() => {
            loadRemaining();
        });
    };

    function getScrollProgress() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        return maxScroll > 0 ? Math.max(0, Math.min(1, scrollTop / maxScroll)) : 0;
    }

    const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

    // Ha a pontos kép nincs kész, keresi a legközelebbi betöltött framet
    // MINDKÉT irányban, korlátozott sugárban (ne fusson végig 240 elemen feleslegesen).
    const FALLBACK_RADIUS = 30;
    function findNearestReady(frame) {
        if (isReady(images[frame])) return { img: images[frame], index: frame };

        for (let d = 1; d <= FALLBACK_RADIUS; d++) {
            const down = frame - d;
            const up = frame + d;
            if (down >= 1 && isReady(images[down])) return { img: images[down], index: down };
            if (up <= frameCount && isReady(images[up])) return { img: images[up], index: up };
        }
        return null;
    }

    function animate() {
        const progress = getScrollProgress();
        progressBar.style.transform = `scaleX(${progress})`;

        targetFrame = Math.min(frameCount, Math.max(1, Math.floor(progress * frameCount) + 1));

        // Ha a lerp már gyakorlatilag beérte a célt ÉS a legutóbb kirajzolt
        // kép pontos volt, nincs értelme tovább lerp-elni vagy a fallback-et
        // keresgélni minden egyes framen — ez csak felesleges CPU-munka,
        // ami hosszabb görgetésnél hozzáadódik az összképhez.
        const distanceToTarget = Math.abs(targetFrame - currentLerpedFrame);
        const settled = distanceToTarget < 0.05 && lastDrawWasExact && lastDrawnFrame === targetFrame;

        if (!settled) {
            currentLerpedFrame = lerp(currentLerpedFrame, targetFrame, 0.08);
            const frameToDraw = Math.round(currentLerpedFrame);

            if (frameToDraw !== lastDrawnFrame || !lastDrawWasExact) {
                const found = findNearestReady(frameToDraw);
                if (found) {
                    renderImage(found.img);
                    lastDrawnFrame = found.index;
                    lastDrawWasExact = (found.index === frameToDraw);
                }
                // Ha semmi nincs a közelben betöltve, egyszerűen kihagyjuk ezt
                // a framet, és a következő rAF-ban újra próbálkozunk.
            }
        }

        requestAnimationFrame(animate);
    }

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

    resizeCanvas();
    preloadImages();
    animate();

    setTimeout(() => {
        if (!hasHiddenLoader) {
            skeletonLoading.classList.add("hidden");
            hasHiddenLoader = true;
        }
    }, 3000);

})();
