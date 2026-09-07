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

  function storageKey() {
    return `calorie-tracker-log-${todayKey()}`;
  }

  function loadLog() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLog(entries) {
    localStorage.setItem(storageKey(), JSON.stringify(entries));
  }

  let currentDayKey = todayKey();
  let log = loadLog();

  function round1(n) {
    return Math.round(n * 10) / 10;
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
      row.querySelector(".add-btn").addEventListener("click", () => {
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
      const row = document.createElement("div");
      row.className = "log-item";
      row.innerHTML = `
        <div class="log-info">
          <p class="log-name">${entry.name}</p>
          <p class="log-meta"><span class="cal">${entry.calories} kcal</span> · ${round1(entry.protein)}g protein · ${entry.portionLabel} · ${entry.time}</p>
        </div>
        <button class="remove-btn" aria-label="Remove ${entry.name}">×</button>
      `;
      row.querySelector(".remove-btn").addEventListener("click", () => {
        removeEntry(entry.uid);
      });
      container.appendChild(row);
    });
  }

  function renderSummary() {
    const totalCalories = log.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = round1(log.reduce((sum, e) => sum + e.protein, 0));

    document.getElementById("stat-foods").textContent = log.length;
    document.getElementById("stat-calories").textContent = totalCalories;
    document.getElementById("stat-protein").textContent = `${totalProtein}g`;

    document.getElementById("cal-consumed").textContent = totalCalories;
    document.getElementById("cal-goal").textContent = GOAL_CALORIES;
    document.getElementById("protein-consumed").textContent = totalProtein;
    document.getElementById("protein-goal").textContent = GOAL_PROTEIN;

    const calBar = document.getElementById("cal-bar");
    const calPct = Math.min(100, (totalCalories / GOAL_CALORIES) * 100);
    calBar.style.width = `${calPct}%`;
    calBar.classList.toggle("over", totalCalories > GOAL_CALORIES);

    const proteinBar = document.getElementById("protein-bar");
    const proteinPct = Math.min(100, (totalProtein / GOAL_PROTEIN) * 100);
    proteinBar.style.width = `${proteinPct}%`;
    proteinBar.classList.toggle("over", false);
  }

  function renderAll() {
    renderDate();
    renderCountdown();
    renderLog();
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
    log = log.filter((e) => e.uid !== uid);
    saveLog(log);
    renderLog();
    renderSummary();
  }

  function clearLog() {
    if (log.length === 0) return;
    if (!confirm("Clear all food logged today?")) return;
    log = [];
    saveLog(log);
    renderLog();
    renderSummary();
  }

  // ---- Daily reset check ----
  function checkForDayRollover() {
    const key = todayKey();
    if (key !== currentDayKey) {
      currentDayKey = key;
      log = loadLog(); // fresh key -> empty array
      renderAll();
    } else {
      renderCountdown();
    }
  }

  // ---- Init ----
  document.getElementById("clear-log-btn").addEventListener("click", clearLog);
  renderFixedFoods();
  renderScalableFoods();
  renderAll();

  setInterval(checkForDayRollover, 1000);
})();
