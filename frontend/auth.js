(() => {
  const page = document.body.dataset.page;

  // Shared helper for talking to the Node/Express backend.
  window.api = async (method, url, body) => {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
      });
    } catch {
      throw new Error("Cannot reach the server. Is it running?");
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* no body */
    }
    if (response.status === 401 && page !== "login") {
      window.location.replace("login.html");
      throw new Error("Please sign in.");
    }
    if (!response.ok) throw new Error((data && data.error) || `Request failed (${response.status}).`);
    return data;
  };

  const home = (user) => (user.role === "Staff" ? "sales.html" : "dashboard.html");
  const $ = (id) => document.getElementById(id);

  async function currentUser() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!response.ok) return null;
      return (await response.json()).user;
    } catch {
      return null;
    }
  }

  async function initializeLoginPage() {
    const user = await currentUser();
    if (user) {
      window.location.replace(home(user));
      return;
    }

    const loginSection = $("login-section");
    const setupSection = $("setup-section");
    try {
      const status = await window.api("GET", "/api/auth/status");
      if (status.needsSetup) {
        loginSection.classList.add("hidden");
        setupSection.classList.remove("hidden");
      }
    } catch (error) {
      $("login-error").textContent = error.message;
    }

    $("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      $("login-error").textContent = "";
      button.disabled = true;
      try {
        const { user } = await window.api("POST", "/api/auth/login", {
          username: form.elements.username.value,
          password: form.elements.password.value,
        });
        window.location.replace(home(user));
      } catch (error) {
        $("login-error").textContent = error.message;
        button.disabled = false;
      }
    });

    $("setup-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      $("setup-error").textContent = "";
      button.disabled = true;
      try {
        const { user } = await window.api("POST", "/api/auth/setup", Object.fromEntries(new FormData(form)));
        window.location.replace(home(user));
      } catch (error) {
        $("setup-error").textContent = error.message;
        button.disabled = false;
      }
    });
  }

  function renderSignedInUser(account) {
    const chip = document.querySelector(".user-chip");
    if (!chip) return;
    chip.querySelector(".avatar").textContent = `${account.first_name[0]}${account.last_name[0]}`.toUpperCase();
    chip.querySelector("strong").textContent = `${account.first_name} ${account.last_name}`;
    chip.querySelector("small").textContent = account.role;

    if (!chip.querySelector(".logout-btn")) {
      const logoutButton = document.createElement("button");
      logoutButton.className = "logout-btn";
      logoutButton.type = "button";
      logoutButton.textContent = "Log out";
      logoutButton.addEventListener("click", async () => {
        try {
          await window.api("POST", "/api/auth/logout");
        } catch {
          /* leave anyway */
        }
        window.location.replace("login.html");
      });
      chip.append(logoutButton);
    }
  }

  async function initializeAppPage() {
    const account = await currentUser();
    if (!account) {
      window.location.replace("login.html");
      return;
    }
    if (account.role === "Staff" && page !== "sales") {
      window.location.replace("sales.html");
      return;
    }
    window.authContext = { user: account };
    if (account.role === "Staff") {
      document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
        if (!link.href.endsWith("sales.html")) link.remove();
      });
    }
    renderSignedInUser(account);

    const appScript = document.createElement("script");
    appScript.src = "script.js";
    appScript.onerror = () => {
      const error = document.createElement("p");
      error.className = "form-error";
      error.setAttribute("role", "alert");
      error.textContent = "Could not load the application.";
      document.querySelector("main").prepend(error);
    };
    document.body.append(appScript);
  }

  if (page === "login") initializeLoginPage();
  else initializeAppPage();
})();
