/**
 * Paula S. Gordy LISW, LLC - Main JavaScript
 * Handles navigation, forms, accordions, and accessibility features
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
  // Contact Form - HIPAA-Aware Handling
  // ==========================================
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    // Form validation
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var isValid = true;
      var errors = [];

      // Clear previous errors
      var errorElements = form.querySelectorAll('.form-error');
      errorElements.forEach(function (el) { el.remove(); });
      var errorInputs = form.querySelectorAll('.form-input--error');
      errorInputs.forEach(function (el) { el.classList.remove('form-input--error'); });

      // Required field validation
      var requiredFields = form.querySelectorAll('[required]');
      requiredFields.forEach(function (field) {
        if (!field.value.trim()) {
          isValid = false;
          showFieldError(field, 'This field is required');
          errors.push(field.getAttribute('aria-label') || field.name);
        }
      });

      // Email validation
      var emailField = form.querySelector('input[type="email"]');
      if (emailField && emailField.value.trim()) {
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailField.value)) {
          isValid = false;
          showFieldError(emailField, 'Please enter a valid email address');
        }
      }

      // Phone validation (optional field, but validate format if filled)
      var phoneField = form.querySelector('input[type="tel"]');
      if (phoneField && phoneField.value.trim()) {
        var phoneClean = phoneField.value.replace(/[\s\-\(\)\.]/g, '');
        if (phoneClean.length < 10 || !/^\+?\d+$/.test(phoneClean)) {
          isValid = false;
          showFieldError(phoneField, 'Please enter a valid phone number');
        }
      }

      // PHI acknowledgment checkbox
      var phiCheckbox = form.querySelector('#phi-acknowledgment');
      if (phiCheckbox && !phiCheckbox.checked) {
        isValid = false;
        showFieldError(phiCheckbox, 'You must acknowledge this before submitting');
      }

      // PHI Content Scanning - warn about potential PHI in message
      var messageField = form.querySelector('textarea[name="message"]');
      if (messageField && messageField.value.trim()) {
        var phiWarnings = scanForPHI(messageField.value);
        if (phiWarnings.length > 0) {
          var proceed = confirm(
            'Your message may contain sensitive health information:\n\n' +
            '- ' + phiWarnings.join('\n- ') + '\n\n' +
            'This form is NOT a secure communication method. ' +
            'Please remove any protected health information (PHI) before submitting.\n\n' +
            'Do you want to go back and edit your message?'
          );
          if (proceed) {
            messageField.focus();
            return;
          }
        }
      }

      if (isValid) {
        // In production, this would submit to a secure server endpoint
        // For now, show success message
        showFormSuccess(form);
      } else {
        // Focus the first field with an error
        var firstError = form.querySelector('.form-input--error, .form-error');
        if (firstError) {
          var targetField = firstError.classList.contains('form-error')
            ? firstError.previousElementSibling
            : firstError;
          if (targetField && targetField.focus) targetField.focus();
        }

        // Announce errors for screen readers
        announceToScreenReader(errors.length + ' errors found. Please correct the highlighted fields.');
      }
    });

    // Real-time validation on blur
    var inputs = form.querySelectorAll('.form-input, .form-textarea, .form-select');
    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        if (this.hasAttribute('required') && !this.value.trim()) {
          showFieldError(this, 'This field is required');
        } else {
          clearFieldError(this);
        }
      });

      // Clear error on input
      input.addEventListener('input', function () {
        clearFieldError(this);
      });
    });
  }

  function showFieldError(field, message) {
    field.classList.add('form-input--error');
    field.style.borderColor = '#e74c3c';

    // Remove existing error message
    var existingError = field.parentNode.querySelector('.form-error');
    if (existingError) existingError.remove();

    var error = document.createElement('span');
    error.className = 'form-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;

    if (field.type === 'checkbox') {
      field.closest('.form-group').appendChild(error);
    } else {
      field.parentNode.appendChild(error);
    }
  }

  function clearFieldError(field) {
    field.classList.remove('form-input--error');
    field.style.borderColor = '';
    var error = field.parentNode.querySelector('.form-error');
    if (error) error.remove();
  }

  function showFormSuccess(form) {
    var successDiv = document.createElement('div');
    successDiv.className = 'notice notice--success';
    successDiv.setAttribute('role', 'alert');
    successDiv.innerHTML =
      '<span class="notice__icon">&#10003;</span>' +
      '<div>' +
      '<p><strong>Thank you for contacting us!</strong></p>' +
      '<p>We have received your message and will respond within 1-2 business days. ' +
      'If you need immediate assistance, please call our office at ' +
      '<a href="tel:+16418562688">(641) 856-2688</a>.</p>' +
      '</div>';

    form.style.display = 'none';
    form.parentNode.insertBefore(successDiv, form);

    // Scroll to success message
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Basic PHI pattern detection for contact form
   * Warns users if their message appears to contain health information
   */
  function scanForPHI(text) {
    var warnings = [];
    var lowerText = text.toLowerCase();

    // Check for medication names patterns
    if (/\b(mg|milligram|prescription|medication|medicine|dosage|refill)\b/i.test(text)) {
      warnings.push('Possible medication or prescription information detected');
    }

    // Check for diagnostic terms
    if (/\b(diagnos|disorder|syndrome|condition|symptoms?)\b/i.test(text)) {
      warnings.push('Possible diagnostic or medical condition information detected');
    }

    // Check for SSN patterns
    if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(text)) {
      warnings.push('Possible Social Security Number detected');
    }

    // Check for date of birth patterns
    if (/\b(date of birth|dob|born on|birthday)\b/i.test(text)) {
      warnings.push('Possible date of birth information detected');
    }

    // Check for insurance ID patterns
    if (/\b(member\s*id|policy\s*number|group\s*number|insurance\s*id|subscriber\s*id)\b/i.test(text)) {
      warnings.push('Possible insurance identification information detected');
    }

    // Check for detailed health descriptions
    if (/\b(suicid|self.?harm|overdos|abuse|assault|rape)\b/i.test(text)) {
      warnings.push('Sensitive health information detected - please use secure portal or call us directly');
    }

    return warnings;
  }

  // ==========================================
  // Screen Reader Announcements
  // ==========================================
  function announceToScreenReader(message) {
    var announcer = document.getElementById('sr-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.className = 'visually-hidden';
      document.body.appendChild(announcer);
    }
    announcer.textContent = '';
    setTimeout(function () {
      announcer.textContent = message;
    }, 100);
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
  // HIPAA Compliance - Session Timeout Warning
  // ==========================================
  function initSessionWarning() {
    // Only initialize if there's a form on the page
    var form = document.getElementById('contact-form');
    if (!form) return;

    var warningTimeout;
    var hasStartedTyping = false;

    form.addEventListener('input', function () {
      if (!hasStartedTyping) {
        hasStartedTyping = true;
      }

      // Reset timeout
      clearTimeout(warningTimeout);

      // Warn after 15 minutes of inactivity while filling form
      warningTimeout = setTimeout(function () {
        if (hasStartedTyping) {
          announceToScreenReader('You have been inactive for 15 minutes. Please submit or clear the form to protect your information.');
        }
      }, 15 * 60 * 1000);
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
    initContactForm();
    initSmoothScroll();
    initHeaderScroll();
    initScrollAnimations();
    initPhoneFormatting();
    initPrintButtons();
    initBackToTop();
    initActiveNav();
    initSessionWarning();
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
