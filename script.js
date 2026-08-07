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
    
    // JAVÍTÁS: Array helyett Map-et használunk, hogy törölni tudjuk a régi képeket a RAM-ból
    const imageCache = new Map();
    let targetFrame = 1;
    let currentLerpedFrame = 1;
    let lastDrawnFrame = 0;
    let hasHiddenLoader = false;

    const currentFramePath = index => `frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    // JAVÍTÁS: Memória menedzsment (Sliding Window Loader)
    function getAndCleanImage(index) {
        if (imageCache.has(index)) return imageCache.get(index);

        const img = new Image();
        img.src = currentFramePath(index);
        imageCache.set(index, img);

        // Töröljük a memóriából azokat a képeket, amik több mint 25 képkockára vannak az aktuálistól (iOS crash ellen)
        for (const key of imageCache.keys()) {
            if (Math.abs(key - index) > 25) {
                const oldImg = imageCache.get(key);
                oldImg.src = ""; // Nullázzuk, hogy az Apple GC (Garbage Collector) kitörölje
                imageCache.delete(key);
            }
        }
        return img;
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const img = imageCache.get(lastDrawnFrame) || imageCache.get(1);
        if (img) renderImage(img);
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

    const preloadImages = () => {
        // Induláskor csak az első 10-et töltjük be 240 helyett!
        for (let i = 1; i <= 10; i++) {
            const img = getAndCleanImage(i);
            if (i === 1) {
                img.onload = () => {
                    renderImage(img);
                    if (!hasHiddenLoader) {
                        skeletonLoading.classList.add("hidden");
                        hasHiddenLoader = true;
                    }
                };
            }
        }
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
        
        // Előtöltjük a következő pár képkockát folyamatosan a háttérben
        for (let i = 0; i <= 3; i++) {
            if (frameToDraw + i <= frameCount) getAndCleanImage(frameToDraw + i);
        }
        
        const imgToDraw = getAndCleanImage(frameToDraw);
        
        // Csak akkor mentjük el "kirajzolt" állapotúnak, ha tényleg kész
        if (frameToDraw !== lastDrawnFrame && imgToDraw.complete && imgToDraw.naturalWidth > 0) {
            renderImage(imgToDraw);
            lastDrawnFrame = frameToDraw;
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


