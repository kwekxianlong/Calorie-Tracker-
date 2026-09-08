(() => {
  "use strict";

  // ---- Goals (from food-reference.md) ----
  const GOAL_CALORIES = 1700;
  const GOAL_PROTEIN = 130;

  // ---- Food data (from food-reference.md) ----
  const FIXED_FOODS = [
    { id: "chicken", name: "Air fryer grilled chicken", portionLabel: "270g", calories: 300, protein: 53 },
    { id: "beef-butter", name: "Lean beef cubes + 1 tbsp butter", portionLabel: "250g beef + 14g butter", calories: 570, protein: 74 },
    { id: "fried-egg", name: "Fried egg", portionLabel: "1 large", calories: 90, protein: 6.3 },
    { id: "boiled-egg", name: "Boiled egg", portionLabel: "1 large", calories: 77, protein: 6.3 },
    { id: "oats-cocoa", name: "Oats + dark cocoa + cane sugar", portionLabel: "40g oats + 4g cocoa + 2g sugar", calories: 188, protein: 7.3 },
    { id: "samyang", name: "Samyang tangle protein pasta", portionLabel: "1 serving", calories: 400, protein: 16 },
    { id: "yogurt", name: "Greek yogurt", portionLabel: "120g", calories: 140, protein: 5.8 },
  ];

  // per 100g
  const SCALABLE_FOODS = [
    { id: "banana", name: "Banana", caloriesPer100: 89, proteinPer100: 1.1, defaultGrams: 120 },
    { id: "turkey-bacon", name: "Turkey bacon (cooked)", caloriesPer100: 380, proteinPer100: 30, defaultGrams: 100 },
    { id: "blueberries", name: "Frozen blueberries", caloriesPer100: 51, proteinPer100: 0.4, defaultGrams: 100 },
    { id: "potato", name: "Roasted potato, unpeeled", caloriesPer100: 93, proteinPer100: 2.5, defaultGrams: 200 },
  ];

  // ---- Date / storage key helpers ----
  function dateKeyFor(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayKey() {
    return dateKeyFor(new Date());
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function shiftDateKey(key, deltaDays) {
    const date = parseDateKey(key);
    date.setDate(date.getDate() + deltaDays);
    return dateKeyFor(date);
  }

  function storageKey(kind, dateKey) {
    return `calorie-tracker-${kind}-${dateKey || todayKey()}`;
  }

  function loadEntries(kind, dateKey) {
    try {
      const raw = localStorage.getItem(storageKey(kind, dateKey));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLog(entries) {
    localStorage.setItem(storageKey("log"), JSON.stringify(entries));
  }

  function saveWorkouts(entries) {
    localStorage.setItem(storageKey("workouts"), JSON.stringify(entries));
  }

  // ---- Custom catalog items (persist across days, not date-scoped) ----
  function loadCatalog(kind) {
    try {
      const raw = localStorage.getItem(`calorie-tracker-custom-${kind}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCatalog(kind, list) {
    localStorage.setItem(`calorie-tracker-custom-${kind}`, JSON.stringify(list));
  }

  // ---- Grocery list (persists across days, not date-scoped) ----
  function loadGroceryList() {
    try {
      const raw = localStorage.getItem("calorie-tracker-grocery-list");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveGroceryList() {
    localStorage.setItem("calorie-tracker-grocery-list", JSON.stringify(groceryList));
  }

  let currentDayKey = todayKey();
  let log = loadEntries("log");
  let workouts = loadEntries("workouts");
  let customFixedFoods = loadCatalog("fixed-foods");
  let customScalableFoods = loadCatalog("scalable-foods");
  let groceryList = loadGroceryList();
  let editingUid = null;
  let editingWorkoutUid = null;
  let lastAddedLogUid = null;
  let lastAddedWorkoutUid = null;
  let lastAddedFixedUid = null;
  let lastAddedScalableUid = null;
  let lastAddedGroceryName = null;

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ---- Motion helpers ----
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function animateNumberText(el, targetValue, { decimals = 0, suffix = "" } = {}) {
    if (!el) return;
    const prevValue = parseFloat(el.textContent);
    const start = isNaN(prevValue) ? targetValue : prevValue;

    if (prefersReducedMotion() || start === targetValue) {
      el.textContent = `${targetValue.toFixed(decimals)}${suffix}`;
      return;
    }

    const duration = 350;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (targetValue - start) * eased;
      el.textContent = `${current.toFixed(decimals)}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = `${targetValue.toFixed(decimals)}${suffix}`;
      }
    }

    requestAnimationFrame(tick);
  }

  function animateRemoval(rowEl, onDone) {
    if (!rowEl || prefersReducedMotion()) {
      onDone();
      return;
    }

    const height = rowEl.getBoundingClientRect().height;
    rowEl.style.maxHeight = `${height}px`;
    rowEl.style.overflow = "hidden";
    rowEl.style.transition =
      "opacity 0.2s ease, transform 0.2s ease, max-height 0.22s ease 0.02s, padding 0.22s ease 0.02s, margin 0.22s ease 0.02s";
    void rowEl.offsetHeight;
    rowEl.style.opacity = "0";
    rowEl.style.transform = "scale(0.97)";

    requestAnimationFrame(() => {
      rowEl.style.maxHeight = "0px";
      rowEl.style.paddingTop = "0px";
      rowEl.style.paddingBottom = "0px";
      rowEl.style.marginTop = "0px";
      rowEl.style.marginBottom = "0px";
      rowEl.style.borderBottomColor = "transparent";
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDone();
    };
    rowEl.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 280);
  }

  // ---- Rendering ----
  function renderDate() {
    const el = document.getElementById("today-date");
    const d = new Date();
    el.textContent = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function renderCountdown() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    let diff = Math.max(0, nextMidnight - now);
    const h = Math.floor(diff / 3600000);
    diff -= h * 3600000;
    const m = Math.floor(diff / 60000);
    diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    document.getElementById("reset-countdown").textContent =
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderFixedFoods() {
    const container = document.getElementById("fixed-food-list");
    container.innerHTML = "";
    FIXED_FOODS.concat(customFixedFoods).forEach((food) => {
      const row = document.createElement("div");
      row.className = "food-item";
      if (food.custom && food.uid === lastAddedFixedUid) row.classList.add("item-enter");
      row.innerHTML = `
        <div class="food-info">
          <p class="food-name">${escapeHtml(food.name)}</p>
          <p class="food-meta"><span class="cal">${food.calories} kcal</span> · ${round1(food.protein)}g protein · ${escapeHtml(food.portionLabel)}</p>
        </div>
        <div class="food-controls">
          ${food.custom ? `<button class="remove-btn" aria-label="Remove ${escapeHtml(food.name)} from list">×</button>` : ""}
          <button class="add-btn" aria-label="Add ${escapeHtml(food.name)}">+</button>
        </div>
      `;
      row.querySelector(".add-btn").addEventListener("click", () => {
        addEntry({
          name: food.name,
          portionLabel: food.portionLabel,
          calories: food.calories,
          protein: food.protein,
        });
      });
      if (food.custom) {
        row.querySelector(".remove-btn").addEventListener("click", () => {
          animateRemoval(row, () => removeCustomFixedFood(food.uid));
        });
      }
      container.appendChild(row);
    });
    lastAddedFixedUid = null;
  }

  function renderScalableFoods() {
    const container = document.getElementById("scalable-food-list");
    container.innerHTML = "";
    SCALABLE_FOODS.concat(customScalableFoods).forEach((food) => {
      const row = document.createElement("div");
      row.className = "food-item";
      if (food.custom && food.uid === lastAddedScalableUid) row.classList.add("item-enter");
      row.innerHTML = `
        <div class="food-info">
          <p class="food-name">${escapeHtml(food.name)}</p>
          <p class="food-meta">${food.caloriesPer100} kcal · ${food.proteinPer100}g protein / 100g</p>
        </div>
        <div class="food-controls">
          ${food.custom ? `<button class="remove-btn" aria-label="Remove ${escapeHtml(food.name)} from list">×</button>` : ""}
          <input type="number" class="gram-input" min="1" step="1" value="${food.defaultGrams}" aria-label="Grams of ${escapeHtml(food.name)}">
          <button class="add-btn" aria-label="Add ${escapeHtml(food.name)}">+</button>
        </div>
      `;
      const input = row.querySelector(".gram-input");
      const addScaledFood = () => {
        const grams = parseFloat(input.value);
        if (!grams || grams <= 0) {
          input.focus();
          return;
        }
        const factor = grams / 100;
        addEntry({
          name: food.name,
          portionLabel: `${grams}g`,
          calories: Math.round(food.caloriesPer100 * factor),
          protein: round1(food.proteinPer100 * factor),
        });
      };
      row.querySelector(".add-btn").addEventListener("click", addScaledFood);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addScaledFood();
        }
      });
      if (food.custom) {
        row.querySelector(".remove-btn").addEventListener("click", () => {
          animateRemoval(row, () => removeCustomScalableFood(food.uid));
        });
      }
      container.appendChild(row);
    });
    lastAddedScalableUid = null;
  }

  function addCustomFixedFood(base) {
    const food = {
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: base.name,
      portionLabel: base.portionLabel,
      calories: base.calories,
      protein: base.protein,
      custom: true,
    };
    customFixedFoods.push(food);
    saveCatalog("fixed-foods", customFixedFoods);
    lastAddedFixedUid = food.uid;
    renderFixedFoods();
    renderGroceryChips();
  }

  function removeCustomFixedFood(uid) {
    const index = customFixedFoods.findIndex((f) => f.uid === uid);
    if (index === -1) return;
    const [removed] = customFixedFoods.splice(index, 1);
    saveCatalog("fixed-foods", customFixedFoods);
    renderFixedFoods();
    renderGroceryChips();

    showUndoToast(`Removed ${removed.name} from list`, () => {
      customFixedFoods.splice(index, 0, removed);
      saveCatalog("fixed-foods", customFixedFoods);
      lastAddedFixedUid = removed.uid;
      renderFixedFoods();
      renderGroceryChips();
    });
  }

  function addCustomScalableFood(base) {
    const food = {
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: base.name,
      caloriesPer100: base.caloriesPer100,
      proteinPer100: base.proteinPer100,
      defaultGrams: base.defaultGrams,
      custom: true,
    };
    customScalableFoods.push(food);
    saveCatalog("scalable-foods", customScalableFoods);
    lastAddedScalableUid = food.uid;
    renderScalableFoods();
    renderGroceryChips();
  }

  function removeCustomScalableFood(uid) {
    const index = customScalableFoods.findIndex((f) => f.uid === uid);
    if (index === -1) return;
    const [removed] = customScalableFoods.splice(index, 1);
    saveCatalog("scalable-foods", customScalableFoods);
    renderScalableFoods();
    renderGroceryChips();

    showUndoToast(`Removed ${removed.name} from list`, () => {
      customScalableFoods.splice(index, 0, removed);
      saveCatalog("scalable-foods", customScalableFoods);
      lastAddedScalableUid = removed.uid;
      renderScalableFoods();
      renderGroceryChips();
    });
  }

  // ---- Grocery list ----
  function getAllIngredientNames() {
    const names = [
      ...FIXED_FOODS.map((f) => f.name),
      ...customFixedFoods.map((f) => f.name),
      ...SCALABLE_FOODS.map((f) => f.name),
      ...customScalableFoods.map((f) => f.name),
    ];
    return Array.from(new Set(names));
  }

  function renderGroceryChips() {
    const chipGrid = document.getElementById("grocery-chip-grid");
    chipGrid.innerHTML = "";
    getAllIngredientNames().forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "grocery-chip";
      if (groceryList.includes(name)) chip.classList.add("selected");
      chip.textContent = name;
      chip.addEventListener("click", () => toggleGroceryItem(name));
      chipGrid.appendChild(chip);
    });
  }

  function renderGroceryToBuy() {
    const container = document.getElementById("grocery-list");
    container.innerHTML = "";

    if (groceryList.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.id = "grocery-empty-state";
      empty.textContent = "Nothing added yet — tap an ingredient above.";
      container.appendChild(empty);
      lastAddedGroceryName = null;
      return;
    }

    groceryList.forEach((name) => {
      const row = document.createElement("div");
      row.className = "log-item";
      row.dataset.name = name;
      if (name === lastAddedGroceryName) row.classList.add("item-enter");
      row.innerHTML = `
        <div class="log-info">
          <p class="log-name">${escapeHtml(name)}</p>
        </div>
        <div class="log-item-actions">
          <button class="remove-btn" aria-label="Remove ${escapeHtml(name)}">×</button>
        </div>
      `;
      row.querySelector(".remove-btn").addEventListener("click", () => {
        animateRemoval(row, () => removeGroceryItem(name));
      });
      container.appendChild(row);
    });
    lastAddedGroceryName = null;
  }

  function renderGrocery() {
    renderGroceryChips();
    renderGroceryToBuy();
  }

  function toggleGroceryItem(name) {
    if (groceryList.includes(name)) {
      const row = document.querySelector(`#grocery-list .log-item[data-name="${CSS.escape(name)}"]`);
      if (row) {
        animateRemoval(row, () => removeGroceryItem(name));
        renderGroceryChips();
      } else {
        removeGroceryItem(name);
      }
    } else {
      groceryList.push(name);
      lastAddedGroceryName = name;
      saveGroceryList();
      renderGrocery();
    }
  }

  function removeGroceryItem(name) {
    const index = groceryList.indexOf(name);
    if (index === -1) return;
    groceryList.splice(index, 1);
    saveGroceryList();
    renderGrocery();
  }

  function clearGroceryList() {
    if (groceryList.length === 0) return;
    const previous = groceryList;
    const count = previous.length;
    groceryList = [];
    saveGroceryList();
    renderGrocery();

    showUndoToast(`Cleared ${count} grocery item${count === 1 ? "" : "s"}`, () => {
      groceryList = previous;
      saveGroceryList();
      renderGrocery();
    });
  }

  function renderLog() {
    const container = document.getElementById("log-list");
    container.innerHTML = "";

    if (log.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.id = "empty-state";
      empty.textContent = "No food logged yet today.";
      container.appendChild(empty);
      return;
    }

    log.forEach((entry) => {
      if (entry.uid === editingUid) {
        container.appendChild(buildEditRow(entry));
        return;
      }

      const row = document.createElement("div");
      row.className = "log-item";
      if (entry.uid === lastAddedLogUid) row.classList.add("item-enter");
      row.innerHTML = `
        <div class="log-info">
          <p class="log-name">${escapeHtml(entry.name)}</p>
          <p class="log-meta"><span class="cal">${entry.calories} kcal</span> · ${round1(entry.protein)}g protein · ${escapeHtml(entry.portionLabel)} · ${entry.time}</p>
        </div>
        <div class="log-item-actions">
          <button class="edit-btn" aria-label="Edit ${escapeHtml(entry.name)}">✎</button>
          <button class="remove-btn" aria-label="Remove ${escapeHtml(entry.name)}">×</button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => {
        editingUid = entry.uid;
        renderLog();
      });
      row.querySelector(".remove-btn").addEventListener("click", () => {
        animateRemoval(row, () => removeEntry(entry.uid));
      });
      container.appendChild(row);
    });
    lastAddedLogUid = null;
  }

  function buildEditRow(entry) {
    const row = document.createElement("div");
    row.className = "log-item-edit";
    row.innerHTML = `
      <input type="text" class="custom-input log-edit-name" value="${escapeHtml(entry.name)}" placeholder="Food name">
      <div class="log-edit-row">
        <input type="number" class="custom-input log-edit-calories" value="${entry.calories}" min="0" step="1" placeholder="Calories">
        <input type="number" class="custom-input log-edit-protein" value="${round1(entry.protein)}" min="0" step="0.1" placeholder="Protein (g)">
      </div>
      <input type="text" class="custom-input log-edit-portion" value="${escapeHtml(entry.portionLabel)}" placeholder="Portion">
      <div class="log-edit-actions">
        <button class="log-edit-delete" type="button">Delete</button>
        <div class="log-edit-actions-right">
          <button class="log-edit-cancel" type="button">Cancel</button>
          <button class="log-edit-save" type="button">Save</button>
        </div>
      </div>
    `;

    const cancelEdit = () => {
      editingUid = null;
      renderLog();
    };

    const saveEdit = () => {
      const name = row.querySelector(".log-edit-name").value.trim();
      const calories = parseFloat(row.querySelector(".log-edit-calories").value);
      const protein = parseFloat(row.querySelector(".log-edit-protein").value);
      const portionLabel = row.querySelector(".log-edit-portion").value.trim();

      if (!name || isNaN(calories) || calories < 0 || isNaN(protein) || protein < 0) {
        return;
      }

      updateEntry(entry.uid, { name, calories: Math.round(calories), protein: round1(protein), portionLabel });
    };

    row.querySelector(".log-edit-delete").addEventListener("click", () => {
      animateRemoval(row, () => removeEntry(entry.uid));
    });
    row.querySelector(".log-edit-cancel").addEventListener("click", cancelEdit);
    row.querySelector(".log-edit-save").addEventListener("click", saveEdit);

    row.querySelectorAll(".log-edit-name, .log-edit-calories, .log-edit-protein, .log-edit-portion").forEach((field) => {
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveEdit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelEdit();
        }
      });
    });

    return row;
  }

  function renderWorkouts() {
    const container = document.getElementById("workout-log-list");
    container.innerHTML = "";

    if (workouts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.id = "workout-empty-state";
      empty.textContent = "No workouts logged yet today.";
      container.appendChild(empty);
      return;
    }

    workouts.forEach((entry) => {
      if (entry.uid === editingWorkoutUid) {
        container.appendChild(buildWorkoutEditRow(entry));
        return;
      }

      const row = document.createElement("div");
      row.className = "log-item";
      if (entry.uid === lastAddedWorkoutUid) row.classList.add("item-enter");
      row.innerHTML = `
        <div class="log-info">
          <p class="log-name">${escapeHtml(entry.name)}</p>
          <p class="log-meta"><span class="cal">−${entry.calories} kcal</span> · ${entry.time}</p>
        </div>
        <div class="log-item-actions">
          <button class="edit-btn" aria-label="Edit ${escapeHtml(entry.name)}">✎</button>
          <button class="remove-btn" aria-label="Remove ${escapeHtml(entry.name)}">×</button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => {
        editingWorkoutUid = entry.uid;
        renderWorkouts();
      });
      row.querySelector(".remove-btn").addEventListener("click", () => {
        animateRemoval(row, () => removeWorkout(entry.uid));
      });
      container.appendChild(row);
    });
    lastAddedWorkoutUid = null;
  }

  function buildWorkoutEditRow(entry) {
    const row = document.createElement("div");
    row.className = "log-item-edit";
    row.innerHTML = `
      <input type="text" class="custom-input workout-edit-name" value="${escapeHtml(entry.name)}" placeholder="Activity">
      <input type="number" class="custom-input workout-edit-calories" value="${entry.calories}" min="0" step="1" placeholder="Calories burned">
      <div class="log-edit-actions">
        <button class="log-edit-delete" type="button">Delete</button>
        <div class="log-edit-actions-right">
          <button class="log-edit-cancel" type="button">Cancel</button>
          <button class="log-edit-save" type="button">Save</button>
        </div>
      </div>
    `;

    const cancelEdit = () => {
      editingWorkoutUid = null;
      renderWorkouts();
    };

    const saveEdit = () => {
      const name = row.querySelector(".workout-edit-name").value.trim();
      const calories = parseFloat(row.querySelector(".workout-edit-calories").value);

      if (!name || isNaN(calories) || calories < 0) {
        return;
      }

      updateWorkout(entry.uid, { name, calories: Math.round(calories) });
    };

    row.querySelector(".log-edit-delete").addEventListener("click", () => {
      animateRemoval(row, () => removeWorkout(entry.uid));
    });
    row.querySelector(".log-edit-cancel").addEventListener("click", cancelEdit);
    row.querySelector(".log-edit-save").addEventListener("click", saveEdit);

    row.querySelectorAll(".workout-edit-name, .workout-edit-calories").forEach((field) => {
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveEdit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelEdit();
        }
      });
    });

    return row;
  }

  // ---- Streak ----
  function getDaySummary(dateKey) {
    const entries = loadEntries("log", dateKey);
    if (entries.length === 0) {
      return { tracked: false, success: false };
    }
    const dayWorkouts = loadEntries("workouts", dateKey);
    const consumed = entries.reduce((sum, e) => sum + e.calories, 0);
    const burned = dayWorkouts.reduce((sum, w) => sum + w.calories, 0);
    const budget = GOAL_CALORIES + burned;
    return { tracked: true, success: consumed <= budget };
  }

  function computeStreak() {
    let streak = 0;
    let cursor = shiftDateKey(todayKey(), -1);
    while (true) {
      const { tracked, success } = getDaySummary(cursor);
      if (!tracked || !success) break;
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  }

  function renderStreak() {
    const streak = computeStreak();
    const valueEl = document.getElementById("streak-value");
    valueEl.textContent = streak;
    valueEl.classList.toggle("zero", streak === 0);
  }

  function celebrateStreak() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const valueEl = document.getElementById("streak-value");
    const wrap = document.getElementById("streak-value-wrap");
    if (!valueEl || !wrap) return;

    valueEl.classList.remove("celebrate");
    void valueEl.offsetWidth;
    valueEl.classList.add("celebrate");

    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("span");
      particle.className = "streak-particle";
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
      const distance = 22 + Math.random() * 14;
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      particle.addEventListener("animationend", () => particle.remove());
      wrap.appendChild(particle);
    }
  }

  function checkStreakCelebration() {
    const yesterday = shiftDateKey(todayKey(), -1);
    const { tracked, success } = getDaySummary(yesterday);
    const celebratedFor = localStorage.getItem("calorie-tracker-streak-celebrated");

    if (tracked && success && celebratedFor !== yesterday) {
      localStorage.setItem("calorie-tracker-streak-celebrated", yesterday);
      celebrateStreak();
    }
  }

  function renderSummary() {
    const totalCalories = log.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = round1(log.reduce((sum, e) => sum + e.protein, 0));
    const totalBurned = workouts.reduce((sum, w) => sum + w.calories, 0);
    const calorieBudget = GOAL_CALORIES + totalBurned;

    animateNumberText(document.getElementById("stat-foods"), log.length);
    animateNumberText(document.getElementById("stat-calories"), totalCalories);
    animateNumberText(document.getElementById("stat-protein"), totalProtein, { decimals: 1, suffix: "g" });
    animateNumberText(document.getElementById("stat-burned"), totalBurned);

    animateNumberText(document.getElementById("cal-consumed"), totalCalories);
    animateNumberText(document.getElementById("cal-goal"), calorieBudget);
    animateNumberText(document.getElementById("protein-consumed"), totalProtein, { decimals: 1 });
    document.getElementById("protein-goal").textContent = GOAL_PROTEIN;

    const burnedNote = document.getElementById("cal-burned-note");
    if (totalBurned > 0) {
      burnedNote.textContent = `${GOAL_CALORIES} base + ${totalBurned} burned`;
      burnedNote.hidden = false;
    } else {
      burnedNote.hidden = true;
    }

    const calBar = document.getElementById("cal-bar");
    const calPct = Math.min(100, (totalCalories / calorieBudget) * 100);
    calBar.style.width = `${calPct}%`;
    calBar.classList.toggle("over", totalCalories > calorieBudget);

    const proteinBar = document.getElementById("protein-bar");
    const proteinPct = Math.min(100, (totalProtein / GOAL_PROTEIN) * 100);
    proteinBar.style.width = `${proteinPct}%`;
    proteinBar.classList.toggle("over", false);
  }

  function renderAll() {
    renderDate();
    renderCountdown();
    renderLog();
    renderWorkouts();
    renderSummary();
    renderStreak();
  }

  // ---- Mutations ----
  function addEntry(base) {
    const entry = {
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: base.name,
      portionLabel: base.portionLabel,
      calories: base.calories,
      protein: base.protein,
      time: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
    log.push(entry);
    saveLog(log);
    lastAddedLogUid = entry.uid;
    renderLog();
    renderSummary();
  }

  function removeEntry(uid) {
    const index = log.findIndex((e) => e.uid === uid);
    if (index === -1) return;
    const [removed] = log.splice(index, 1);
    if (editingUid === uid) editingUid = null;
    saveLog(log);
    renderLog();
    renderSummary();

    showUndoToast(`Removed ${removed.name}`, () => {
      log.splice(index, 0, removed);
      saveLog(log);
      lastAddedLogUid = removed.uid;
      renderLog();
      renderSummary();
    });
  }

  function updateEntry(uid, changes) {
    const entry = log.find((e) => e.uid === uid);
    if (!entry) return;
    Object.assign(entry, changes);
    saveLog(log);
    editingUid = null;
    renderLog();
    renderSummary();
  }

  function clearLog() {
    if (log.length === 0) return;
    const previous = log;
    const count = previous.length;
    log = [];
    editingUid = null;
    saveLog(log);
    renderLog();
    renderSummary();

    showUndoToast(`Cleared ${count} food${count === 1 ? "" : "s"}`, () => {
      log = previous;
      saveLog(log);
      renderLog();
      renderSummary();
    });
  }

  // ---- Workout mutations ----
  function addWorkout(base) {
    const entry = {
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: base.name,
      calories: base.calories,
      time: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
    workouts.push(entry);
    saveWorkouts(workouts);
    lastAddedWorkoutUid = entry.uid;
    renderWorkouts();
    renderSummary();
  }

  function removeWorkout(uid) {
    const index = workouts.findIndex((w) => w.uid === uid);
    if (index === -1) return;
    const [removed] = workouts.splice(index, 1);
    if (editingWorkoutUid === uid) editingWorkoutUid = null;
    saveWorkouts(workouts);
    renderWorkouts();
    renderSummary();

    showUndoToast(`Removed ${removed.name}`, () => {
      workouts.splice(index, 0, removed);
      saveWorkouts(workouts);
      lastAddedWorkoutUid = removed.uid;
      renderWorkouts();
      renderSummary();
    });
  }

  function updateWorkout(uid, changes) {
    const entry = workouts.find((w) => w.uid === uid);
    if (!entry) return;
    Object.assign(entry, changes);
    saveWorkouts(workouts);
    editingWorkoutUid = null;
    renderWorkouts();
    renderSummary();
  }

  // ---- Undo toast ----
  let toastTimeoutId = null;
  let toastHideTimeoutId = null;
  let pendingUndo = null;

  function showUndoToast(message, undoFn) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = message;
    pendingUndo = undoFn;
    clearTimeout(toastTimeoutId);
    clearTimeout(toastHideTimeoutId);

    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add("show");

    toastTimeoutId = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    const toast = document.getElementById("toast");
    toast.classList.remove("show");
    pendingUndo = null;
    clearTimeout(toastTimeoutId);
    clearTimeout(toastHideTimeoutId);
    toastHideTimeoutId = setTimeout(
      () => {
        toast.hidden = true;
      },
      prefersReducedMotion() ? 0 : 220
    );
  }

  // ---- Daily reset check ----
  function checkForDayRollover() {
    const key = todayKey();
    if (key !== currentDayKey) {
      currentDayKey = key;
      log = loadEntries("log"); // fresh key -> empty array
      workouts = loadEntries("workouts");
      editingUid = null;
      editingWorkoutUid = null;
      hideToast();
      renderAll();
      checkStreakCelebration();
    } else {
      renderCountdown();
    }
  }

  function handleWorkoutFormSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("workout-name");
    const caloriesInput = document.getElementById("workout-calories");

    const name = nameInput.value.trim();
    const calories = parseFloat(caloriesInput.value);

    if (!name || isNaN(calories) || calories < 0) {
      return;
    }

    addWorkout({ name, calories: Math.round(calories) });

    nameInput.value = "";
    caloriesInput.value = "";
    nameInput.focus();
  }

  function handleCustomFoodSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("custom-name");
    const caloriesInput = document.getElementById("custom-calories");
    const proteinInput = document.getElementById("custom-protein");
    const portionInput = document.getElementById("custom-portion");

    const name = nameInput.value.trim();
    const calories = parseFloat(caloriesInput.value);
    const protein = parseFloat(proteinInput.value);
    const portionLabel = portionInput.value.trim() || "1 serving";

    if (!name || isNaN(calories) || calories < 0 || isNaN(protein) || protein < 0) {
      return;
    }

    addEntry({
      name,
      portionLabel,
      calories: Math.round(calories),
      protein: round1(protein),
    });

    nameInput.value = "";
    caloriesInput.value = "";
    proteinInput.value = "";
    portionInput.value = "";
    nameInput.focus();
  }

  function handleAddFixedFoodSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("fixed-food-name");
    const caloriesInput = document.getElementById("fixed-food-calories");
    const proteinInput = document.getElementById("fixed-food-protein");
    const portionInput = document.getElementById("fixed-food-portion");

    const name = nameInput.value.trim();
    const calories = parseFloat(caloriesInput.value);
    const protein = parseFloat(proteinInput.value);
    const portionLabel = portionInput.value.trim();

    if (!name || isNaN(calories) || calories < 0 || isNaN(protein) || protein < 0 || !portionLabel) {
      return;
    }

    addCustomFixedFood({ name, calories: Math.round(calories), protein: round1(protein), portionLabel });

    nameInput.value = "";
    caloriesInput.value = "";
    proteinInput.value = "";
    portionInput.value = "";
    nameInput.focus();
  }

  function handleAddScalableFoodSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById("scalable-food-name");
    const caloriesInput = document.getElementById("scalable-food-calories");
    const proteinInput = document.getElementById("scalable-food-protein");
    const gramsInput = document.getElementById("scalable-food-default-grams");

    const name = nameInput.value.trim();
    const caloriesPer100 = parseFloat(caloriesInput.value);
    const proteinPer100 = parseFloat(proteinInput.value);
    const defaultGrams = parseFloat(gramsInput.value);

    if (!name || isNaN(caloriesPer100) || caloriesPer100 < 0 || isNaN(proteinPer100) || proteinPer100 < 0) {
      return;
    }

    addCustomScalableFood({
      name,
      caloriesPer100: round1(caloriesPer100),
      proteinPer100: round1(proteinPer100),
      defaultGrams: defaultGrams > 0 ? Math.round(defaultGrams) : 100,
    });

    nameInput.value = "";
    caloriesInput.value = "";
    proteinInput.value = "";
    gramsInput.value = "";
    nameInput.focus();
  }

  // ---- Init ----
  document.getElementById("clear-log-btn").addEventListener("click", clearLog);
  document.getElementById("custom-food-form").addEventListener("submit", handleCustomFoodSubmit);
  document.getElementById("workout-form").addEventListener("submit", handleWorkoutFormSubmit);
  document.getElementById("fixed-food-form").addEventListener("submit", handleAddFixedFoodSubmit);
  document.getElementById("scalable-food-form").addEventListener("submit", handleAddScalableFoodSubmit);
  document.getElementById("clear-grocery-btn").addEventListener("click", clearGroceryList);
  document.getElementById("toast-undo-btn").addEventListener("click", () => {
    if (pendingUndo) pendingUndo();
    hideToast();
  });
  renderFixedFoods();
  renderScalableFoods();
  renderGrocery();
  renderAll();
  checkStreakCelebration();

  document.querySelectorAll(".app > header, .app > section").forEach((el, i) => {
    el.style.setProperty("--i", i);
  });

  setInterval(checkForDayRollover, 1000);
})();
