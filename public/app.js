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
  const rawDate = el.dataset.closeDate;
  const target = new Date(rawDate);
  if (Number.isNaN(target.getTime())) return;

  const tick = () => {
    const now = new Date();
    let diff = target - now;
    if (diff <= 0) {
      valueEl.textContent = 'Closed';
      return;
    }
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    valueEl.textContent = `${days}d ${hours}h ${minutes}m`;
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
      const text = target.textContent.trim();
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

document.addEventListener('DOMContentLoaded', () => {
  initRankingGroups();
  initCheckboxLimits();
  initDriverToggles();
  initTeammateDiffToggles();
  initNumberClamps();
  initCountdown();
  initCopyButtons();
  initVisibilityToggle();
});
