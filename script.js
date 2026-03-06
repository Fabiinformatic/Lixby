/**
 * Lixby - Main Script
 * Handles interactions, animations, and dynamic functionality
 */

class LixbyApp {
  constructor() {
    this.init();
  }

  init() {
    this.setupLoading();
    this.setupNavigation();
    this.setupScrollEffects();
    this.setupLanguageSwitcher();
    this.setupAnimations();
    this.setupAccessibility();
    this.setupPerformance();
  }

  // Loading skeleton
  setupLoading() {
    const skeleton = document.getElementById('loadingSkeleton');
    if (!skeleton) return;

    // Hide skeleton after content loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        skeleton.style.opacity = '0';
        setTimeout(() => {
          skeleton.style.display = 'none';
        }, 300);
      }, 100);
    });

    // Fallback: hide after 3 seconds
    setTimeout(() => {
      if (skeleton.style.display !== 'none') {
        skeleton.style.display = 'none';
      }
    }, 3000);
  }

  // Navigation setup
  setupNavigation() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    // Change nav background on scroll
    let lastScrollY = window.scrollY;

    const updateNav = Utils.debounce(() => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 100) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }

      lastScrollY = currentScrollY;
    }, 10);

    window.addEventListener('scroll', updateNav, { passive: true });

    // Smooth scroll for nav links
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          Utils.smoothScrollTo(targetElement, 80); // Offset for fixed nav
        }
      });
    });

    // mobile menu toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    if (navToggle && navLinksContainer) {
      navToggle.addEventListener('click', () => {
        navLinksContainer.classList.toggle('open');
      });

      // close menu when a link is clicked (for single‑page anchors)
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          navLinksContainer.classList.remove('open');
        });
      });
    }
  }

  // Scroll effects
  setupScrollEffects() {
    // Parallax effect for hero image
    const heroImage = document.querySelector('.hero-image img');
    if (heroImage) {
      const parallax = Utils.throttle(() => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        heroImage.style.transform = `translateY(${rate}px)`;
      }, 16);

      window.addEventListener('scroll', parallax, { passive: true });
    }

    // Reveal animations on scroll
    const revealElements = document.querySelectorAll('[data-reveal]');

    // ScrollTrigger based reveal (if available)
    if (window.ScrollTrigger && window.gsap) {
      revealElements.forEach(el => {
        gsap.from(el, {
          opacity: 0,
          y: 30,
          duration: 0.6,
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            once: true
          }
        });
      });
    }

    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const delay = parseFloat(element.dataset.revealDelay) || 0;

            if (window.gsap && !Utils.prefersReducedMotion()) {
              gsap.fromTo(element,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, delay: delay / 1000 }
              );
            } else {
              setTimeout(() => {
                element.classList.add('revealed');
              }, delay);
            }

            revealObserver.unobserve(element);
          }
        });
      }, {
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
      });

      revealElements.forEach(el => revealObserver.observe(el));
    }
  }

  // Language switcher
  setupLanguageSwitcher() {
    const languageSwitcher = document.getElementById('languageSwitcher');
    if (!languageSwitcher) return;

    // Initialize language switcher with existing i18n system
    if (window.i18n && window.LanguageSwitcher) {
      new LanguageSwitcher(languageSwitcher);
    }
  }

  // Animations
  setupAnimations() {
    // initialize SplitType if needed on text
    if (window.SplitType) {
      document.querySelectorAll('[data-split]').forEach(el => {
        new SplitType(el, { types: 'words,chars' });
      });
    }

    // register ScrollTrigger plugin
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Initialize all 20 animations
    if (!Utils.prefersReducedMotion()) {
      this.setup3DTilt();
      this.setupCounterAnimation();
      this.setupCustomCursor();
      this.setupTextScroll();
      this.setupGlowEffects();
      this.setupScrollHorizontal();
      this.setupCascadeCards();
      this.setupBackgroundChange();
    }

    // Micro-interactions for buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        if (!Utils.prefersReducedMotion()) {
          button.style.transform = 'translateY(-2px) scale(1.02)';
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!Utils.prefersReducedMotion()) {
          button.style.transform = '';
        }
      });
    });

    // GSAP entrance animations
    if (window.gsap && !Utils.prefersReducedMotion()) {
      // header cascade animation
      const headerTl = gsap.timeline({ defaults: { opacity: 0, y: -20, ease: 'power2.out' } });
      headerTl
        .from('.nav-brand', { duration: 0.6 })
        .from('.nav-link', { duration: 0.5, stagger: 0.1 }, '-=0.4')
        .from('.nav-right', { duration: 0.4 }, '-=0.5');

      // hero section (starts shortly after header)
      headerTl
        .from('.hero-title', { duration: 0.8, y: 30 }, '-=0.3')
        .from('.hero-subtitle', { duration: 0.8 }, '-=0.6')
        .from('.hero-ctas a', { duration: 0.8, stagger: 0.2 }, '-=0.6')
        .from('.hero-image img', { duration: 1, scale: 1.1 }, '-=0.6');

      // features cards
      gsap.utils.toArray('.feature').forEach((el, i) => {
        gsap.from(el, { opacity: 0, y: 30, duration: 0.6, delay: 1 + i * 0.15 });
      });

      // legal page headers
      gsap.utils.toArray('.legal-header h1').forEach(el => {
        gsap.from(el, { opacity: 0, y: -20, duration: 0.8, delay: 0.3 });
      });

      // fade-in for each major section (homepage/products/etc.)
      gsap.utils.toArray('section').forEach((sec, i) => {
        gsap.from(sec, { opacity: 0, y: 20, duration: 0.6, delay: 1 + i * 0.15 });
      });
    }

    // Hover effects for feature cards
    const features = document.querySelectorAll('.feature');
    features.forEach(feature => {
      feature.addEventListener('mouseenter', () => {
        if (!Utils.prefersReducedMotion()) {
          const icon = feature.querySelector('.feature-icon');
          if (icon) {
            icon.style.transform = 'scale(1.1) rotate(5deg)';
          }
        }
      });

      feature.addEventListener('mouseleave', () => {
        if (!Utils.prefersReducedMotion()) {
          const icon = feature.querySelector('.feature-icon');
          if (icon) {
            icon.style.transform = '';
          }
        }
      });
    });
  }

  // Accessibility features
  setupAccessibility() {
    // Skip to main content link
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.className = 'sr-only skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.addEventListener('focus', () => {
      skipLink.classList.remove('sr-only');
    });
    skipLink.addEventListener('blur', () => {
      skipLink.classList.add('sr-only');
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    // Keyboard navigation for mobile menu (if implemented)
    // Focus trap for modals (if implemented)

    // High contrast mode detection
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    prefersHighContrast.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('high-contrast', e.matches);
    });

    // Reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('reduced-motion', e.matches);
    });
  }

  // Performance optimizations
  setupPerformance() {
    // Preload critical resources
    this.preloadCriticalResources();

    // Lenis smooth scrolling
    if (window.Lenis) {
      this.lenis = new Lenis({
        duration: 1.2,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
      });
      const raf = (time) => {
        this.lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }

    // Service worker registration (if available)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Register service worker if exists
        // navigator.serviceWorker.register('/sw.js');
      });
    }

    // Passive event listeners for touch/scroll
    // Already handled in setupNavigation and setupScrollEffects
  }

  // Preload critical resources
  preloadCriticalResources() {
    // Preload hero image
    const heroImage = document.querySelector('.hero-image img');
    if (heroImage && heroImage.dataset.src) {
      Utils.preloadImage(heroImage.dataset.src);
    }

    // Preload fonts (already handled in HTML)

    // Prefetch pages
    const prefetchLinks = [
      'pages/products/lixbuds.html',
      'pages/apps/lixney.html'
    ];

    prefetchLinks.forEach(link => {
      const linkElement = document.createElement('link');
      linkElement.rel = 'prefetch';
      linkElement.href = link;
      document.head.appendChild(linkElement);
    });
  }

  // 3️⃣ Tilt 3D effect for products
  setup3DTilt() {
    const tiltElements = document.querySelectorAll('[data-tilt-3d]');
    tiltElements.forEach(element => {
      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) * 0.1;
        const rotateY = (centerX - x) * 0.1;
        element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      });
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
      });
    });
  }

  // 6️⃣ Animated counter
  setupCounterAnimation() {
    const counters = document.querySelectorAll('[data-counter]');
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.counter);
      const duration = parseFloat(counter.dataset.duration) || 2;
      const start = 0;
      const increment = target / (duration * 60);
      let current = start;

      const updateCounter = () => {
        current += increment;
        if (current >= target) {
          counter.textContent = target;
          return;
        }
        counter.textContent = Math.floor(current);
        requestAnimationFrame(updateCounter);
      };

      // Trigger when element is visible
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              updateCounter();
              observer.unobserve(counter);
            }
          });
        });
        observer.observe(counter);
      } else {
        updateCounter();
      }
    });
  }

  // 1️⃣5️⃣ Custom interactive cursor
  setupCustomCursor() {
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);

    const updateCursor = (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.clientY = e.clientY + 'px';
    };

    const interactiveElements = document.querySelectorAll('a, button, [role="button"]');
    document.addEventListener('mousemove', updateCursor, { passive: true });

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('active');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('active');
      });
    });
  }

  // 5️⃣ Text scroll effect
  setupTextScroll() {
    const textScrollElements = document.querySelectorAll('[data-text-scroll]');
    if ('IntersectionObserver' in window) {
      const textObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('text-scroll');
            textObserver.unobserve(entry.target);
          }
        });
      });
      textScrollElements.forEach(el => textObserver.observe(el));
    }
  }

  // 9️⃣ Glow effects on hover
  setupGlowEffects() {
    const glowElements = document.querySelectorAll('[data-glow]');
    glowElements.forEach(element => {
      element.classList.add('glow-hover');
      if (element.dataset.glow === 'pulse') {
        element.classList.add('glow-pulse');
      }
    });
  }

  // 🔟 Horizontal scroll
  setupScrollHorizontal() {
    const horizontalSections = document.querySelectorAll('[data-scroll-horizontal]');
    horizontalSections.forEach(section => {
      section.classList.add('scroll-horizontal');
      const items = section.querySelectorAll('[data-scroll-item]');
      items.forEach((item, index) => {
        item.style.animationDelay = (index * 0.1) + 's';
      });
    });
  }

  // 1️⃣7️⃣ Cascade cards animation
  setupCascadeCards() {
    const cascadeContainers = document.querySelectorAll('[data-cascade]');
    cascadeContainers.forEach(container => {
      const cards = container.querySelectorAll('[data-cascade-item]');
      cards.forEach((card, index) => {
        card.classList.add('cascade-item');
      });
    });
  }

  // 1️⃣4️⃣ Background change on scroll
  setupBackgroundChange() {
    const sections = document.querySelectorAll('[data-bg-change]');
    if ('IntersectionObserver' in window) {
      const bgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('section-bg-change');
            const bgColor = entry.target.dataset.bgChange;
            if (bgColor) {
              entry.target.style.backgroundColor = bgColor;
            }
          }
        });
      });
      sections.forEach(section => bgObserver.observe(section));
    }
  }

  // Utility methods
  static scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      Utils.smoothScrollTo(section, 80);
    }
  }

  static showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" aria-label="Close notification">×</button>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto hide
    const hideTimeout = setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);

    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      clearTimeout(hideTimeout);
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.lixbyApp = new LixbyApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, pause non-essential operations
  } else {
    // Page is visible again, resume operations
  }
});

// Error handling
window.addEventListener('error', (e) => {
  console.error('JavaScript error:', e.error);
  // Could send to error reporting service
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  // Could send to error reporting service
});

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LixbyApp;
}
