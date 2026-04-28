// ============================================================
//  settings.js — Fully functional settings page
//  Reads & writes to localStorage under the key "bf_settings"
//  Settings are picked up by game.js when the battle loads.
// ============================================================
"use strict";

// ── Default values (must match the HTML defaults) ────────────
const DEFAULTS = {
  musicVol:    70,
  sfxVol:      85,
  muteAll:     false,
  difficulty:  "Normal",
  showDmg:     true,
  screenShake: true,
  lang:        "en",
};

// ── Load settings from localStorage, fall back to defaults ───
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("bf_settings"));
    return saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

// ── Save settings to localStorage ────────────────────────────
function saveToStorage(settings) {
  localStorage.setItem("bf_settings", JSON.stringify(settings));
}

// ── Apply loaded values to the page controls ─────────────────
function applyToPage(s) {
  // Sliders
  setSlider("music-vol", "music-val", s.musicVol);
  setSlider("sfx-vol",   "sfx-val",   s.sfxVol);

  // Toggles
  setToggle("mute-all",     s.muteAll);
  setToggle("show-dmg",     s.showDmg);
  setToggle("screen-shake", s.screenShake);

  // Difficulty buttons
  const diffGroup = document.getElementById("diff-group");
  if (diffGroup) {
    diffGroup.querySelectorAll(".sel-btn").forEach(btn => {
      btn.classList.toggle("active", btn.textContent.trim() === s.difficulty);
    });
  }

  // Language
  const langEl = document.getElementById("lang-select");
  if (langEl) langEl.value = s.lang;
}

// ── Helpers ───────────────────────────────────────────────────
function setSlider(inputId, labelId, value) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  if (input) input.value = value;
  if (label) label.textContent = value + "%";
}

function setToggle(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = checked;
}

function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function getSliderValue(id) {
  const el = document.getElementById(id);
  return el ? parseInt(el.value, 10) : 0;
}

// ── Gather current UI state into a settings object ────────────
function gatherSettings() {
  // Active difficulty button
  let difficulty = "Normal";
  const diffGroup = document.getElementById("diff-group");
  if (diffGroup) {
    const active = diffGroup.querySelector(".sel-btn.active");
    if (active) difficulty = active.textContent.trim();
  }

  const langEl = document.getElementById("lang-select");

  return {
    musicVol:    getSliderValue("music-vol"),
    sfxVol:      getSliderValue("sfx-vol"),
    muteAll:     getToggle("mute-all"),
    difficulty,
    showDmg:     getToggle("show-dmg"),
    screenShake: getToggle("screen-shake"),
    lang:        langEl ? langEl.value : "en",
  };
}

// ── Global functions called by inline HTML handlers ───────────

// Called by oninput on each range slider
window.updateSlider = function(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  if (input && label) label.textContent = input.value + "%";
};

// Called by onclick on each difficulty button
window.selectOption = function(groupId, btn) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".sel-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
};

// Called by onchange on the mute toggle
window.handleMute = function() {
  const muted = getToggle("mute-all");
  // Grey out / restore the volume sliders visually
  ["music-vol", "sfx-vol"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = muted;
    if (el) el.style.opacity = muted ? "0.4" : "1";
  });
};

// Called by onclick on Save button
window.saveSettings = function() {
  const s = gatherSettings();
  saveToStorage(s);
  showToast();
};

// Called by onclick on Reset button
window.resetDefaults = function() {
  applyToPage({ ...DEFAULTS });
  saveToStorage({ ...DEFAULTS });
  showToast("✓ Reset to Defaults");
};

// ── Toast helper ─────────────────────────────────────────────
function showToast(msg = "✓ Settings Saved") {
  const toast = document.getElementById("save-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const s = loadSettings();
  applyToPage(s);
  // Apply mute disable state on load
  if (s.muteAll) window.handleMute();
});