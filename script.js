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
    const context = canvas.getContext("2d", { alpha: false }); 

    const frameCount = 240;
    const images = [];
    let targetFrame = 1;
    let currentLerpedFrame = 1;
    let lastDrawnFrame = 0;
    let hasHiddenLoader = false;

    const currentFramePath = index => `frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderImage(images[lastDrawnFrame] || images[1]);
    }
    window.addEventListener("resize", resizeCanvas);

    function renderImage(img) {
        if (!img || !img.complete) return;
        
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
    }

    const preloadImages = () => {
        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            img.src = currentFramePath(i);
            images[i] = img;
            
            img.onload = () => {
                if (i === 1) {
                    renderImage(img);
                    if (!hasHiddenLoader) {
                        skeletonLoading.classList.add("hidden");
                        hasHiddenLoader = true;
                    }
                }
            };
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
        
        if (frameToDraw !== lastDrawnFrame && images[frameToDraw]) {
            renderImage(images[frameToDraw]);
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
