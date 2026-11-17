// Picko site demo: a small copy of the app's Swipe screen.
// Same rules as the app: right keeps (flies off with little stars), left sets
// aside (slides off, "+x MB", Review count bumps), the next photo clears from
// frosted glass as you drag, and nothing is deleted until Review is confirmed.
(() => {
  const photos = [
    { src: "assets/daily.jpg",    mb: 2.4, date: "Sep 14, 2025" },
    { src: "assets/selfie.jpg",   mb: 1.8, date: "Oct 2, 2025" },
    { src: "assets/travel.jpg",   mb: 3.1, date: "Jun 21, 2025" },
    { src: "assets/dinner.jpg",   mb: 2.7, date: "Mar 8, 2025" },
    { src: "assets/birthday.jpg", mb: 2.2, date: "Jan 30, 2025" },
    { src: "assets/tourist.jpg",  mb: 3.4, date: "Apr 17, 2024" },
    { src: "assets/weekend.jpg",  mb: 2.9, date: "May 5, 2024" },
  ];

  const $ = (id) => document.getElementById(id);
  const deck = $("deck"), screen = $("screen");
  const edgeKeep = $("edgeKeep"), edgeAside = $("edgeAside");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let index = 0, today = 0, aside = [], busy = false, ponyTimer = null;

  function fmt(mb) { return (Math.round(mb * 10) / 10).toFixed(1) + " MB"; }

  function makeCard(photo, isNext) {
    const el = document.createElement("div");
    el.className = "card" + (isNext ? " next" : "");
    el.style.backgroundImage = `url("${photo.src}")`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", isNext ? "" : "Sample photo " + (index + 1) + " of " + photos.length);
    return el;
  }

  function render() {
    deck.innerHTML = "";
    if (index + 1 < photos.length) deck.appendChild(makeCard(photos[index + 1], true));
    if (index < photos.length) {
      const top = makeCard(photos[index], false);
      deck.appendChild(top);
      attachDrag(top);
      $("cardSize").textContent = fmt(photos[index].mb);
      $("cardCaption").textContent = photos[index].date + " · Photo";
      $("bottombar").style.opacity = 1;
    } else {
      $("bottombar").style.opacity = 0;
    }
    $("todayCount").textContent = today;
    $("meterFill").style.width = (today / 30 * 100) + "%";
    $("reviewCount").textContent = aside.length;
    const done = index >= photos.length;
    $("keepBtn").disabled = done; $("asideBtn").disabled = done;
  }

  function nextCard() { return deck.querySelector(".card.next"); }

  function setProgress(dx) {
    const p = Math.min(1, Math.abs(dx) / 160);
    edgeKeep.style.opacity = dx > 0 ? Math.min(1, dx / 120) : 0;
    edgeAside.style.opacity = dx < 0 ? Math.min(1, -dx / 120) : 0;
    const n = nextCard();
    if (n) {
      n.style.filter = `blur(${14 * (1 - p)}px) saturate(${0.9 + 0.1 * p}) brightness(${1.08 - 0.08 * p})`;
      n.style.transform = `scale(${1.04 - 0.04 * p})`;
      n.style.setProperty("--fog", (0.35 * (1 - p)).toFixed(3));
    }
  }

  function attachDrag(card) {
    let startX = 0, startY = 0, dx = 0, dy = 0, lastX = 0, lastT = 0, vx = 0, active = false;
    card.addEventListener("pointerdown", (e) => {
      if (busy) return;
      active = true; card.setPointerCapture(e.pointerId);
      startX = lastX = e.clientX; startY = e.clientY; lastT = performance.now();
      card.style.transition = "none"; card.classList.add("dragging");
      hidePony();
    });
    card.addEventListener("pointermove", (e) => {
      if (!active) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      const now = performance.now();
      vx = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
      card.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 22}deg) scale(.97)`;
      setProgress(dx);
    });
    const end = () => {
      if (!active) return;
      active = false;
      const fling = Math.abs(vx) > 0.6 && Math.abs(dx) > 30;
      if (dx > 90 || (fling && vx > 0)) decide("keep", card, vx);
      else if (dx < -90 || (fling && vx < 0)) decide("aside", card, vx);
      else {
        card.style.transition = "transform .35s cubic-bezier(.3,1.5,.5,1), border-radius .2s";
        card.style.transform = ""; card.classList.remove("dragging");
        setProgress(0);
        const n = nextCard(); if (n) n.style.transition = "filter .3s, transform .3s";
      }
      dx = dy = 0;
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function decide(kind, card, vx = 0) {
    if (busy || index >= photos.length) return;
    busy = true;
    card = card || deck.querySelector(".card:not(.next)");
    const W = screen.clientWidth, H = screen.clientHeight;
    const photo = photos[index];
    const speed = Math.min(1.6, Math.max(0.6, Math.abs(vx)));
    const ms = reduce ? 1 : Math.round(300 / speed);
    card.classList.add("dragging");
    card.style.transition = `transform ${ms}ms cubic-bezier(.2,.7,.3,1), opacity ${ms}ms`;
    const n = nextCard();
    if (n) { n.style.transition = `filter ${ms}ms, transform ${ms}ms`; }
    setProgress(kind === "keep" ? 200 : -200);

    if (kind === "keep") {
      card.style.transform = `translate(${W * 1.35}px, ${-H * 0.22}px) rotate(20deg)`;
      burstStars();
    } else {
      card.style.transform = `translate(${-W * 1.3}px, 0) rotate(-6deg)`;
      aside.push(photo);
      popPlus(photo.mb);
      bump();
    }
    today += 1;

    setTimeout(() => {
      edgeKeep.style.opacity = 0; edgeAside.style.opacity = 0;
      index += 1;
      render();
      busy = false;
      moment();
    }, ms + 20);
  }

  function burstStars() {
    if (reduce) return;
    const box = $("stars");
    for (let i = 0; i < 9; i++) {
      const s = document.createElement("span");
      s.className = "star" + (i % 3 === 0 ? " green" : "");
      s.style.left = (62 + Math.random() * 18) + "%";
      s.style.top = (28 + Math.random() * 30) + "%";
      s.style.setProperty("--dx", (Math.random() * 90 - 20) + "px");
      s.style.setProperty("--dy", (Math.random() * -110 - 10) + "px");
      s.style.animationDelay = (i * 25) + "ms";
      box.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  function popPlus(mb) {
    const el = $("plus");
    el.textContent = "+" + fmt(mb);
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

  function bump() {
    const b = $("reviewCount");
    b.classList.add("bump"); setTimeout(() => b.classList.remove("bump"), 220);
  }

  function showPony(pose, text, hold = 2200) {
    clearTimeout(ponyTimer);
    const p = $("pony");
    $("ponyImg").src = "assets/pony-" + pose + ".png";
    $("ponyBubble").textContent = text;
    p.classList.remove("up"); void p.offsetWidth; p.classList.add("up");
    ponyTimer = setTimeout(hidePony, hold);
  }
  function hidePony() { clearTimeout(ponyTimer); $("pony").classList.remove("up"); }

  function moment() {
    if (index === 3) showPony("cheer", "Nice rhythm!");
    else if (index === photos.length - 1) showPony("almost", "Last one!", 1800);
    else if (index >= photos.length) openReview();
  }

  function openReview() {
    const r = $("review");
    const total = aside.reduce((s, p) => s + p.mb, 0);
    r.classList.remove("done");
    $("reviewTitle").textContent = aside.length ? `${aside.length} set aside` : "Nothing set aside";
    const grid = $("reviewGrid"); grid.innerHTML = "";
    aside.forEach((p) => {
      const t = document.createElement("div");
      t.className = "thumb"; t.style.backgroundImage = `url("${p.src}")`;
      grid.appendChild(t);
    });
    const btn = $("confirmBtn");
    btn.hidden = aside.length === 0;
    btn.disabled = false;
    btn.textContent = `Delete ${aside.length} · ${fmt(total)}`;
    r.querySelector(".review-note").textContent = aside.length
      ? "Nothing is deleted until you confirm."
      : "You kept all of them. That counts too.";
    setTimeout(() => { r.hidden = false; }, reduce ? 0 : 250);
  }

  $("confirmBtn").addEventListener("click", () => {
    const total = aside.reduce((s, p) => s + p.mb, 0);
    const btn = $("confirmBtn");
    $("review").classList.add("done");
    btn.textContent = `${fmt(total)} freed ✓`;
    btn.disabled = true;
    $("review").querySelector(".review-note").textContent = "Demo only. In the app, iOS asks you once more.";
    showPony("cheer", "Room for new memories!", 2600);
  });

  function restart() {
    index = 0; today = 0; aside = []; busy = false;
    $("review").hidden = true; hidePony(); render();
  }
  $("restartBtn").addEventListener("click", restart);
  $("keepBtn").addEventListener("click", () => decide("keep"));
  $("asideBtn").addEventListener("click", () => decide("aside"));

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    const r = $("demo").getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    if (e.key === "ArrowRight") { e.preventDefault(); decide("keep"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); decide("aside"); }
  });

  // preload so swipes never show a blank card
  photos.forEach((p) => { const i = new Image(); i.src = p.src; });
  ["cheer", "almost"].forEach((p) => { const i = new Image(); i.src = "assets/pony-" + p + ".png"; });
  render();
  // the pony says hello once the page settles
  setTimeout(() => { if (index === 0) showPony("hello", "Swipe me!", 2400); }, reduce ? 0 : 900);
})();
