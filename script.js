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

    const frameCount = 240;
    const images = new Array(frameCount + 1).fill(null);
    let targetFrame = 1;
    let currentLerpedFrame = 1;
    let lastDrawnFrame = 0;
    let hasHiddenLoader = false;

    const currentFramePath = index => `frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Ha van már kirajzolt kép, rajzolja újra, különben próbálja az elsőt
        const img = images[lastDrawnFrame] || images[1];
        if (img && img.complete) {
            renderImage(img);
        }
    }
    window.addEventListener("resize", resizeCanvas);

    function renderImage(img) {
        if (!img || !img.complete || img.naturalWidth === 0) return false;
        
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
        return true;
    }

    // Okos Előtöltés (Smart Preload)
    const preloadImages = () => {
        // 1. lépés: Hozzunk létre egy rejtett konténert a DOM-ban.
        // Ezzel kényszerítjük a böngészőt (főleg a Safarit), hogy ne törölje a RAM-ból a képeket, 
        // mintha csak egy JS objektumban lennének.
        const preloadContainer = document.createElement('div');
        preloadContainer.style.display = 'none';
        document.body.appendChild(preloadContainer);

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
                    preloadContainer.appendChild(img); // Hozzáadjuk a DOM-hoz
                    loadedCount++;

                    if (index === 1) {
                        renderImage(img);
                        if (!hasHiddenLoader) {
                            skeletonLoading.classList.add("hidden");
                            hasHiddenLoader = true;
                        }
                    }
                    resolve();
                };
                img.onerror = resolve; // Ha hiba van, akkor is lépjen tovább
            });
        };

        // 2. lépés: Prioritásos betöltés
        // Először betöltjük minden 10. képet, hogy gyors tekerésnél meglegyen a "váz"
        const loadSkeleton = async () => {
            const skeletonPromises = [];
            for (let i = 1; i <= frameCount; i += 10) {
                skeletonPromises.push(loadImage(i));
            }
            await Promise.all(skeletonPromises);
        };

        // 3. lépés: Betöltjük a maradékot szekvenciálisan
        const loadRemaining = async () => {
            for (let i = 1; i <= frameCount; i++) {
                if (!images[i]) {
                    await loadImage(i);
                }
            }
        };

        // Futtatjuk a stratégiát
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

    function animate() {
        const progress = getScrollProgress();
        progressBar.style.transform = `scaleX(${progress})`;
        
        targetFrame = Math.min(frameCount, Math.max(1, Math.floor(progress * frameCount) + 1));
        currentLerpedFrame = lerp(currentLerpedFrame, targetFrame, 0.08);
        
        const frameToDraw = Math.round(currentLerpedFrame);
        
        if (frameToDraw !== lastDrawnFrame) {
            // Megpróbáljuk a pontos képkockát kirajzolni
            let imgToDraw = images[frameToDraw];
            
            // Ha a pontos kép még nincs letöltve (hiányzó közép hiba elkerülése), 
            // keressük meg a legközelebbi már betöltött képet lefelé.
            if (!imgToDraw || !imgToDraw.complete) {
                for (let i = frameToDraw - 1; i >= 1; i--) {
                    if (images[i] && images[i].complete) {
                        imgToDraw = images[i];
                        break;
                    }
                }
            }

            if (imgToDraw && imgToDraw.complete && imgToDraw.naturalWidth > 0) {
                renderImage(imgToDraw);
                lastDrawnFrame = frameToDraw; // Ide csak a cél frame-et írjuk, hogy a lerp ne akadjon meg
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
```eof

**Mi változott? Miért oldja meg ez a hiányzó részeket és a szaggatást?**

1.  **A Memória-trükk (`preloadContainer`):** Nem csak egy JS-tömbbe rakjuk a képeket, hanem ténylegesen hozzáadjuk őket a weblap forráskódjához (DOM), de egy elrejtett (`display: none`) mezőbe. A böngészők (főleg a mobilok) a DOM-ban lévő elemeket sokkal kevésbé merik törölni a memóriából, mint a levegőben lógó JS objektumokat.
2.  **Okos betöltés ("Skeleton" Load):** Nem próbálja egyszerre letölteni az 1, 2, 3... 240. képet (ami bedugítaná a hálózatot és a közepénél feladná). Ehelyett **először** letölti az 1., 10., 20., 30. stb. képeket. Így ha gyorsan végiggörgetsz az oldalon, már meglesz az animáció váza. Csak ezután, a háttérben tölti be a maradékot (2, 3, 4, 5...).
3.  **Hibás kockák átugrása:** Az `animate` hurokban van egy új ellenőrzés. Ha a 125. képkockához érsz, de az a lassú internet miatt még nincs letöltve, a rendszer **nem** rajzol feketét, és **nem** fagy le, hanem villámgyorsan visszakeres egy olyan képet (pl. a 120-ast), ami már le van töltve, és azt mutatja, amíg a többi meg nem érkezik.
