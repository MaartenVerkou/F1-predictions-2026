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
  const prefixEl = el.querySelector('.muted');
  const prefixText = el.dataset.countdownPrefix || prefixEl?.textContent || '';
  const closedText = el.dataset.countdownClosed || 'Predictions are closed!';
  const closedDisplayText = el.dataset.countdownClosedDisplay || closedText;
  const compactClosedText = el.dataset.countdownClosedCompact || 'Closed!';
  const headerEl = document.querySelector('header');
  const rawDate = el.dataset.closeDate;
  const target = new Date(rawDate);
  if (Number.isNaN(target.getTime())) return;
  let isClosed = false;

  const syncClosedClass = () => {
    el.classList.toggle('is-closed', isClosed);
  };
  const getClosedDisplayText = () =>
    headerEl?.classList.contains('is-time-compact') ? compactClosedText : closedDisplayText;
  const setPrefixText = (text) => {
    if (prefixEl) prefixEl.textContent = text;
  };
  const setTimerText = (text) => {
    valueEl.textContent = text;
  };
  const setTimerMarkup = (html) => {
    valueEl.innerHTML = html;
  };
  const applyClosedState = () => {
    syncClosedClass();
    setPrefixText('');
    el.setAttribute('aria-label', closedText);
    el.setAttribute('title', closedText);
    valueEl.setAttribute('title', closedText);
    setTimerText(getClosedDisplayText());
  };
  const formatHmsMarkup = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    const parts = [
      { value: hours, unit: 'H' },
      { value: String(minutes).padStart(2, '0'), unit: 'M' },
      { value: String(seconds).padStart(2, '0'), unit: 'S' }
    ];
    return parts
      .map(({ value, unit }) =>
        `<span class="countdown-segment"><span class="countdown-number">${value}</span><span class="countdown-unit">${unit}</span></span>`
      )
      .join(' ');
  };

  const tick = () => {
    const now = new Date();
    let diff = target - now;
    if (diff <= 0) {
      isClosed = true;
      applyClosedState();
      return;
    }
    isClosed = false;
    syncClosedClass();
    setPrefixText(prefixText);
    const totalSeconds = Math.floor(diff / 1000);
    if (totalSeconds < 24 * 60 * 60) {
      setTimerMarkup(formatHmsMarkup(totalSeconds));
      setTimeout(tick, 1000);
      return;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    setTimerText(`${days}d ${hours}h ${minutes}m`);
    setTimeout(tick, 30000);
  };
  window.addEventListener('resize', () => {
    if (isClosed) {
      applyClosedState();
    }
  });
  tick();
};

const initCopyButtons = () => {
  document.querySelectorAll('[data-copy-target]').forEach(button => {
    const originalHtml = button.innerHTML;
    const originalAriaLabel = button.getAttribute('aria-label') || '';
    const originalTitle = button.getAttribute('title') || '';
    let resetTimeoutId = null;

    const restoreButton = () => {
      button.innerHTML = originalHtml;
      if (originalAriaLabel) button.setAttribute('aria-label', originalAriaLabel);
      if (originalTitle) button.setAttribute('title', originalTitle);
      resetTimeoutId = null;
    };

    const showTemporaryState = (label) => {
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
      }
      resetTimeoutId = setTimeout(restoreButton, 1500);
    };

    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget;
      const target = document.getElementById(targetId);
      if (!target) return;
      const text = (target.dataset.copyValue || target.textContent || '').trim();
      try {
        await navigator.clipboard.writeText(text);
        showTemporaryState('Copied');
      } catch (err) {
        showTemporaryState('Failed');
      }
    });
  });
};

const findLeaderboardSeriesElements = (seriesId) =>
  Array.from(document.querySelectorAll('[data-chart-series]'))
    .filter(series => series.dataset.chartSeries === seriesId);

const setLeaderboardSeriesHover = (seriesId, isHovered) => {
  if (!seriesId) return;
  findLeaderboardSeriesElements(seriesId).forEach(series => {
    series.classList.toggle('is-hovered', isHovered);
  });
  document.querySelectorAll('.leaderboard-chart-legend-item[data-chart-legend-item]').forEach(item => {
    item.classList.toggle('is-hovered', item.dataset.chartLegendItem === seriesId && isHovered);
  });
  document.querySelectorAll('.leaderboard-rank-row[data-leaderboard-row-participant]').forEach(row => {
    row.classList.toggle('is-hovered', row.dataset.leaderboardRowParticipant === seriesId && isHovered);
  });
};

const syncLeaderboardChartToggle = (input) => {
  const seriesId = input.dataset.chartSeriesToggle;
  if (!seriesId) return;
  const control = input.closest('.leaderboard-chart-legend-item');
  const seriesElements = findLeaderboardSeriesElements(seriesId);
  if (seriesElements.length === 0) return;

  seriesElements.forEach(series => {
    if (input.checked) {
      series.removeAttribute('hidden');
    } else {
      series.setAttribute('hidden', '');
    }
  });
  if (control) {
    control.classList.toggle('is-muted', !input.checked);
  }
};

const initLeaderboardChartToggles = (root = document) => {
  root.querySelectorAll('.leaderboard-chart-toggle[data-chart-series-toggle]').forEach(input => {
    if (input.dataset.chartToggleReady === 'true') {
      syncLeaderboardChartToggle(input);
      return;
    }
    input.dataset.chartToggleReady = 'true';
    const seriesId = input.dataset.chartSeriesToggle;
    if (!seriesId) return;

    input.addEventListener('change', () => syncLeaderboardChartToggle(input));
    syncLeaderboardChartToggle(input);
  });
};

const initLeaderboardChartHover = (root = document) => {
  const bindHoverTarget = (item, seriesId) => {
    if (item.dataset.chartHoverReady === 'true') return;
    item.dataset.chartHoverReady = 'true';
    if (!seriesId) return;

    item.addEventListener('mouseenter', () => setLeaderboardSeriesHover(seriesId, true));
    item.addEventListener('mouseleave', () => setLeaderboardSeriesHover(seriesId, false));
    item.addEventListener('focusin', () => setLeaderboardSeriesHover(seriesId, true));
    item.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!item.contains(document.activeElement)) {
          setLeaderboardSeriesHover(seriesId, false);
        }
      }, 0);
    });
  };

  root.querySelectorAll('.leaderboard-chart-legend-item[data-chart-legend-item]').forEach(item => {
    bindHoverTarget(item, item.dataset.chartLegendItem);
  });

  root.querySelectorAll('.leaderboard-rank-row[data-leaderboard-row-participant]').forEach(item => {
    bindHoverTarget(item, item.dataset.leaderboardRowParticipant);
  });

  root.querySelectorAll('.leaderboard-chart-series[data-chart-series]').forEach(item => {
    bindHoverTarget(item, item.dataset.chartSeries);
  });
};

let leaderboardParticipantSelectionReady = false;
let leaderboardParticipantSelectionRequest = 0;

const collectHiddenLeaderboardSeries = () =>
  new Set(
    Array.from(document.querySelectorAll('.leaderboard-chart-toggle[data-chart-series-toggle]:not(:checked)'))
      .map(input => input.dataset.chartSeriesToggle)
      .filter(Boolean)
  );

const applyHiddenLeaderboardSeries = (hiddenSeriesIds, root = document) => {
  hiddenSeriesIds.forEach(seriesId => {
    root.querySelectorAll('.leaderboard-chart-toggle[data-chart-series-toggle]').forEach(input => {
      if (input.dataset.chartSeriesToggle === seriesId) {
        input.checked = false;
      }
    });
  });
};

const updateLeaderboardFromUrl = async (url, { pushHistory = true } = {}) => {
  const currentLayout = document.querySelector('.leaderboard-layout');
  if (!currentLayout) {
    window.location.href = url;
    return;
  }

  const requestId = ++leaderboardParticipantSelectionRequest;
  const hiddenSeriesIds = collectHiddenLeaderboardSeries();
  currentLayout.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'X-Requested-With': 'fetch'
      },
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`Leaderboard selection failed with status ${response.status}`);
    const html = await response.text();
    if (requestId !== leaderboardParticipantSelectionRequest) return;

    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextLayout = nextDocument.querySelector('.leaderboard-layout');
    if (!nextLayout) throw new Error('Leaderboard selection response did not include layout.');

    currentLayout.replaceWith(nextLayout);
    document.title = nextDocument.title || document.title;
    applyHiddenLeaderboardSeries(hiddenSeriesIds, document);
    initLeaderboardChartToggles(document);
    initLeaderboardChartHover(document);

    if (pushHistory) {
      window.history.pushState({ leaderboardUrl: url }, '', url);
    }
  } catch (err) {
    window.location.href = url;
  } finally {
    const nextCurrentLayout = document.querySelector('.leaderboard-layout');
    if (nextCurrentLayout) {
      nextCurrentLayout.removeAttribute('aria-busy');
    }
  }
};

const initLeaderboardParticipantSelection = () => {
  if (leaderboardParticipantSelectionReady) return;
  leaderboardParticipantSelectionReady = true;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[data-leaderboard-participant-link]');
    const interactive = target.closest('a, button, input, select, textarea, label');
    const row = interactive ? null : target.closest('.leaderboard-rank-row[data-leaderboard-row-href]');
    const href = link?.href || row?.dataset.leaderboardRowHref;
    if (!href) return;
    const nextUrl = new URL(href, window.location.href);
    if (nextUrl.origin !== window.location.origin) return;

    event.preventDefault();
    updateLeaderboardFromUrl(nextUrl.toString());
  });

  window.addEventListener('popstate', () => {
    if (document.querySelector('.leaderboard-layout')) {
      updateLeaderboardFromUrl(window.location.href, { pushHistory: false });
    }
  });
};

const initNumberSpinners = () => {
  document.querySelectorAll('[data-number-spinner]').forEach(spinner => {
    const input = spinner.querySelector('input[type="number"]');
    if (!input) return;

    const toStep = () => {
      const parsed = Number(input.step);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };
    const toMin = () => {
      const parsed = Number(input.min);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const toMax = () => {
      const parsed = Number(input.max);
      return Number.isFinite(parsed) ? parsed : null;
    };

    spinner.querySelectorAll('[data-spinner-step]').forEach(button => {
      button.addEventListener('click', () => {
        if (input.disabled || input.readOnly) return;
        const direction = button.dataset.spinnerStep === 'down' ? -1 : 1;
        const step = toStep();
        const min = toMin();
        const max = toMax();
        const current = input.value === '' ? (min != null ? min : 0) : Number(input.value);
        const safeCurrent = Number.isFinite(current) ? current : (min != null ? min : 0);
        let next = safeCurrent + direction * step;
        if (min != null) next = Math.max(min, next);
        if (max != null) next = Math.min(max, next);
        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus({ preventScroll: true });
      });
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
        const emailValue = String(
          input.form?.querySelector('input[name="email"]')?.value || ''
        ).trim();
        const emailParam = emailValue
          ? `&email=${encodeURIComponent(emailValue.toLowerCase())}`
          : '';
        const response = await fetch(
          `${url}${separator}name=${encodeURIComponent(value)}${emailParam}`,
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
  const privatePasswordField = document.querySelector('[data-private-password-field]');
  if (!visibility || !passwordInput) return;
  const update = () => {
    const isPublic = visibility.value === 'public';
    if (privatePasswordField) {
      privatePasswordField.hidden = isPublic;
    }
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

const initNamedGuestSaveFeedback = () => {
  const form = document.querySelector('form#predictions-form');
  if (!form) return;
  const saveButton = form.querySelector('[data-named-guest-save-button]');
  if (!saveButton) return;
  const bottomHint = form.querySelector('[data-named-guest-save-feedback]');
  const defaultLabel = saveButton.textContent.trim();
  const savingLabel = saveButton.dataset.savingLabel || 'Saving...';
  const savedLabel = saveButton.dataset.savedLabel || 'Saved';
  const failedLabel = saveButton.dataset.failedLabel || 'Autosave failed';
  let inFlight = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;

    if (bottomHint) {
      bottomHint.removeAttribute('hidden');
    }
    if (saveButton.disabled) return;

    inFlight = true;
    saveButton.textContent = savingLabel;
    saveButton.disabled = true;

    try {
      const payload = new URLSearchParams(new FormData(form)).toString();
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'text/html'
        },
        body: payload,
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Named guest save failed with status ${response.status}`);
      }

      saveButton.textContent = savedLabel;
      setTimeout(() => {
        saveButton.textContent = defaultLabel;
        saveButton.disabled = false;
      }, 900);
    } catch (err) {
      saveButton.textContent = failedLabel;
      setTimeout(() => {
        saveButton.textContent = defaultLabel;
        saveButton.disabled = false;
      }, 1200);
    } finally {
      inFlight = false;
    }
  });
};

const initPredictionsAutosave = () => {
  const form = document.getElementById('predictions-form');
  if (!form) return;
  if (form.querySelector('[data-named-guest-save-button]')) return;

  const saveButton = form.querySelector('[data-predictions-save-button]');
  if (!saveButton || saveButton.disabled) return;

  const defaultLabel = saveButton.textContent.trim() || 'Save predictions';
  const messages = {
    saving: saveButton.dataset.savingLabel || 'Saving...',
    saved: saveButton.dataset.savedLabel || 'Saved',
    failed: saveButton.dataset.failedLabel || 'Autosave failed'
  };

  const serializeForm = () => new URLSearchParams(new FormData(form)).toString();
  const setButtonState = (label, state = '', disabled = false) => {
    saveButton.textContent = label;
    if (state) saveButton.dataset.state = state;
    else delete saveButton.dataset.state;
    saveButton.disabled = disabled;
  };
  const setIdleButton = () => setButtonState(defaultLabel, '', false);
  let restoreTimer = null;
  const clearRestoreTimer = () => {
    if (!restoreTimer) return;
    clearTimeout(restoreTimer);
    restoreTimer = null;
  };
  const showTransientButtonState = (label, state, durationMs = 900) => {
    clearRestoreTimer();
    setButtonState(label, state, false);
    restoreTimer = setTimeout(() => {
      restoreTimer = null;
      if (inFlight) return;
      if (serializeForm() !== lastSavedPayload) return;
      setIdleButton();
    }, durationMs);
  };

  let debounceTimer = null;
  let inFlight = false;
  let pendingSave = false;
  let lastSavedPayload = serializeForm();

  const clearDebounce = () => {
    if (!debounceTimer) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  const saveNow = async () => {
    const payload = serializeForm();
    if (payload === lastSavedPayload) {
      showTransientButtonState(messages.saved, 'saved', 700);
      return;
    }
    if (inFlight) {
      pendingSave = true;
      return;
    }

    inFlight = true;
    pendingSave = false;
    clearRestoreTimer();
    setButtonState(messages.saving, 'saving', true);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'text/html'
        },
        body: payload,
        credentials: 'same-origin'
      });
      if (!response.ok) {
        throw new Error(`Autosave failed with status ${response.status}`);
      }
      lastSavedPayload = payload;
      showTransientButtonState(messages.saved, 'saved', 900);
    } catch (err) {
      clearRestoreTimer();
      setButtonState(messages.failed, 'failed', false);
      return;
    } finally {
      inFlight = false;
    }

    if (pendingSave || serializeForm() !== lastSavedPayload) {
      pendingSave = false;
      saveNow();
    }
  };

  const queueSave = () => {
    clearDebounce();
    setIdleButton();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      saveNow();
    }, 900);
  };

  form.addEventListener('input', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.closest('input, select, textarea')) return;
    queueSave();
  });

  form.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.closest('input, select, textarea')) return;
    queueSave();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearDebounce();
    await saveNow();
  });

  setIdleButton();
};

const initAdminActualsUnsavedState = () => {
  const form = document.querySelector('[data-admin-actuals-form]');
  if (!form) return;
  const note = form.querySelector('[data-admin-actuals-unsaved-note]');
  if (!note) return;

  const unsavedLabel = note.dataset.unsavedLabel || 'Unsaved changes';
  const savingLabel = note.dataset.savingLabel || 'Saving...';
  const initialDirty = form.dataset.initialDirty === 'true';

  const serializeForm = () => {
    const formData = new FormData(form);
    const entries = [];
    for (const [key, value] of formData.entries()) {
      entries.push(`${key}=${value}`);
    }
    return entries.join('&');
  };

  const initialSnapshot = serializeForm();

  const renderState = (state) => {
    note.classList.remove('is-visible', 'is-unsaved', 'is-saving');
    if (state === 'hidden') {
      note.textContent = '';
      return;
    }
    note.classList.add('is-visible');
    if (state === 'saving') {
      note.classList.add('is-saving');
      note.textContent = savingLabel;
      return;
    }
    note.classList.add('is-unsaved');
    note.textContent = unsavedLabel;
  };

  const syncState = () => {
    const isDirty = initialDirty || serializeForm() !== initialSnapshot;
    renderState(isDirty ? 'unsaved' : 'hidden');
  };

  form.addEventListener('input', syncState);
  form.addEventListener('change', syncState);
  form.addEventListener('submit', () => renderState('saving'));
  syncState();
};

const initSignupPasswordMatch = () => {
  const form = document.querySelector('form[data-signup-form]');
  if (!form) return;

  const passwordInput = form.querySelector('input[name="password"]');
  const confirmInput = form.querySelector('input[name="passwordConfirm"]');
  if (!passwordInput || !confirmInput) return;

  const mismatchMessage =
    confirmInput.dataset.passwordMismatchMessage || 'Passwords do not match.';

  const sync = () => {
    const shouldFail =
      confirmInput.value.length > 0 && passwordInput.value !== confirmInput.value;
    confirmInput.setCustomValidity(shouldFail ? mismatchMessage : '');
  };

  passwordInput.addEventListener('input', sync);
  confirmInput.addEventListener('input', sync);
  form.addEventListener('submit', (event) => {
    sync();
    if (form.checkValidity()) return;
    event.preventDefault();
    form.reportValidity();
  });
};

const initThemeToggle = () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle) return;

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
  const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (err) {
      // ignore storage errors
    }
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

  const LAYOUT_COLLAPSE_WIDTH = 980;
  const TIMER_COMPACT_WIDTH = 1000;
  const MENU_COLLAPSE_WIDTH = LAYOUT_COLLAPSE_WIDTH;
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
    const closeTrigger = target.closest('a.link, [data-theme-toggle]');
    if (!closeTrigger) return;
    closeMenu();
  });

  window.addEventListener('resize', syncLayout);
  window.addEventListener('load', syncLayout);
  syncLayout();

  if (document.fonts?.ready) {
    document.fonts.ready.then(syncLayout).catch(() => {});
  }
};

const initHeaderOffsets = () => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const devToolbar = document.querySelector('.dev-toolbar');
  if (!root || !header) return;

  const syncOffsets = () => {
    const headerHeight = Math.ceil(header.getBoundingClientRect().height || 0);
    const devToolbarHeight = devToolbar
      ? Math.ceil(devToolbar.getBoundingClientRect().height || 0)
      : 0;
    root.style.setProperty('--header-offset', `${headerHeight}px`);
    root.style.setProperty('--dev-toolbar-offset', `${devToolbarHeight}px`);
  };

  syncOffsets();
  window.addEventListener('resize', syncOffsets);
  window.addEventListener('load', syncOffsets);

  if (document.fonts?.ready) {
    document.fonts.ready.then(syncOffsets).catch(() => {});
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => syncOffsets());
    observer.observe(header);
    if (devToolbar) {
      observer.observe(devToolbar);
    }
  }
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

document.addEventListener('DOMContentLoaded', () => {
  initHeaderMenu();
  initHeaderOffsets();
  initThemeToggle();
  initRankingGroups();
  initCheckboxLimits();
  initDriverToggles();
  initTeammateDiffToggles();
  initNumberClamps();
  initNumberSpinners();
  initCountdown();
  initCopyButtons();
  initLeaderboardChartToggles();
  initLeaderboardChartHover();
  initLeaderboardParticipantSelection();
  initNameAvailabilityChecks();
  initVisibilityToggle();
  initQuestionsCouplingToggle();
  initNamedGuestSaveFeedback();
  initPredictionsAutosave();
  initAdminActualsUnsavedState();
  initSignupPasswordMatch();
  initScrollToEndButton();
});
