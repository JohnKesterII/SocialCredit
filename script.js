// Simple localStorage-backed leaderboard with email/password login

const STORAGE_KEY = "voteAppState";
const CURRENT_USER_KEY = "voteAppCurrentUser";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { users: {}, leaderboard: {}, pendingUsers: {} };
    }
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    if (!parsed.leaderboard) parsed.leaderboard = {};
    if (!parsed.pendingUsers) parsed.pendingUsers = {};
    return parsed;
  } catch {
    return { users: {}, leaderboard: {}, pendingUsers: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentUserEmail() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUserEmail(email) {
  if (email) {
    localStorage.setItem(CURRENT_USER_KEY, email);
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

let state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  const authSection = document.getElementById("authSection");
  const authForms = document.getElementById("authForms");
  const appSection = document.getElementById("appSection");
  const userInfoEl = document.getElementById("userInfo");
  const userStatsHintEl = document.getElementById("userStatsHint");
  const logoutBtn = document.getElementById("logoutBtn");
  const voteInput = document.getElementById("voteInput");
  const applyVoteBtn = document.getElementById("applyVoteBtn");
  const leaderboardEl = document.getElementById("leaderboard");
  const voteErrorEl = document.getElementById("voteError");

  // Make sure pendingUsers exists in state
  if (!state.pendingUsers) {
    state.pendingUsers = {};
  }

  // "login" | "register" | "verify"
  let authMode = "login";

  function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // "123456"
  }

  function renderAuthForm() {
    if (authMode === "verify") {
      authForms.innerHTML = `
        <h2 style="margin-top:0;">Verify your email</h2>
        <p style="font-size:0.9rem; color:#cbd5e1; margin-bottom:16px;">
          We sent a 6-digit code to your email. Enter it below to finish creating your account.
        </p>
        <div class="field">
          <label for="verifyCodeInput">Verification code</label>
          <input id="verifyCodeInput" type="text" autocomplete="one-time-code" />
        </div>
        <button id="verifyCodeBtn">Verify</button>
        <div class="auth-toggle">
          <a id="backToLoginLink">Back to login</a>
        </div>
        <div class="error" id="authError"></div>
      `;

      const verifyCodeBtn = document.getElementById("verifyCodeBtn");
      const backToLoginLink = document.getElementById("backToLoginLink");
      const authErrorEl = document.getElementById("authError");

      verifyCodeBtn.addEventListener("click", () => {
        authErrorEl.textContent = "";
        handleVerifySubmit(authErrorEl);
      });

      document
        .getElementById("verifyCodeInput")
        .addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            authErrorEl.textContent = "";
            handleVerifySubmit(authErrorEl);
          }
        });

      backToLoginLink.addEventListener("click", () => {
        authMode = "login";
        renderAuthForm();
      });

      return;
    }

    const isLogin = authMode === "login";
    authForms.innerHTML = `
      <h2 style="margin-top:0;">${isLogin ? "Log in" : "Create account"}</h2>
      <div class="field">
        <label for="emailInput">Email</label>
        <input id="emailInput" type="email" autocomplete="email" />
      </div>
      <div class="field">
        <label for="usernameInput">Username</label>
        <input id="usernameInput" type="text" autocomplete="username" />
      </div>
      <div class="field">
        <label for="passwordInput">Password</label>
        <input id="passwordInput" type="password" autocomplete="current-password" />
      </div>
      <button id="authSubmitBtn">${isLogin ? "Log in" : "Sign up"}</button>
      <div class="auth-toggle">
        ${isLogin ? "Need an account? " : "Already have an account? "}
        <a id="authToggleLink">${isLogin ? "Sign up" : "Log in"}</a>
      </div>
      <div class="error" id="authError"></div>
    `;

    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const authToggleLink = document.getElementById("authToggleLink");
    const authErrorEl = document.getElementById("authError");

    authSubmitBtn.addEventListener("click", () => {
      authErrorEl.textContent = "";
      handleAuthSubmit(authErrorEl);
    });

    authToggleLink.addEventListener("click", () => {
      authMode = isLogin ? "register" : "login";
      renderAuthForm();
    });

    document
      .getElementById("passwordInput")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          authErrorEl.textContent = "";
          handleAuthSubmit(authErrorEl);
        }
      });
  }

  function handleAuthSubmit(errorEl) {
    const emailInputEl = document.getElementById("emailInput");
    const usernameInputEl = document.getElementById("usernameInput");
    const passwordInputEl = document.getElementById("passwordInput");

    if (!emailInputEl || !usernameInputEl || !passwordInputEl) {
      errorEl.textContent = "Something went wrong. Please refresh.";
      return;
    }

    const email = emailInputEl.value.trim().toLowerCase();
    const username = usernameInputEl.value.trim();
    const password = passwordInputEl.value;

    if (!email || !username || !password) {
      errorEl.textContent = "Please fill out email, username, and password.";
      return;
    }

    if (authMode === "register") {
      // registration with email verification
      if (state.users[email]) {
        errorEl.textContent = "An account with that email already exists.";
        return;
      }

      const usernameLower = username.toLowerCase();
      const usernameTaken = Object.values(state.users).some(
        (u) => u.username.toLowerCase() === usernameLower
      );
      if (usernameTaken) {
        errorEl.textContent = "That username is already taken.";
        return;
      }

      const code = generateCode();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      state.pendingUsers[email] = {
        email,
        username,
        password,
        code,
        expiresAt
      };
      saveState();

      fetch("/api/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to send verification email");
          }
          authMode = "verify";
          renderAuthForm();
        })
        .catch((err) => {
          console.error(err);
          errorEl.textContent =
            "Could not send verification email. Please try again.";
        });

      return;
    }

    // Log in
    const user = state.users[email];
    if (!user || user.password !== password) {
      errorEl.textContent = "Invalid email or password.";
      return;
    }

    if (username.toLowerCase() !== user.username.toLowerCase()) {
      errorEl.textContent = "Username does not match this email.";
      return;
    }

    const usernameLower = user.username.toLowerCase();
    if (!state.leaderboard[usernameLower]) {
      state.leaderboard[usernameLower] = {
        name: user.username,
        score: 0
      };
    }

    setCurrentUserEmail(email);
    showApp();
  }

  function handleVerifySubmit(errorEl) {
    const inputEl = document.getElementById("verifyCodeInput");
    if (!inputEl) {
      errorEl.textContent = "Something went wrong. Please refresh.";
      return;
    }

    const codeEntered = (inputEl.value || "").trim();
    if (!codeEntered) {
      errorEl.textContent = "Please enter the verification code.";
      return;
    }

    const pendingEmails = Object.keys(state.pendingUsers || {});
    if (pendingEmails.length === 0) {
      errorEl.textContent = "No pending verification found. Please sign up again.";
      return;
    }

    // take the most recent pending registration
    const email = pendingEmails[pendingEmails.length - 1];
    const pending = state.pendingUsers[email];
    if (!pending) {
      errorEl.textContent = "Verification session expired. Please sign up again.";
      return;
    }

    if (Date.now() > pending.expiresAt) {
      delete state.pendingUsers[email];
      saveState();
      errorEl.textContent = "Code expired. Please sign up again.";
      return;
    }

    if (codeEntered !== pending.code) {
      errorEl.textContent = "Incorrect code. Try again.";
      return;
    }

    const now = Date.now();
    const newUser = {
      email: pending.email,
      username: pending.username,
      password: pending.password,
      createdAt: now,
      lastVoteUpdate: now,
      voteBalance: 10
    };

    const usernameLower = pending.username.toLowerCase();
    if (!state.leaderboard[usernameLower]) {
      state.leaderboard[usernameLower] = {
        name: pending.username,
        score: 0
      };
    } else {
      state.leaderboard[usernameLower].name = pending.username;
    }

    state.users[pending.email] = newUser;
    delete state.pendingUsers[pending.email];
    saveState();

    setCurrentUserEmail(pending.email);
    showApp();
  }

  function getVotesPerHour(score) {
    if (score <= -501) return 0;
    if (score <= -251) return 1;
    if (score <= -101) return 3;
    if (score <= -51) return 5;
    if (score <= -26) return 6;
    if (score <= -11) return 7;
    if (score <= -6) return 8;
    if (score <= -1) return 9;
    if (score <= 5) return 10;
    if (score <= 10) return 11;
    if (score <= 25) return 12;
    if (score <= 50) return 13;
    if (score <= 100) return 14;
    if (score <= 250) return 15;
    if (score <= 500) return 17;
    if (score <= 1000) return 20;
    return 50;
  }

  function getVotePower(score) {
    // Everyone starts at 2 power.
    // After reaching -100 or below, power = 1.
    return score <= -100 ? 1 : 2;
  }

  function parseVote(input) {
    if (!input) return null;
    const parts = input.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const deltaStr = parts[parts.length - 1];
    const targetName = parts.slice(0, -1).join(" ");
    const delta = parseInt(deltaStr, 10);
    if (![-2, -1, 1, 2].includes(delta) || !targetName) {
      return null;
    }
    return { targetName, delta };
  }

  function getUserScore(user) {
    const key = user.username.toLowerCase();
    const entry = state.leaderboard[key];
    return entry ? entry.score : 0;
  }

  function refreshVoteBalance(user) {
    const score = getUserScore(user);
    const now = Date.now();
    if (!user.lastVoteUpdate) {
      user.lastVoteUpdate = now;
      if (typeof user.voteBalance !== "number") {
        user.voteBalance = 10;
      }
      return;
    }

    const hours = (now - user.lastVoteUpdate) / (1000 * 60 * 60);
    if (hours <= 0) return;

    const vph = getVotesPerHour(score);
    const gained = Math.floor(hours * vph);
    if (gained > 0) {
      if (typeof user.voteBalance !== "number") {
        user.voteBalance = 0;
      }
      user.voteBalance += gained;
      user.lastVoteUpdate = now;
    }
  }

  function getBarColor(score) {
    const maxAbs = 500;
    const clamped = Math.max(-maxAbs, Math.min(maxAbs, score));

    if (clamped === 0) {
      return "hsl(220, 10%, 20%)"; // neutral
    }
    const intensity = Math.abs(clamped) / maxAbs; // 0..1
    const lightness = 90 - intensity * 40; // 90% to 50%
    const hue = clamped > 0 ? 120 : 0; // green / red
    return `hsl(${hue}, 70%, ${lightness}%)`;
  }

  function getBarWidth(score) {
    const maxAbs = 500;
    const abs = Math.min(Math.abs(score), maxAbs);
    const minPercent = 10;
    const extra = (abs / maxAbs) * (100 - minPercent);
    return `${minPercent + extra}%`;
  }

  function renderLeaderboard() {
    leaderboardEl.innerHTML = "";
    if (Object.keys(state.leaderboard).length === 0) {
      leaderboardEl.innerHTML = `<div class="empty-message">
        No names have any votes yet.
      </div>`;
      return;
    }

    const entries = Object.values(state.leaderboard).slice();
    entries.sort((a, b) => b.score - a.score);

    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "entry";

      const header = document.createElement("div");
      header.className = "entry-header";

      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = entry.name;

      const scoreSpan = document.createElement("span");
      scoreSpan.className = "score";
      scoreSpan.textContent =
        entry.score > 0 ? `+${entry.score}` : entry.score.toString();

      header.appendChild(nameSpan);
      header.appendChild(scoreSpan);

      const barWrapper = document.createElement("div");
      barWrapper.className = "bar-wrapper";

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = getBarWidth(entry.score);
      bar.style.backgroundColor = getBarColor(entry.score);

      barWrapper.appendChild(bar);
      row.appendChild(header);
      row.appendChild(barWrapper);

      leaderboardEl.appendChild(row);
    });
  }

  function renderUserInfo(user) {
    const score = getUserScore(user);
    refreshVoteBalance(user);
    const vph = getVotesPerHour(score);
    const power = getVotePower(score);

    userInfoEl.innerHTML = `
      <div><strong>User:</strong> ${user.username}</div>
      <div><strong>Email:</strong> ${user.email}</div>
    `;
    userStatsHintEl.innerHTML = `
      Score: <strong>${score >= 0 ? "+" + score : score}</strong>  
      | Vote power: <strong>${power}</strong>  
      | Votes/hour: <strong>${vph}</strong>  
      | Available votes: <strong>${user.voteBalance ?? 0}</strong>
    `;
  }

  function getCurrentUser() {
    const email = getCurrentUserEmail();
    if (!email) return null;
    return state.users[email] || null;
  }

  function showApp() {
    const user = getCurrentUser();
    if (!user) {
      setCurrentUserEmail(null);
      authSection.style.display = "block";
      appSection.style.display = "none";
      authMode = "login";
      renderAuthForm();
      return;
    }

    const usernameLower = user.username.toLowerCase();
    if (!state.leaderboard[usernameLower]) {
      state.leaderboard[usernameLower] = {
        name: user.username,
        score: 0
      };
      saveState();
    }

    authSection.style.display = "none";
    appSection.style.display = "block";

    refreshVoteBalance(user);
    state.users[user.email] = user;
    saveState();

    renderUserInfo(user);
    renderLeaderboard();
  }

  function applyVote() {
    const user = getCurrentUser();
    if (!user) return;

    voteErrorEl.textContent = "";
    const text = voteInput.value;
    const parsed = parseVote(text);
    if (!parsed) {
      voteErrorEl.textContent =
        'Use format like: "name +2" or "someone -1". Only -2, -1, +1, +2 allowed.';
      return;
    }

    refreshVoteBalance(user);

    const userScore = getUserScore(user);
    const power = getVotePower(userScore);
    const costVotes = Math.abs(parsed.delta);
    const available = user.voteBalance ?? 0;

    if (available < costVotes) {
      voteErrorEl.textContent = `Not enough votes. You have ${available}, need ${costVotes}.`;
      return;
    }

    const targetKey = parsed.targetName.toLowerCase();
    if (!state.leaderboard[targetKey]) {
      state.leaderboard[targetKey] = {
        name: parsed.targetName,
        score: 0
      };
    }

    const targetEntry = state.leaderboard[targetKey];
    const deltaPoints = parsed.delta * power;
    targetEntry.score += deltaPoints;

    user.voteBalance = available - costVotes;
    user.lastVoteUpdate = Date.now();
    state.users[user.email] = user;

    saveState();

    voteInput.value = "";
    renderUserInfo(user);
    renderLeaderboard();
  }

  logoutBtn.addEventListener("click", () => {
    setCurrentUserEmail(null);
    showApp();
  });

  applyVoteBtn.addEventListener("click", applyVote);
  voteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      applyVote();
    }
  });

  if (getCurrentUser()) {
    showApp();
  } else {
    authSection.style.display = "block";
    appSection.style.display = "none";
    renderAuthForm();
  }
});
