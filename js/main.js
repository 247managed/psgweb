/**
 * Paula S. Gordy LISW, LLC - Main JavaScript
 * Handles navigation, accordions, and accessibility features
 */

(function () {
  'use strict';

  // ==========================================
  // Mobile Navigation Toggle
  // ==========================================
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      const isOpen = menu.classList.contains('open');
      menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', !isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !menu.contains(e.target) && menu.classList.contains('open')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
      }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    // Handle dropdown menus on mobile
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    dropdowns.forEach(function (dropdown) {
      const trigger = dropdown.querySelector('.nav-dropdown__trigger');
      const submenu = dropdown.querySelector('.nav-dropdown__menu');

      if (!trigger || !submenu) return;

      trigger.addEventListener('click', function (e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          const isOpen = submenu.style.display === 'block';
          // Close all other dropdowns
          dropdowns.forEach(function (d) {
            var sm = d.querySelector('.nav-dropdown__menu');
            if (sm) sm.style.display = 'none';
          });
          submenu.style.display = isOpen ? 'none' : 'block';
        }
      });
    });
  }

  // ==========================================
  // Accordion Functionality
  // ==========================================
  function initAccordions() {
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(function (accordion) {
      const triggers = accordion.querySelectorAll('.accordion__trigger');

      triggers.forEach(function (trigger) {
        trigger.addEventListener('click', function () {
          const content = this.nextElementSibling;
          const isExpanded = this.getAttribute('aria-expanded') === 'true';

          // Optionally close other items in the same accordion
          var siblingsToClose = accordion.querySelectorAll('.accordion__trigger[aria-expanded="true"]');
          siblingsToClose.forEach(function (otherTrigger) {
            if (otherTrigger !== trigger) {
              otherTrigger.setAttribute('aria-expanded', 'false');
              var otherContent = otherTrigger.nextElementSibling;
              if (otherContent) {
                otherContent.style.maxHeight = null;
              }
            }
          });

          // Toggle current item
          this.setAttribute('aria-expanded', !isExpanded);

          if (!isExpanded) {
            content.style.maxHeight = content.scrollHeight + 'px';
          } else {
            content.style.maxHeight = null;
          }
        });

        // Keyboard support
        trigger.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
          }
        });
      });
    });
  }

  // ==========================================
  // Smooth Scroll for Anchor Links
  // ==========================================
  function initSmoothScroll() {
    var links = document.querySelectorAll('a[href^="#"]');
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var targetId = this.getAttribute('href');
        if (targetId === '#') return;

        var target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          var headerHeight = document.querySelector('.site-header')
            ? document.querySelector('.site-header').offsetHeight
            : 0;
          var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          // Set focus on target for accessibility
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      });
    });
  }

  // ==========================================
  // Header Scroll Effect
  // ==========================================
  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var lastScroll = 0;
    var scrollThreshold = 100;

    window.addEventListener('scroll', function () {
      var currentScroll = window.pageYOffset;

      if (currentScroll > scrollThreshold) {
        header.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      } else {
        header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }

  // ==========================================
  // Intersection Observer for Animations
  // ==========================================
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var animatedElements = document.querySelectorAll('.card, .service-card, .location-card, .testimonial, .stat-item, .timeline__item');

    animatedElements.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ==========================================
  // Phone Number Formatting
  // ==========================================
  function initPhoneFormatting() {
    var phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        var value = this.value.replace(/\D/g, '');
        if (value.length >= 10) {
          value = value.substring(0, 10);
          this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
        } else if (value.length >= 6) {
          this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
        } else if (value.length >= 3) {
          this.value = '(' + value.substring(0, 3) + ') ' + value.substring(3);
        }
      });
    });
  }

  // ==========================================
  // Print Page Functionality
  // ==========================================
  function initPrintButtons() {
    var printButtons = document.querySelectorAll('[data-action="print"]');
    printButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.print();
      });
    });
  }

  // ==========================================
  // Back to Top Button
  // ==========================================
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.innerHTML = '&#8593;';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.setAttribute('title', 'Back to top');
    btn.style.cssText =
      'position:fixed;bottom:30px;right:30px;width:48px;height:48px;' +
      'border-radius:50%;background:#2980b9;color:#fff;border:none;' +
      'font-size:1.5rem;cursor:pointer;opacity:0;visibility:hidden;' +
      'transition:all 0.3s ease;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.15);' +
      'display:flex;align-items:center;justify-content:center;';

    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btn.addEventListener('mouseenter', function () {
      this.style.background = '#1a5276';
      this.style.transform = 'translateY(-2px)';
    });

    btn.addEventListener('mouseleave', function () {
      this.style.background = '#2980b9';
      this.style.transform = 'translateY(0)';
    });

    window.addEventListener('scroll', function () {
      if (window.pageYOffset > 500) {
        btn.style.opacity = '1';
        btn.style.visibility = 'visible';
      } else {
        btn.style.opacity = '0';
        btn.style.visibility = 'hidden';
      }
    }, { passive: true });
  }

  // ==========================================
  // Active Navigation Highlighting
  // ==========================================
  function initActiveNav() {
    var currentPath = window.location.pathname;
    var navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // Normalize paths for comparison
      var linkPath = href.split('/').pop().split('#')[0].split('?')[0];
      var pagePath = currentPath.split('/').pop().split('#')[0].split('?')[0];

      if (linkPath === pagePath || (pagePath === '' && (linkPath === 'index.html' || linkPath === ''))) {
        link.classList.add('active');
      }
    });
  }

  // ==========================================
  // External Link Warning
  // ==========================================
  function initExternalLinks() {
    var links = document.querySelectorAll('a[href^="http"]');
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && !href.includes(window.location.hostname) && !href.includes('tel:') && !href.includes('mailto:')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');

        // Add visual indicator if not already present
        if (!link.querySelector('.external-icon') && !link.classList.contains('btn')) {
          var icon = document.createElement('span');
          icon.className = 'external-icon';
          icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = ' &#8599;';
          icon.style.fontSize = '0.8em';
          link.appendChild(icon);
        }

        // Add accessible label
        var existingLabel = link.getAttribute('aria-label');
        if (!existingLabel) {
          link.setAttribute('aria-label', link.textContent.trim() + ' (opens in a new window)');
        }
      }
    });
  }

  // ==========================================
  // Cookie Notice (Privacy-First)
  // ==========================================
  function initCookieNotice() {
    // Check if already acknowledged
    if (localStorage.getItem('psg-cookie-notice') === 'acknowledged') return;

    var notice = document.createElement('div');
    notice.id = 'cookie-notice';
    notice.setAttribute('role', 'dialog');
    notice.setAttribute('aria-label', 'Cookie notice');
    notice.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;background:#1a252f;color:#fff;' +
      'padding:1rem 2rem;z-index:9999;display:flex;align-items:center;' +
      'justify-content:space-between;flex-wrap:wrap;gap:1rem;font-size:0.9rem;' +
      'box-shadow:0 -4px 12px rgba(0,0,0,0.15);';

    notice.innerHTML =
      '<p style="margin:0;flex:1;min-width:250px;">' +
      'This website uses only essential cookies necessary for basic functionality. ' +
      'We do not use tracking cookies or share your browsing data. ' +
      '<a href="' + (window.location.pathname.includes('/pages/') ? 'privacy.html' : 'pages/privacy.html') + '" style="color:#5dade2;text-decoration:underline;">Privacy Policy</a>' +
      '</p>' +
      '<button id="cookie-accept" style="' +
      'background:#2980b9;color:#fff;border:none;padding:0.5rem 1.5rem;' +
      'border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;' +
      'font-size:0.9rem;">Understood</button>';

    document.body.appendChild(notice);

    document.getElementById('cookie-accept').addEventListener('click', function () {
      localStorage.setItem('psg-cookie-notice', 'acknowledged');
      notice.style.transition = 'transform 0.3s ease';
      notice.style.transform = 'translateY(100%)';
      setTimeout(function () { notice.remove(); }, 300);
    });
  }

  // ==========================================
  // Initialize Everything
  // ==========================================
  function init() {
    initMobileNav();
    initAccordions();
    initSmoothScroll();
    initHeaderScroll();
    initScrollAnimations();
    initPhoneFormatting();
    initPrintButtons();
    initBackToTop();
    initActiveNav();
    initExternalLinks();
    initCookieNotice();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
