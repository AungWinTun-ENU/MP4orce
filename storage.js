// ============================================================
//  script.js
//  • Login / Signup using localStorage
//  • Leaderboard populated from game battle stats
//  • Works across login.html, signup.html, leaderboard.html
// ============================================================
"use strict";

// ═══════════════════════════════════════════════════════════
//  STORAGE HELPERS
// ═══════════════════════════════════════════════════════════

const DB = {
  // All registered users  →  { username, email, passwordHash }[]
  getUsers() {
    try { return JSON.parse(localStorage.getItem("bf_users")) || []; }
    catch { return []; }
  },
  saveUsers(users) {
    localStorage.setItem("bf_users", JSON.stringify(users));
  },

  // Currently logged-in username
  getSession() { return localStorage.getItem("bf_session") || null; },
  setSession(username) { localStorage.setItem("bf_session", username); },
  clearSession() { localStorage.removeItem("bf_session"); },

  // Leaderboard entries  →  { username, dmgDealt, dmgTaken, crits, wins, timestamp }[]
  getLeaderboard() {
    try { return JSON.parse(localStorage.getItem("bf_leaderboard")) || []; }
    catch { return []; }
  },
  saveLeaderboard(entries) {
    localStorage.setItem("bf_leaderboard", JSON.stringify(entries));
  },
};

// Simple hash (not cryptographic — fine for localStorage demo)
function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

// ═══════════════════════════════════════════════════════════
//  TOAST / ERROR HELPERS
// ═══════════════════════════════════════════════════════════

function showError(msg) {
  let el = document.getElementById("auth-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "auth-error";
    el.style.cssText = `
      margin-top:12px;padding:10px 16px;border-radius:6px;
      background:rgba(232,64,64,0.15);border:1px solid rgba(232,64,64,0.5);
      color:#ff6060;font-family:'Rajdhani',sans-serif;
      font-size:0.85rem;letter-spacing:0.05em;text-align:center;
      animation:fadeUp .3s ease both;`;
    // Insert after the form
    const form = document.querySelector("form");
    if (form) form.after(el);
    else document.querySelector(".menu").appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
}

function clearError() {
  const el = document.getElementById("auth-error");
  if (el) el.style.display = "none";
}

function showSuccess(msg, redirectTo, delay = 1200) {
  let el = document.getElementById("auth-success");
  if (!el) {
    el = document.createElement("div");
    el.id = "auth-success";
    el.style.cssText = `
      margin-top:12px;padding:10px 16px;border-radius:6px;
      background:rgba(78,203,110,0.15);border:1px solid rgba(78,203,110,0.5);
      color:#4ecb6e;font-family:'Rajdhani',sans-serif;
      font-size:0.85rem;letter-spacing:0.05em;text-align:center;
      animation:fadeUp .3s ease both;`;
    const form = document.querySelector("form");
    if (form) form.after(el);
    else document.querySelector(".menu").appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  if (redirectTo) setTimeout(() => window.location.href = redirectTo, delay);
}

// ═══════════════════════════════════════════════════════════
//  SIGNUP  (signup.html — form id="login-form" in your HTML)
// ═══════════════════════════════════════════════════════════

function initSignup() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    clearError();

    const username = document.getElementById("username").value.trim();
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm  = document.getElementById("confirm-password").value;

    // Validation
    if (username.length < 3)          return showError("Username must be at least 3 characters.");
    if (!/\S+@\S+\.\S+/.test(email))  return showError("Please enter a valid email address.");
    if (password.length < 6)          return showError("Password must be at least 6 characters.");
    if (password !== confirm)          return showError("Passwords do not match.");

    const users = DB.getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return showError("That username is already taken.");
    }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return showError("That email is already registered.");
    }

    // Save new user
    users.push({ username, email, passwordHash: hashPassword(password) });
    DB.saveUsers(users);
    DB.setSession(username);

    showSuccess(`✓ Account created! Welcome, ${username}!`, "index.html");
  });
}

// ═══════════════════════════════════════════════════════════
//  LOGIN  (login.html — form id="signup-form" in your HTML)
// ═══════════════════════════════════════════════════════════

function initLogin() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    clearError();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) return showError("Please fill in all fields.");

    const users = DB.getUsers();
    const user  = users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
        && u.passwordHash === hashPassword(password)
    );

    if (!user) return showError("Incorrect username or password.");

    DB.setSession(user.username);
    showSuccess(`✓ Welcome back, ${user.username}!`, "index.html");
  });
}

// ═══════════════════════════════════════════════════════════
//  SESSION BADGE
//  Shows logged-in username on every page + logout button
// ═══════════════════════════════════════════════════════════

function injectSessionBadge() {
  const session = DB.getSession();
  if (!session) return;

  const badge = document.createElement("div");
  badge.id = "session-badge";
  badge.style.cssText = `
    position:fixed;top:12px;left:14px;z-index:700;
    display:flex;align-items:center;gap:8px;
    background:rgba(6,11,20,0.85);backdrop-filter:blur(8px);
    border:1px solid var(--border);border-radius:8px;
    padding:5px 12px;font-family:'Orbitron',sans-serif;
    font-size:0.62rem;letter-spacing:0.1em;color:var(--gold);`;

  badge.innerHTML = `
    <span>👤 ${session}</span>
    <button id="logout-btn" style="
      background:none;border:none;cursor:pointer;
      color:var(--text-muted);font-size:0.6rem;
      font-family:'Orbitron',sans-serif;letter-spacing:0.1em;
      padding:0;transition:color .2s;" title="Log out">✕</button>`;

  document.body.appendChild(badge);

  document.getElementById("logout-btn").addEventListener("click", () => {
    DB.clearSession();
    window.location.reload();
  });

  // Hover style for logout button
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.onmouseenter = () => logoutBtn.style.color = "#e84040";
  logoutBtn.onmouseleave = () => logoutBtn.style.color = "var(--text-muted)";
}

// ═══════════════════════════════════════════════════════════
//  LEADERBOARD
// ═══════════════════════════════════════════════════════════

function initLeaderboard() {
  const wrapper = document.querySelector(".leaderboard-wrapper");
  if (!wrapper) return;

  let entries = DB.getLeaderboard();

  // Sort by damage dealt descending
  entries.sort((a, b) => b.dmgDealt - a.dmgDealt);

  if (entries.length === 0) {
    renderEmptyLeaderboard();
    return;
  }

  populateLeaderboard(entries);
}

function populateLeaderboard(entries) {
  // ── 1st place card ──
  const first = entries[0];
  if (first) {
    const nameEl  = document.querySelector(".first-place-card .player-name");
    const statEls = document.querySelectorAll(".first-place-card .stat-val");
    const ph      = document.querySelector(".first-place-card .portrait-placeholder");

    if (nameEl)       nameEl.textContent   = first.username;
    if (ph)           ph.textContent       = first.username[0].toUpperCase();
    if (statEls[0])   statEls[0].textContent = first.dmgDealt.toLocaleString();
    if (statEls[1])   statEls[1].textContent = first.dmgTaken.toLocaleString();
    if (statEls[2])   statEls[2].textContent = first.crits.toLocaleString();
  }

  // ── Rank rows (2nd–5th) ──
  const rows = document.querySelectorAll(".rank-row");
  rows.forEach((row, i) => {
    const entry = entries[i + 1];
    const nameEl = row.querySelector(".player-name");
    const ph     = row.querySelector(".small-portrait-placeholder");

    if (entry) {
      if (nameEl) nameEl.textContent = entry.username;
      if (ph)     ph.textContent     = entry.username[0].toUpperCase();

      // Add damage dealt as a small tag
      const dmgTag = document.createElement("span");
      dmgTag.style.cssText = `
        font-family:'Orbitron',sans-serif;font-size:0.58rem;
        color:var(--text-muted);letter-spacing:0.05em;margin-left:auto;`;
      dmgTag.textContent = `${entry.dmgDealt.toLocaleString()} DMG`;
      if (!row.querySelector(".dmg-tag")) {
        dmgTag.classList.add("dmg-tag");
        row.appendChild(dmgTag);
      }
    } else {
      // No player for this slot
      if (nameEl) nameEl.textContent = "—";
      if (ph)     ph.textContent     = "?";
    }
  });
}

function renderEmptyLeaderboard() {
  // No battles recorded yet — show a helpful message
  const layout = document.querySelector(".lb-layout");
  if (!layout) return;
  layout.innerHTML = `
    <div style="
      width:100%;text-align:center;padding:60px 20px;
      font-family:'Orbitron',sans-serif;color:var(--text-muted);
      letter-spacing:0.15em;">
      <div style="font-size:2rem;margin-bottom:16px;">⚔</div>
      <div style="font-size:0.9rem;margin-bottom:8px;">No battles recorded yet</div>
      <div style="font-size:0.65rem;">Complete a battle to appear on the leaderboard!</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  RECORD BATTLE RESULT  (called from game.js on victory)
//  game.js should call:  window.recordBattleResult(stats)
//  where stats = { dmgDealt, dmgTaken, crits }
// ═══════════════════════════════════════════════════════════

window.recordBattleResult = function(stats) {
  const username = DB.getSession();
  if (!username) return;   // not logged in — don't record

  const entries = DB.getLeaderboard();

  // Find existing entry for this user
  const existing = entries.find(e => e.username === username);

  if (existing) {
    // Accumulate stats across multiple battles
    existing.dmgDealt += stats.dmgDealt || 0;
    existing.dmgTaken += stats.dmgTaken || 0;
    existing.crits    += stats.crits    || 0;
    existing.wins     = (existing.wins || 0) + 1;
    existing.timestamp = Date.now();
  } else {
    entries.push({
      username,
      dmgDealt:  stats.dmgDealt  || 0,
      dmgTaken:  stats.dmgTaken  || 0,
      crits:     stats.crits     || 0,
      wins:      1,
      timestamp: Date.now(),
    });
  }

  DB.saveLeaderboard(entries);
};

// ═══════════════════════════════════════════════════════════
//  GUARD — redirect to login if not logged in
//  Add data-require-auth to <body> on protected pages
// ═══════════════════════════════════════════════════════════

function checkAuth() {
  const body = document.body;
  if (body.dataset.requireAuth !== undefined && !DB.getSession()) {
    window.location.href = "login.html";
  }
}

// ═══════════════════════════════════════════════════════════
//  BOOT — auto-detect which page we're on
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  injectSessionBadge();

  // Signup page
  if (document.getElementById("login-form"))  initSignup();

  // Login page
  if (document.getElementById("signup-form")) initLogin();

  // Leaderboard page
  if (document.querySelector(".leaderboard-wrapper")) initLeaderboard();
});