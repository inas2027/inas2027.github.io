function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* NEWS TICKER */

const ticker = document.querySelector(".news-ticker");
const intro = document.querySelector(".intro");
const tickerWindow = document.querySelector(".news-ticker-window");
const tickerTrack = document.querySelector(".news-ticker-track");
const tickerSourceItems = tickerTrack
  ? Array.from(tickerTrack.querySelectorAll(".news-ticker-item")).map((item) =>
      item.cloneNode(true)
    )
  : [];

function updateNewsTicker() {
  if (!tickerWindow || !tickerTrack || tickerSourceItems.length === 0) return;

  const group = document.createElement("span");
  group.className = "news-ticker-group";
  tickerSourceItems.forEach((item) => group.append(item.cloneNode(true)));

  tickerTrack.replaceChildren(group);

  const patternWidth = group.getBoundingClientRect().width;
  if (patternWidth <= 0) return;

  const repetitions = Math.max(
    2,
    Math.ceil((tickerWindow.clientWidth + patternWidth) / patternWidth)
  );

  for (let repetition = 1; repetition < repetitions; repetition += 1) {
    tickerSourceItems.forEach((item) => group.append(item.cloneNode(true)));
  }

  const duplicateGroup = group.cloneNode(true);
  duplicateGroup.setAttribute("aria-hidden", "true");
  tickerTrack.append(duplicateGroup);

  const pixelsPerSecond = 45;
  const duration = group.getBoundingClientRect().width / pixelsPerSecond;
  tickerTrack.style.setProperty("--ticker-duration", `${duration}s`);
}

const mobileLayout = window.matchMedia("(max-width: 980px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const storySections = Array.from(document.querySelectorAll(".story-section:not(.faq-section)"));

// Keep the reading layout intact; an outer track supplies only the pause distance.
const sectionTracks = Array.from(document.querySelectorAll("body > section, body > footer")).map((section) => {
  const track = document.createElement("div");
  track.className = "section-track";
  section.before(track);
  track.append(section);
  return { section, track };
});

function updateSectionPauses() {
  const shortPause = clamp(window.innerHeight * 0.3, 120, 240);
  // Match the story sections: 220vh of section minus a 100vh sticky stage.
  const readingPause = window.innerHeight * 1.2;
  sectionTracks.forEach(({ section, track }) => {
    const pause = section.classList.contains("faq-section") ? readingPause : shortPause;
    const alreadySticky = (storySections.includes(section) && !section.classList.contains("flow-section")) ||
      (section === programSection && !section.classList.contains("flow-program"));
    const height = section.getBoundingClientRect().height;
    const enabled = !reducedMotion.matches && !alreadySticky &&
      (section.id !== "logos" || height > window.innerHeight);
    track.classList.toggle("has-pause", enabled);
    if (enabled) track.style.height = `${height + pause}px`;
    else track.style.removeProperty("height");
  });
}

// Recheck content, not just screen width: zoom and loaded fonts can change fit.
function updateLayout() {
  // A fixed ticker must sit outside the intro's sticky stacking context.
  const tickerParent = mobileLayout.matches ? intro : document.body;
  if (ticker.parentElement !== tickerParent) tickerParent.append(ticker);
  storySections.forEach((section) => {
    const text = section.querySelector(".text-block");
    section.classList.toggle("flow-section", mobileLayout.matches || reducedMotion.matches ||
      text.offsetHeight > window.innerHeight - 200);
  });
  if (programSection) {
    const layout = programSection.querySelector(".program-layout");
    programSection.classList.toggle("flow-program", mobileLayout.matches || reducedMotion.matches ||
      layout.scrollHeight > window.innerHeight);
  }
  updateSectionPauses();
  updateAll();
}

function updateSections() {
  storySections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const text = section.querySelector(".text-block");
    const image = section.querySelector(".media-cluster");
    const flowing = section.classList.contains("flow-section");
    image.querySelectorAll(".floating-card").forEach((card, index) => {
      // Measure the untransformed cluster and card's layout position to avoid feedback.
      const top = image.getBoundingClientRect().top + card.offsetTop;
      const progress = clamp((window.innerHeight - top) / (window.innerHeight + card.offsetHeight), 0, 1);
      const x = flowing && mobileLayout.matches && !reducedMotion.matches
        ? (index % 2 === 0 ? 1 : -1) * 50 * (1 - 2 * progress) : 0;
      card.style.transform = `translateX(${x}px)`;
    });
    if (flowing) {
      // A small entrance shift retains motion without pinning or clipping the text.
      const offset = reducedMotion.matches ? 0 : 24 * clamp(rect.top / window.innerHeight, 0, 1);
      text.style.transform = `translateY(${offset}px)`;
      image.style.transform = "none";
      return;
    }
    const progress = clamp((window.innerHeight - rect.top) / (rect.height + window.innerHeight), 0, 1);
    const textY = 70 * (1 - clamp(progress / 0.5, 0, 1));
    text.style.transform = `translateY(calc(-50% + ${textY}px))`;
    const imageStart = -window.innerHeight / 2;
    const imageEnd = window.innerHeight / 2 - image.offsetHeight;
    image.style.transform = `translateY(${imageStart + (imageEnd - imageStart) * progress}px)`;
  });
}

/* COMPACT NAVIGATION */
const nav = document.querySelector(".floating-nav");
const navToggle = nav.querySelector(".nav-toggle");
function setMenuOpen(open) {
  nav.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
}
navToggle.addEventListener("click", () => setMenuOpen(!nav.classList.contains("open")));
// Land on the reading area, not the padding before it or an artificial anchor.
function navigateToSection(hash) {
  const section = document.getElementById(hash.slice(1));
  if (!section) return;
  setMenuOpen(false);
  const pinned = section.classList.contains("story-section") &&
    !section.classList.contains("flow-section") && !section.classList.contains("faq-section");
  const programPinned = section === programSection && !section.classList.contains("flow-program");
  const target = pinned || programPinned ? section : section.querySelector("h2") || section;
  const offset = pinned || programPinned ? 0 : mobileLayout.matches ? nav.offsetHeight + 24 : 24;
  // Start from the track's natural position, even when its section is currently pinned.
  const track = section.parentElement;
  const sectionTop = track.getBoundingClientRect().top + window.scrollY;
  let top = sectionTop;
  if (target !== section) {
    top += target.getBoundingClientRect().top - section.getBoundingClientRect().top;
    const text = target.closest(".text-block");
    if (text) top -= new DOMMatrix(getComputedStyle(text).transform).m42;
  }
  if (track.classList.contains("has-pause") && top - sectionTop > offset) {
    top += track.getBoundingClientRect().height - section.getBoundingClientRect().height;
  }
  if (programPinned) top += parseFloat(getComputedStyle(section).paddingTop);
  window.scrollTo({ top: Math.max(0, top - offset), behavior: reducedMotion.matches ? "instant" : "smooth" });
}
document.querySelectorAll('.floating-nav a, .news-ticker').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const hash = link.getAttribute("href");
    history.pushState(null, "", hash);
    navigateToSection(hash);
  });
});
window.addEventListener("hashchange", () => navigateToSection(location.hash));
nav.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { setMenuOpen(false); navToggle.focus(); }
});

/* PROGRAM ANIMATION */

const programSection = document.querySelector(".program-animated");
const programCards = Array.from(programSection.querySelectorAll(".program-day"));

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateProgramCards() {
  if (!programSection) return;
  if (programSection.classList.contains("flow-program")) {
    programCards.forEach((card) => {
      const top = card.getBoundingClientRect().top;
      const center = Math.max(76, (window.innerHeight - card.offsetHeight) / 2);
      const progress = clamp((window.innerHeight - top) / Math.max(1, window.innerHeight - center), 0, 1);
      const x = reducedMotion.matches ? 0 : window.innerWidth * 0.65 * (1 - easeInOutCubic(progress));
      card.style.transform = `translateX(${x}px)`;
    });
    return;
  }

  const rect = programSection.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  const raw = -rect.top / total;
  const progress = clamp(raw, 0, 1);

  programCards.forEach((card, index) => {
    const speed = parseFloat(card.dataset.speed || "1");
    const startOffset = window.innerWidth * 0.3 * speed;

    const localProgress = Math.min(progress / 0.65, 1);
    const eased = easeInOutCubic(localProgress);
    const x = startOffset * (1 - eased);

    card.style.transform = `translateX(${x}px)`;
    card.style.zIndex = String(10 - index);
  });
}

/* FAQ (only one open at a time) */

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const btn = item.querySelector(".faq-question");

  btn.addEventListener("click", () => {
    const isOpen = item.classList.contains("open");

    // close all
    faqItems.forEach((i) => {
      i.classList.remove("open");
      i.querySelector(".faq-answer").style.display = "none";
      i.querySelector(".faq-question").setAttribute("aria-expanded", "false");
    });

    // open current if it was closed
    if (!isOpen) {
      item.classList.add("open");
      item.querySelector(".faq-answer").style.display = "block";
      btn.setAttribute("aria-expanded", "true");
    }
  });
});

/* RUN ALL */

function updateAll() {
  updateSections();
  updateProgramCards();
}

updateLayout();
updateNewsTicker();

if (document.fonts) {
  document.fonts.ready.then(() => {
    updateLayout();
    updateNewsTicker();
    if (location.hash) navigateToSection(location.hash);
  });
}

let tickerResizeFrame;

let scrollFrame;
window.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => { scrollFrame = null; updateAll(); });
}, { passive: true });
const contentObserver = new ResizeObserver(updateLayout);
storySections.forEach((section) => contentObserver.observe(section.querySelector(".text-block")));
programCards.forEach((card) => contentObserver.observe(card));
sectionTracks.forEach(({ section }) => contentObserver.observe(section));
reducedMotion.addEventListener("change", updateLayout);
window.addEventListener("resize", () => {
  updateLayout();
  window.cancelAnimationFrame(tickerResizeFrame);
  tickerResizeFrame = window.requestAnimationFrame(updateNewsTicker);
});
