(() => {
  "use strict";

  // ===== Security / Robustness helpers =====
  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
  function toInt(s, def) { const n = parseInt(s, 10); return Number.isFinite(n) ? n : def; }

  // ===== Base Path & Asset Logic =====
  // Detects if running on root (Render) or subpath (GitHub Pages)
  const BASE = (() => {
    const p = window.location.pathname;
    const repo = "QURAN-"; // Change this if your repo name is different
    if (p.startsWith(`/${repo}/`)) return `/${repo}/`;
    return "/";
  })();

  const assetUrl = (rel) => {
    // Ensure relative path doesn't start with /
    const cleanRel = rel.replace(/^\/+/, "");
    return new URL(cleanRel, window.location.origin + BASE).toString();
  };

  // ===== Config =====
  const PAGES_JSON = assetUrl("assets/pages.json");
  const SURAHS_JSON = assetUrl("assets/surahs.json");
  
  const STORAGE = {
    page: "quran_page_v2",
    zoom: "quran_zoom_v2",
    spread: "quran_spread_v2",
    sound: "quran_sound_v2",
    bookmark: "quran_bookmark_v2",
    lastVisit: "quran_last_visit",
    readingPage: "quran_reading_page"
  };

  // ... (keeping DOM elements same) ...

  // ===== State =====
  let pages = [];         
  let surahs = [];
  let pageFlip = null;    
  let pageCount = 0;
  let currentPage = 1;

  let isSpread = true;    
  let zoom = 1.0;
  let savedBookmark = 0; 

  // Track last reading page
  let lastReadingPage = toInt(load(STORAGE.readingPage, "0"), 0);
  let lastVisit = load(STORAGE.lastVisit, "");

  // Audio: page flip sound
  const pageSound = new Audio(assetUrl("assets/page.mp3"));
  pageSound.preload = "auto";
  pageSound.volume = 0.65;

  let soundEnabled = true;

  function setStatus(msg) { statusEl.textContent = msg; }
  function save(key, val) { try { localStorage.setItem(key, String(val)); } catch (_) {} }
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return (v === null || v === undefined || v === "") ? fallback : v;
    } catch (_) { return fallback; }
  }

  function detectMobile() {
    return window.matchMedia("(max-width: 980px)").matches;
  }
  
  // Resume reading feature - now uses bookmark
  function updateReadingProgress() {
    // Still save last page for future use
    save(STORAGE.readingPage, currentPage);
    save(STORAGE.lastVisit, new Date().toISOString());
    lastReadingPage = currentPage;
  }
  
  function updateResumeButton() {
    // Show button if there's a bookmark and we're not on it
    if (savedBookmark > 0 && savedBookmark !== currentPage && pageCount > 0) {
      resumeBtn.style.display = "flex";
      resumeBtn.textContent = "📖 إكمال القراءة";
      resumeBtn.title = `العودة للعلامة المحفوظة (صفحة ${savedBookmark})`;
    } else {
      resumeBtn.style.display = "none";
    }
  }
  
  resumeBtn.onclick = () => {
    if (pageFlip && savedBookmark > 0) {
      pageFlip.flip(savedBookmark - 1);
    }
  };

  function playFlipSound() {
    if (!soundEnabled) return;
    try {
      // Immediate playback
      pageSound.pause();
      pageSound.currentTime = 0;
      const playPromise = pageSound.play();
      if (playPromise !== undefined) {
          playPromise.catch(() => {});
      }
    } catch (_) {}
  }

  function updateUI(curr) {
    currentPage = curr;
    pageInput.value = String(curr);
    prevBtn.disabled = curr <= 1;
    nextBtn.disabled = curr >= pageCount;
    
    // Update reading progress
    updateReadingProgress();
    updateResumeButton();
    
    // Update bookmark ribbon visibility
    const isBookmark = savedBookmark === curr;
    bookmarkRibbon.classList.toggle("hidden", !isBookmark);
    if (isBookmark) {
      bookmarkBtn.style.color = "#e74c3c"; // highlighted
    } else {
      bookmarkBtn.style.color = ""; 
    }

    // Highlight current surah in sidebar (optional performance cost, can skip if slow)
    // findSurahForPage(curr);
  }

  // ===== Book / PageFlip =====
  function buildPagesDom() {
    elBook.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (let i = 0; i < pages.length; i++) {
      const page = document.createElement("div");
      page.className = "page";

      const img = document.createElement("img");
      // img.loading = "lazy"; // Removed to fix black screen in zoom mode
      img.alt = `صفحة ${i + 1}`;
      img.src = assetUrl(pages[i]);
      // CSS now handles width, height, objectFit, and transform

      page.appendChild(img);
      frag.appendChild(page);
    }
    elBook.appendChild(frag);
  }

  function createPageFlip() {
    // 2) تعديل صغير داخل createPageFlip (يمنع “0 size”)
    // تأكد أن الحاوية لها قياس قبل إنشاء PageFlip
    const rect = elBook.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      // جرّب مرة ثانية في الإطار القادم بدل إنشاء نسخة “فاضية”
      requestAnimationFrame(createPageFlip);
      return;
    }

    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }

    const mobile = detectMobile();
    const useSpread = mobile ? false : isSpread;

    modeLabel.textContent = useSpread ? "الوضع: صفحتين (عادي)" : "الوضع: صفحة واحدة (مكبر)";
    
    // Determine start page (0-based index)
    // If we are currently at page X, start there.
    // Safety check: ensure we don't start out of bounds.
    let  startIndex = currentPage - 1;
    if (startIndex < 0) startIndex = 0;
    if (startIndex >= pageCount) startIndex = pageCount - 1;

    pageFlip = new St.PageFlip(elBook, {
      width: useSpread ? 700 : 900,
      height: 1200,
      size: "stretch",
      minWidth: 300,
      maxWidth: 2000,
      minHeight: 400,
      maxHeight: 2500,
      maxShadowOpacity: 0.2,
      showCover: false,
      mobileScrollSupport: true,
      swipeDistance: mobile ? 15 : 30, // Much shorter on mobile
      clickEventForward: true,
      useMouseEvents: true,
      flippingTime: mobile ? 400 : 500, // Faster on mobile
      startZIndex: 10,
      drawShadow: true,
      autoSize: true,
      usePortrait: !useSpread,
      startPage: startIndex
      // No rtl - CSS handles mirroring
    });

    pageFlip.loadFromHTML(document.querySelectorAll(".page"));
    // Note: We do NOT call applyZoom here instantly because it might conflict with init?
    // Actually safe to call it.
    applyZoom();

    pageFlip.on("flip", (e) => {
      const curr = e.data + 1;
      updateUI(curr);
      save(STORAGE.page, curr);
      playFlipSound();
    });

    setStatus("جاهز ✅");
  }

  function applyZoom() {
    zoom = clamp(zoom, 0.7, 3.0); 
    updateZoomLabel();
    save(STORAGE.zoom, zoom);
    
    // خلي التحجيم على .bookWrap بدل #book
    const wrap = document.querySelector(".bookWrap");
    if (wrap) {
      wrap.style.transform = `scale(${zoom})`;
      wrap.style.transformOrigin = "center center";
    }
  }
  
  function updateZoomLabel() {
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  // ===== Sidebar / Index =====
  function toggleSidebar() {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  }

  // OFFSET LOGIC
  // Fatiha (Page 1 of standard Quran) is at page 4 in our PDF
  // So offset = 3
  let pageOffset = 3; // Fixed offset, no calibration needed

  function renderSurahs(list) {
    surahList.innerHTML = "";
    
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.padding="10px"; empty.style.color="#888"; empty.innerText="لا توجد نتائج";
      surahList.appendChild(empty);
      return;
    }
    
    const frag = document.createDocumentFragment();
    list.forEach(s => {
      const div = document.createElement("div");
      div.className = "surah-item";
      div.innerHTML = `
        <span class="surah-num">${s.id}</span>
        <span class="surah-name">${s.name}</span>
        <span class="surah-page">ص ${s.page}</span>
      `;
      div.onclick = () => {
        // Go to page with OFFSET
        if(pageFlip) {
            // Target is standard page + offset
            let dest = s.page + pageOffset;
            dest = clamp(dest, 1, pageCount);
            
            // To ensure we see the page, we just flip to it.
            // PageFlip is 0-indexed, so -1.
            pageFlip.flip(dest - 1);
            updateUI(dest);
        }
        toggleSidebar();
      };
      frag.appendChild(div);
    });
    surahList.appendChild(frag);
  }

  async function loadData() {
    setStatus("جارٍ تحميل البيانات…");
    
    // Config
    zoom = clamp(Number.parseFloat(load(STORAGE.zoom, "1.0")), 0.7, 2.5);
    isSpread = load(STORAGE.spread, "1") === "1";
    soundEnabled = load(STORAGE.sound, "1") === "1";
    soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
    savedBookmark = toInt(load(STORAGE.bookmark, "0"), 0);
    
    // Fatiha is at page 4 (004.jpg) after adding it back to pages.json
    const savedPage = toInt(load(STORAGE.page, "4"), 4);
    currentPage = clamp(savedPage, 1, 999);

    try {
      // 1. Surahs
      const resS = await fetch(SURAHS_JSON);
      if(resS.ok) {
        surahs = await resS.json();
        renderSurahs(surahs);
      }

      // 2. Pages
      const resP = await fetch(PAGES_JSON, {cache: "no-store"});
      if(!resP.ok) throw new Error("pages.json missing");
      const data = await resP.json();
      if(!Array.isArray(data.pages)) throw new Error("Invalid pages");
      
      pages = data.pages;
      pageCount = pages.length;
      pageCountEl.textContent = `/ ${pageCount}`;
      pageInput.max = pageCount;
      pageInput.min = 1;

      buildPagesDom();
      createPageFlip();
      
      // Show welcome back notification if there's a bookmark
      if (savedBookmark > 0 && savedBookmark !== currentPage) {
        setTimeout(() => {
          setStatus(`مرحباً بعودتك! 🔖 لديك علامة محفوظة عند صفحة ${savedBookmark}`);
          updateResumeButton();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setStatus("خطأ في التحميل: " + err.message);
    }
  }

  // ===== Events =====
  prevBtn.onclick = () => pageFlip && pageFlip.flipPrev(); // السابق
  nextBtn.onclick = () => pageFlip && pageFlip.flipNext(); // التالي
  
  pageInput.onchange = () => {
    if(!pageFlip) return;
    const n = clamp(toInt(pageInput.value, 1), 1, pageCount);
    pageFlip.flip(n - 1);
  };

  zoomInBtn.onclick = () => { zoom += 0.15; applyZoom(); };
  zoomOutBtn.onclick = () => { zoom -= 0.15; applyZoom(); };

  spreadToggle.onclick = () => {
    if (!pageFlip) return;

    // بدّل الوضع فقط
    if (detectMobile()) {
      isSpread = false;
    } else {
      isSpread = !isSpread;
    }
    save(STORAGE.spread, isSpread ? "1" : "0");

    const mobile = detectMobile();
    const useSpread = mobile ? false : isSpread;

    modeLabel.textContent = useSpread ? "الوضع: صفحتين (عادي)" : "الوضع: صفحة واحدة (مكبر)";

    // مهم: لا destroy.. فقط حدّث القياسات
    try {
      // بعض نسخ المكتبة تدعم update، وبعضها updateFromHtml
      if (typeof pageFlip.update === "function") {
        pageFlip.update({
          usePortrait: !useSpread,
          width: useSpread ? 720 : 900,
          height: 1200,
        });
      } else if (typeof pageFlip.updateFromHtml === "function") {
        pageFlip.updateFromHtml(document.querySelectorAll(".page"));
      }

      // أعد رسم المقاس
      pageFlip.getUI()?.update?.(); // لو موجود
      pageFlip.updateState?.();     // لو موجود

      // احتياط: نعمل resize event
      window.dispatchEvent(new Event("resize"));
    } catch (_) {}

    // حافظ على الصفحة الحالية
    try {
      pageFlip.flip(currentPage - 1);
    } catch (_) {}

    applyZoom();
  };

  fullscreenBtn.onclick = async () => {
    if(!document.fullscreenElement) await document.documentElement.requestFullscreen().catch(()=>{});
    else await document.exitFullscreen().catch(()=>{});
  };

  // Audio
  const pageAudio = new Audio(assetUrl("assets/page.mp3"));
  pageAudio.volume = 0.3;
  
  function playFlipSound() {
    if (!soundEnabled) return;
    try {
      // Stop and reset current audio to prevent overlap
      pageAudio.pause();
      pageAudio.currentTime = 0;
      pageAudio.play().catch(() => {});
    } catch (_) {}
  }

  soundBtn.onclick = () => {
    soundEnabled = !soundEnabled;
    save(STORAGE.sound, soundEnabled?"1":"0");
    soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
  };

  // Sidebar
  indexBtn.onclick = toggleSidebar;
  closeSidebarBtn.onclick = toggleSidebar;
  overlay.onclick = toggleSidebar;
  
  surahSearch.oninput = (e) => {
    const q = e.target.value.trim();
    if(!q) renderSurahs(surahs);
    else {
      const filtered = surahs.filter(s => s.name.includes(q) || String(s.page) === q);
      renderSurahs(filtered);
    }
  };

  // Bookmark
  bookmarkBtn.onclick = () => {
    if (savedBookmark === currentPage) {
      // Remove bookmark
      savedBookmark = 0;
      save(STORAGE.bookmark, "0");
      bookmarkRibbon.classList.add("hidden");
      bookmarkBtn.style.color = "";
      setStatus("تم إزالة العلامة ✓");
    } else {
      // Set bookmark at current page
      savedBookmark = currentPage;
      save(STORAGE.bookmark, currentPage);
      bookmarkRibbon.classList.remove("hidden");
      bookmarkBtn.style.color = "#e74c3c";
      setStatus(`تم حفظ العلامة عند صفحة ${currentPage} 🔖`);
    }
    // Update resume button visibility
    updateResumeButton();
  };
  // Mobile Pinch/Zoom Simulation (Double tap)
  let lastTap = 0;
  elBook.ontouchend = () => {
    const now = Date.now();
    if(now - lastTap < 300) {
      // Toggle zoom
      zoom = (zoom < 1.3) ? 1.6 : 1.0;
      applyZoom();
    }
    lastTap = now;
  };
  
  // Resize
  let t;
  window.onresize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!pageFlip) return;
      try {
        // مجرد تحديث حجم/إعادة رسم
        if (typeof pageFlip.update === "function") pageFlip.update();
      } catch (_) {}
    }, 150);
  };

  // Start
  loadData();
})();
