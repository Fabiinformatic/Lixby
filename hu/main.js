const cookieBanner = document.getElementById("cookieBanner");
const acceptCookiesButton = document.getElementById("acceptCookies");
const rejectCookiesButton = document.getElementById("rejectCookies");

const cookieChoice = localStorage.getItem("cookiesChoice");
if (cookieChoice === "accepted" || cookieChoice === "rejected") {
  cookieBanner.style.display = "none";
}

acceptCookiesButton.addEventListener("click", () => {
  localStorage.setItem("cookiesChoice", "accepted");
  cookieBanner.style.display = "none";
});

rejectCookiesButton.addEventListener("click", () => {
  localStorage.setItem("cookiesChoice", "rejected");
  cookieBanner.style.display = "none";
});

const nav = document.getElementById("nav");
const progressBar = document.getElementById("scroll-progress");

const updateScrollUI = () => {
  const top = document.documentElement.scrollTop;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const progress = height > 0 ? (top / height) * 100 : 0;

  if(progressBar)progressBar.style.width = progress + "%";
  if(nav)nav.classList.toggle("nav-scrolled", top > 20);
};

window.addEventListener("scroll", updateScrollUI, { passive: true });
updateScrollUI();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll(".reveal").forEach((el) => {
  el.style.transitionDelay = el.dataset.delay || "0s";
  observer.observe(el);
});

document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const targetId = link.getAttribute("href").slice(1);
    const target = document.getElementById(targetId);

    if (target) {
      window.scrollTo({
        top: target.offsetTop - 82,
        behavior: "smooth"
      });
    }
  });
});

const searchForm = document.getElementById("navSearchForm");
const searchInput = document.getElementById("navSearch");
if (searchForm && searchInput) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = query ? `/hu/shop/?q=${encodeURIComponent(query)}` : "/hu/shop/";
    window.location.href = url;
  });
}

const mobileSearchForm = document.getElementById("navSearchFormMobile");
const mobileSearchInput = document.getElementById("navSearchMobile");
if (mobileSearchForm && mobileSearchInput) {
  mobileSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = mobileSearchInput.value.trim();
    const url = query ? `/hu/shop/?q=${encodeURIComponent(query)}` : "/hu/shop/";
    window.location.href = url;
  });
}

const mobilePanel = document.getElementById("navMobilePanel");
const searchToggle = document.querySelector(".nav-search-toggle");
const menuToggle = document.querySelector(".nav-menu-toggle");
const closeNav = () => {
  document.body.classList.remove("nav-open", "menu-open");
  nav.classList.remove("nav-open");
  mobilePanel?.setAttribute("aria-hidden", "true");
  searchToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-expanded", "false");
};

const openNav = (focusSearch = false) => {
  document.body.classList.add("nav-open", "menu-open");
  nav.classList.add("nav-open");
  mobilePanel?.setAttribute("aria-hidden", "false");
  searchToggle?.setAttribute("aria-expanded", "true");
  menuToggle?.setAttribute("aria-expanded", "true");
  if (focusSearch && mobileSearchInput) {
    setTimeout(() => mobileSearchInput.focus(), 80);
  }
};

const toggleNav = (focusSearch = false) => {
  if (nav.classList.contains("nav-open")) {
    closeNav();
  } else {
    openNav(focusSearch);
  }
};

searchToggle?.addEventListener("click", () => toggleNav(true));
menuToggle?.addEventListener("click", () => toggleNav(false));

const mobileClose = document.querySelector(".nav-mobile-close");
mobileClose?.addEventListener("click", () => closeNav());

document.querySelectorAll(".nav-mobile-links a").forEach((link) => {
  link.addEventListener("click", () => closeNav());
});

const addToCartButtons = document.querySelectorAll(".add-to-cart");

if (addToCartButtons.length) {
  addToCartButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const cart = JSON.parse(localStorage.getItem("lixbyCart") || "[]");
      const lineId = "lixbuds-one|—|Sin LixSafe|0";
      const existing = cart.find((item) => (item.lineId || `${item.id}|${item.color || "—"}|${item.insurancePlan || "Sin LixSafe"}|${Number(item.insurancePrice) || 0}`) === lineId);

      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({
          id: "lixbuds-one",
          name: "LixBuds One",
          price: 99,
          color: "—",
          insurancePlan: "Sin LixSafe",
          insurancePrice: 0,
          lineId,
          qty: 1
        });
      }

      localStorage.setItem("lixbyCart", JSON.stringify(cart));
      window.location.href = "/hu/cart/";
    });
  });
}

const texto = document.getElementById("texto");
const typedString = "Diseño limpio,\nsonido potente y\ncontrol total de tu día.";
let typedIndex = 0;

function typeNext() {
  if (!texto) return;
  if (typedIndex > typedString.length) return;
  texto.textContent = typedString.slice(0, typedIndex);
  typedIndex += 1;
  setTimeout(typeNext, 25);
}

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  texto.textContent = "";
  typeNext();
}

const swapImages = document.querySelectorAll(".swap-media .swap-image");
if (swapImages.length) {
  let imgIndex = 0;
  setInterval(() => {
    imgIndex = (imgIndex + 1) % swapImages.length;
    swapImages.forEach((img, idx) => {
      img.classList.toggle("is-active", idx === imgIndex);
    });
    const dots = document.querySelectorAll(".swap-dot");
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === imgIndex);
    });
  }, 3000);
}

const statNumbers = document.querySelectorAll(".stat-number[data-target]");
const animateStat = (el) => {
  const target = Number(el.dataset.target || "0");
  const suffix = el.dataset.suffix || "";
  const duration = 1200;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(target * progress);
    el.textContent = `${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

if (statNumbers.length) {
  const statsObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateStat(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  statNumbers.forEach((el) => statsObserver.observe(el));
}

