const updateRankingOptions = (group) => {
  const selects = Array.from(group.querySelectorAll('.ranking-select'));
  const selectedValues = selects.map(select => select.value).filter(Boolean);
  selects.forEach(select => {
    Array.from(select.options).forEach(option => {
      if (!option.value) return;
      if (option.value === select.value) {
        option.disabled = false;
      } else {
        option.disabled = selectedValues.includes(option.value);
      }
    });
  });
};

const initRankingGroups = () => {
  document.querySelectorAll('.ranking-group').forEach(group => {
    updateRankingOptions(group);
    group.addEventListener('change', () => updateRankingOptions(group));
  });
};

const initCheckboxLimits = () => {
  document.querySelectorAll('.checkbox-grid').forEach(grid => {
    const limit = Number(grid.dataset.limit || 0);
    if (!limit) return;
    grid.addEventListener('change', () => {
      const checked = grid.querySelectorAll('input[type="checkbox"]:checked');
      if (checked.length > limit) {
        checked[checked.length - 1].checked = false;
      }
    });
  });
};

const initDriverToggles = () => {
  document.querySelectorAll('select[data-toggle-driver]').forEach(select => {
    const id = select.dataset.toggleDriver;
    const radios = document.querySelectorAll(`input[name="${id}"]`);
    const update = () => {
      const selected = Array.from(radios).find(radio => radio.checked)?.value;
      select.disabled = selected !== 'yes';
    };
    radios.forEach(radio => radio.addEventListener('change', update));
    update();
  });
};

const initTeammateDiffToggles = () => {
  document.querySelectorAll('select[data-toggle-diff]').forEach(select => {
    const id = select.dataset.toggleDiff;
    const diffInput = document.querySelector(`input[data-diff-for="${id}"]`);
    if (!diffInput) return;
    const update = () => {
      const tieSelected = select.value === 'tie';
      diffInput.disabled = tieSelected;
      if (tieSelected) diffInput.value = '';
    };
    select.addEventListener('change', update);
    update();
  });
};

const initNumberClamps = () => {
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value === '') return;
      const value = Number(input.value);
      if (Number.isNaN(value)) return;
      const min = input.min !== '' ? Number(input.min) : null;
      const max = input.max !== '' ? Number(input.max) : null;
      let next = value;
      if (min != null && !Number.isNaN(min)) next = Math.max(min, next);
      if (max != null && !Number.isNaN(max)) next = Math.min(max, next);
      if (next !== value) {
        input.value = String(next);
      }
    });
  });
};

const initCountdown = () => {
  const el = document.querySelector('.countdown');
  if (!el) return;
  const valueEl = el.querySelector('.countdown-value');
  if (!valueEl) return;
  const brandTimerEls = Array.from(document.querySelectorAll('[data-brand-mobile-timer-value]'));
  const rawDate = el.dataset.closeDate;
  const target = new Date(rawDate);
  if (Number.isNaN(target.getTime())) return;
  const setTimerText = (text) => {
    valueEl.textContent = text;
    brandTimerEls.forEach(timerEl => {
      timerEl.textContent = text;
    });
  };

  const tick = () => {
    const now = new Date();
    let diff = target - now;
    if (diff <= 0) {
      setTimerText('Closed');
      return;
    }
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    setTimerText(`${days}d ${hours}h ${minutes}m`);
    requestAnimationFrame(() => setTimeout(tick, 30000));
  };
  tick();
};

const initCopyButtons = () => {
  document.querySelectorAll('[data-copy-target]').forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget;
      const target = document.getElementById(targetId);
      if (!target) return;
      const text = (target.dataset.copyValue || target.textContent || '').trim();
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1500);
      } catch (err) {
        button.textContent = 'Failed';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1500);
      }
    });
  });
};

const initNameAvailabilityChecks = () => {
  document.querySelectorAll('input[data-name-check-url]').forEach(input => {
    const feedback = input.parentElement?.querySelector('[data-name-check-feedback]');
    const url = input.dataset.nameCheckUrl;
    if (!feedback || !url) return;

    const minLength = Number(input.dataset.nameCheckMinLength || 2);
    const delay = Number(input.dataset.nameCheckDelay || 1200);
    const msgChecking = input.dataset.nameCheckMsgChecking || 'Checking...';
    const msgAvailable = input.dataset.nameCheckMsgAvailable || 'Name is available.';
    const msgTaken = input.dataset.nameCheckMsgTaken || 'Name already in use.';
    const msgError = input.dataset.nameCheckMsgError || 'Could not check name right now.';
    let timeoutId = null;
    let requestCounter = 0;
    let lastCheckedValue = '';

    const setStatus = (status, message) => {
      feedback.dataset.status = status || '';
      feedback.textContent = message || '';
    };

    const clearStatus = () => {
      setStatus('', '');
      input.setCustomValidity('');
    };

    const checkNow = async () => {
      const value = input.value.trim();
      if (value.length < minLength) {
        lastCheckedValue = '';
        clearStatus();
        return;
      }
      lastCheckedValue = value;
      const requestId = ++requestCounter;
      setStatus('checking', msgChecking);

      try {
        const separator = url.includes('?') ? '&' : '?';
        const response = await fetch(
          `${url}${separator}name=${encodeURIComponent(value)}`,
          { headers: { Accept: 'application/json' } }
        );
        if (requestId !== requestCounter) return;
        if (!response.ok) throw new Error(`Unexpected status: ${response.status}`);
        const payload = await response.json();
        if (requestId !== requestCounter) return;

        if (payload && payload.available) {
          input.setCustomValidity('');
          setStatus('available', msgAvailable);
        } else {
          input.setCustomValidity(msgTaken);
          setStatus('taken', msgTaken);
        }
      } catch (err) {
        if (requestId !== requestCounter) return;
        input.setCustomValidity('');
        setStatus('error', msgError);
      }
    };

    const queueCheck = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const value = input.value.trim();
      if (value.length < minLength) {
        requestCounter += 1;
        lastCheckedValue = '';
        clearStatus();
        return;
      }
      input.setCustomValidity('');
      setStatus('', '');
      timeoutId = setTimeout(() => {
        timeoutId = null;
        checkNow();
      }, delay);
    };

    input.addEventListener('input', queueCheck);
    input.addEventListener('blur', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const value = input.value.trim();
      if (value.length < minLength || value === lastCheckedValue) return;
      checkNow();
    });
  });
};

const initVisibilityToggle = () => {
  const visibility = document.querySelector('select[name="visibility"]');
  const passwordInput = document.querySelector('input[name="joinPassword"]');
  if (!visibility || !passwordInput) return;
  const update = () => {
    const isPublic = visibility.value === 'public';
    passwordInput.required = !isPublic;
    passwordInput.disabled = isPublic;
    if (isPublic) passwordInput.value = '';
  };
  visibility.addEventListener('change', update);
  update();
};

const initQuestionsCouplingToggle = () => {
  const toggle = document.querySelector('[data-couple-toggle]');
  const fields = document.querySelector('[data-coupled-fields]');
  if (!toggle || !fields) return;

  const sync = () => {
    fields.disabled = toggle.checked;
  };

  toggle.addEventListener('change', sync);
  sync();
};

const initThemeToggle = () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  const logos = Array.from(document.querySelectorAll('[data-logo-light][data-logo-dark]'));
  if (!toggle && logos.length === 0) return;

  const root = document.documentElement;
  const labelEl = toggle ? toggle.querySelector('[data-theme-toggle-label]') : null;
  const labelDark = toggle ? (toggle.dataset.labelDark || 'Dark mode') : 'Dark mode';
  const labelLight = toggle ? (toggle.dataset.labelLight || 'Light mode') : 'Light mode';
  const isValidTheme = (value) => value === 'dark' || value === 'light';
  const getPreferredTheme = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  const getTheme = () => {
    const attrTheme = root.getAttribute('data-theme');
    if (isValidTheme(attrTheme)) return attrTheme;

    try {
      const storedTheme = localStorage.getItem('theme');
      if (isValidTheme(storedTheme)) return storedTheme;
    } catch (err) {
      // ignore storage errors
    }
    return getPreferredTheme();
  };
  const syncLogos = (theme) => {
    logos.forEach((img) => {
      const lightSrc = img.dataset.logoLight;
      const darkSrc = img.dataset.logoDark;
      const nextSrc = theme === 'dark' ? darkSrc : lightSrc;
      if (nextSrc && img.getAttribute('src') !== nextSrc) {
        img.setAttribute('src', nextSrc);
      }
    });
  };
  const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (err) {
      // ignore storage errors
    }
    syncLogos(theme);
    const nextLabel = theme === 'dark' ? labelLight : labelDark;
    if (toggle) {
      toggle.setAttribute('aria-label', nextLabel);
      toggle.setAttribute('title', nextLabel);
    }
    if (labelEl) {
      labelEl.textContent = nextLabel;
    }
  };

  setTheme(getTheme());

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }
};

const initHeaderMenu = () => {
  const header = document.querySelector('header');
  const toggle = document.querySelector('[data-header-menu-toggle]');
  const menu = document.querySelector('[data-header-menu]');
  if (!header || !toggle || !menu) return;

  const TIMER_COMPACT_WIDTH = 1000;
  const MENU_COLLAPSE_WIDTH = 800;
  const TIMER_COMPACT_COLLAPSED_WIDTH = 600;

  const isOpen = () => menu.classList.contains('is-open');
  const isCollapsed = () => header.classList.contains('is-collapsed');
  const closeMenu = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.querySelectorAll('details[open]').forEach(details => {
      details.open = false;
    });
  };
  const openMenu = () => {
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };
  const syncLayout = () => {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const shouldCollapseMenu = width <= MENU_COLLAPSE_WIDTH;
    const shouldCompactTimer =
      (width <= TIMER_COMPACT_WIDTH && !shouldCollapseMenu) ||
      width <= TIMER_COMPACT_COLLAPSED_WIDTH;

    header.classList.toggle('is-collapsed', shouldCollapseMenu);
    header.classList.toggle('is-time-compact', shouldCompactTimer);

    if (!shouldCollapseMenu) {
      closeMenu();
    }
  };

  toggle.addEventListener('click', (event) => {
    if (!isCollapsed()) return;
    event.stopPropagation();
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!isCollapsed()) return;
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menu.contains(target) || toggle.contains(target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (!isCollapsed()) return;
    if (event.key !== 'Escape') return;
    if (!isOpen()) return;
    closeMenu();
  });

  menu.addEventListener('click', (event) => {
    if (!isCollapsed()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const closeTrigger = target.closest('a.link, .account-name-link, [data-theme-toggle]');
    if (!closeTrigger) return;
    closeMenu();
  });

  window.addEventListener('resize', syncLayout);
  window.addEventListener('load', syncLayout);
  syncLayout();
};

const initScrollToEndButton = () => {
  const button = document.querySelector('[data-scroll-to-end]');
  if (!button) return;

  const targetSelector = button.dataset.scrollToEndTarget || '';
  const target = targetSelector ? document.querySelector(targetSelector) : null;
  if (!target) return;

  const updateVisibility = () => {
    const nearBottom =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
    button.classList.toggle('is-hidden', nearBottom);
  };

  button.addEventListener('click', () => {
    target.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility);
  updateVisibility();
};

const initLeaderboardMemberSwitcher = () => {
  document.querySelectorAll('[data-member-switcher]').forEach(switcher => {
    const strip = switcher.querySelector('[data-member-strip]');
    const prevButton = switcher.querySelector('[data-member-scroll="prev"]');
    const nextButton = switcher.querySelector('[data-member-scroll="next"]');
    const tabs = Array.from(switcher.querySelectorAll('[data-member-tab]'));
    if (!strip || !prevButton || !nextButton || tabs.length === 0) return;

    const getActiveIndex = () => {
      const idx = tabs.findIndex(tab => tab.classList.contains('is-active'));
      return idx >= 0 ? idx : 0;
    };

    const updateArrowState = () => {
      const canScroll = strip.scrollWidth > strip.clientWidth + 1;
      prevButton.classList.toggle('is-hidden', !canScroll);
      nextButton.classList.toggle('is-hidden', !canScroll);
      if (!canScroll) {
        prevButton.disabled = true;
        nextButton.disabled = true;
        return;
      }
      const activeIndex = getActiveIndex();
      prevButton.disabled = activeIndex <= 0;
      nextButton.disabled = activeIndex >= tabs.length - 1;
    };

    const activateTab = (targetTab, options = {}) => {
      const { moveFocus = false, ensureVisible = true } = options;
      const targetId = targetTab.dataset.target || '';
      tabs.forEach(tab => {
        const isActive = tab === targetTab;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        if (moveFocus && isActive) {
          try {
            tab.focus({ preventScroll: true });
          } catch (err) {
            tab.focus();
          }
        }
        const panelId = tab.dataset.target || '';
        if (!panelId) return;
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });
      if (ensureVisible) {
        targetTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (index + step + tabs.length) % tabs.length;
        activateTab(tabs[nextIndex], { moveFocus: true });
      });
    });

    prevButton.addEventListener('click', () => {
      const activeIndex = getActiveIndex();
      if (activeIndex <= 0) return;
      activateTab(tabs[activeIndex - 1], { moveFocus: false });
      updateArrowState();
    });
    nextButton.addEventListener('click', () => {
      const activeIndex = getActiveIndex();
      if (activeIndex >= tabs.length - 1) return;
      activateTab(tabs[activeIndex + 1], { moveFocus: false });
      updateArrowState();
    });

    strip.addEventListener('scroll', updateArrowState, { passive: true });
    window.addEventListener('resize', updateArrowState);
    updateArrowState();
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initHeaderMenu();
  initThemeToggle();
  initRankingGroups();
  initCheckboxLimits();
  initDriverToggles();
  initTeammateDiffToggles();
  initNumberClamps();
  initCountdown();
  initCopyButtons();
  initNameAvailabilityChecks();
  initVisibilityToggle();
  initQuestionsCouplingToggle();
  initScrollToEndButton();
  initLeaderboardMemberSwitcher();
});
