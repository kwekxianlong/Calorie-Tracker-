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
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function storageKey(kind) {
    return `calorie-tracker-${kind}-${todayKey()}`;
  }

  function loadEntries(kind) {
    try {
      const raw = localStorage.getItem(storageKey(kind));
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

  let currentDayKey = todayKey();
  let log = loadEntries("log");
  let workouts = loadEntries("workouts");
  let editingUid = null;
  let editingWorkoutUid = null;

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
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
    FIXED_FOODS.forEach((food) => {
      const row = document.createElement("div");
      row.className = "food-item";
      row.innerHTML = `
        <div class="food-info">
          <p class="food-name">${food.name}</p>
          <p class="food-meta"><span class="cal">${food.calories} kcal</span> · ${round1(food.protein)}g protein · ${food.portionLabel}</p>
        </div>
        <div class="food-controls">
          <button class="add-btn" aria-label="Add ${food.name}">+</button>
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
      container.appendChild(row);
    });
  }

  function renderScalableFoods() {
    const container = document.getElementById("scalable-food-list");
    container.innerHTML = "";
    SCALABLE_FOODS.forEach((food) => {
      const row = document.createElement("div");
      row.className = "food-item";
      row.innerHTML = `
        <div class="food-info">
          <p class="food-name">${food.name}</p>
          <p class="food-meta">${food.caloriesPer100} kcal · ${food.proteinPer100}g protein / 100g</p>
        </div>
        <div class="food-controls">
          <input type="number" class="gram-input" min="1" step="1" value="${food.defaultGrams}" aria-label="Grams of ${food.name}">
          <button class="add-btn" aria-label="Add ${food.name}">+</button>
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
      container.appendChild(row);
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
        removeEntry(entry.uid);
      });
      container.appendChild(row);
    });
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
      removeEntry(entry.uid);
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
        removeWorkout(entry.uid);
      });
      container.appendChild(row);
    });
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
      removeWorkout(entry.uid);
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

  function renderSummary() {
    const totalCalories = log.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = round1(log.reduce((sum, e) => sum + e.protein, 0));
    const totalBurned = workouts.reduce((sum, w) => sum + w.calories, 0);
    const calorieBudget = GOAL_CALORIES + totalBurned;

    document.getElementById("stat-foods").textContent = log.length;
    document.getElementById("stat-calories").textContent = totalCalories;
    document.getElementById("stat-protein").textContent = `${totalProtein}g`;
    document.getElementById("stat-burned").textContent = totalBurned;

    document.getElementById("cal-consumed").textContent = totalCalories;
    document.getElementById("cal-goal").textContent = calorieBudget;
    document.getElementById("protein-consumed").textContent = totalProtein;
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
  let pendingUndo = null;

  function showUndoToast(message, undoFn) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = message;
    toast.hidden = false;
    pendingUndo = undoFn;
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    document.getElementById("toast").hidden = true;
    pendingUndo = null;
    clearTimeout(toastTimeoutId);
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

  // ---- Init ----
  document.getElementById("clear-log-btn").addEventListener("click", clearLog);
  document.getElementById("custom-food-form").addEventListener("submit", handleCustomFoodSubmit);
  document.getElementById("workout-form").addEventListener("submit", handleWorkoutFormSubmit);
  document.getElementById("toast-undo-btn").addEventListener("click", () => {
    if (pendingUndo) pendingUndo();
    hideToast();
  });
  renderFixedFoods();
  renderScalableFoods();
  renderAll();

  setInterval(checkForDayRollover, 1000);
})();
