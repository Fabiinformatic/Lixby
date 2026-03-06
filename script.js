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

    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const delay = element.dataset.revealDelay || 0;

            setTimeout(() => {
              element.classList.add('revealed');
            }, delay);

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
