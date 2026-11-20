(() => {
  const sessionKey = "smallbiz-auth-session";
  const usersKey = "smallbiz-system-users";
  const credentialsKey = "smallbiz-user-credentials";
  const staffInitialPassword = "12345";
  const passwordIterations = 120000;
  const defaultUsers = [
    {
      user_id: 1,
      first_name: "Ivan",
      last_name: "Viñas",
      username: "admin",
      role: "Admin",
      is_active: 1,
    },
    {
      user_id: 2,
      first_name: "Juan",
      last_name: "Dela Cruz",
      username: "staff1",
      role: "Staff",
      is_active: 1,
    },
  ];

  function maxUserId(users) {
    return Math.max(...users.map((user) => user.user_id), 0);
  }

  function readUserState() {
    const saved = localStorage.getItem(usersKey);
    if (!saved) {
      return {
        users: defaultUsers.map((user) => ({ ...user })),
        nextId: maxUserId(defaultUsers) + 1,
      };
    }

    const state = JSON.parse(saved);
    const records = Array.isArray(state) ? state : state && state.users;
    if (!Array.isArray(records)) {
      throw new Error("Saved user data has an unexpected format.");
    }

    const ids = new Set();
    const usernames = new Set();
    const users = records.map((record) => {
      const role = record && record.role === "Owner" ? "Admin" : record?.role;
      const username =
        typeof record?.username === "string"
          ? record.username.trim().toLowerCase()
          : "";
      const isActive =
        record?.is_active === true || record?.is_active === 1
          ? 1
          : record?.is_active === false || record?.is_active === 0
            ? 0
            : null;
      if (
        !record ||
        !Number.isInteger(record.user_id) ||
        record.user_id < 1 ||
        ids.has(record.user_id) ||
        typeof record.first_name !== "string" ||
        !record.first_name.trim() ||
        typeof record.last_name !== "string" ||
        !record.last_name.trim() ||
        !username ||
        usernames.has(username) ||
        !["Admin", "Staff"].includes(role) ||
        isActive === null
      ) {
        throw new Error("Saved user data is invalid.");
      }
      ids.add(record.user_id);
      usernames.add(username);
      return {
        user_id: record.user_id,
        first_name: record.first_name.trim(),
        last_name: record.last_name.trim(),
        username,
        role,
        is_active: isActive,
      };
    });

    const minimumNextId = maxUserId(users) + 1;
    const nextId = Array.isArray(state) ? minimumNextId : state.nextId;
    if (!Number.isInteger(nextId) || nextId < minimumNextId) {
      throw new Error("Saved next user ID is invalid.");
    }
    return { users, nextId };
  }

  function readCredentials() {
    const saved = localStorage.getItem(credentialsKey);
    if (!saved) return {};

    const credentials = JSON.parse(saved);
    if (
      !credentials ||
      typeof credentials !== "object" ||
      Array.isArray(credentials) ||
      Object.values(credentials).some(
        (credential) =>
          !credential ||
          typeof credential.salt !== "string" ||
          typeof credential.hash !== "string",
      )
    ) {
      throw new Error("Saved password data is invalid.");
    }
    return credentials;
  }

  function userCredentialKey(user) {
    return `user:${user.user_id}`;
  }

  function credentialFor(user, credentials = readCredentials()) {
    return credentials[userCredentialKey(user)] || credentials[user.username];
  }

  function encodeBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
  }

  function decodeBase64(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  async function hashPassword(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Password protection requires a modern secure browser.");
    }
    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: decodeBase64(salt),
        iterations: passwordIterations,
        hash: "SHA-256",
      },
      key,
      256,
    );
    return encodeBase64(new Uint8Array(bits));
  }

  async function makeCredential(password) {
    const salt = encodeBase64(window.crypto.getRandomValues(new Uint8Array(16)));
    return { salt, hash: await hashPassword(password, salt) };
  }

  function persistUserData(userState, credentials) {
    const previousUsers = localStorage.getItem(usersKey);
    const previousCredentials = localStorage.getItem(credentialsKey);
    try {
      localStorage.setItem(usersKey, JSON.stringify(userState));
      localStorage.setItem(credentialsKey, JSON.stringify(credentials));
    } catch (error) {
      try {
        if (previousUsers === null) localStorage.removeItem(usersKey);
        else localStorage.setItem(usersKey, previousUsers);
        if (previousCredentials === null)
          localStorage.removeItem(credentialsKey);
        else localStorage.setItem(credentialsKey, previousCredentials);
      } catch (rollbackError) {
        console.error("Could not roll back saved user changes.", rollbackError);
      }
      throw new Error(`Could not save user changes: ${error.message}`);
    }
  }

  function sessionUserId() {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey));
      return Number.isInteger(session?.user_id) ? session.user_id : null;
    } catch (error) {
      console.error("Could not read the signed-in user session.", error);
      return null;
    }
  }

  function setSession(userId) {
    sessionStorage.setItem(sessionKey, JSON.stringify({ user_id: userId }));
  }

  function clearSession() {
    sessionStorage.removeItem(sessionKey);
  }

  function getCurrentAccount() {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey));
      if (!session) return null;
      const users = readUserState().users;
      const user =
        Number.isInteger(session.user_id)
          ? users.find((entry) => entry.user_id === session.user_id)
          : users.find((entry) => entry.username === session.username);
      if (!user || !user.is_active) return null;
      if (!Number.isInteger(session.user_id)) setSession(user.user_id);
      return user;
    } catch (error) {
      console.error("Could not read the signed-in user.", error);
      return null;
    }
  }

  function showMessage(element, message) {
    element.textContent = message;
  }

  function initializeLoginPage() {
    const loginSection = document.getElementById("login-section");
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");

    try {
      readUserState();
      readCredentials();
    } catch (error) {
      loginSection.classList.remove("hidden");
      showMessage(loginError, error.message);
      loginForm.querySelector("button[type=submit]").disabled = true;
      return;
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginError.textContent = "";
      const username = loginForm.elements.username.value.trim().toLowerCase();
      const password = loginForm.elements.password.value;
      let user;
      try {
        user = readUserState().users.find(
          (entry) => entry.username === username && entry.is_active,
        );
      } catch (error) {
        showMessage(loginError, `Could not load users: ${error.message}`);
        return;
      }
      if (!user) {
        showMessage(loginError, "Incorrect username or password.");
        return;
      }

      const submitButton = loginForm.querySelector("button[type=submit]");
      submitButton.disabled = true;
      try {
        const currentCredentials = readCredentials();
        let credential = credentialFor(user, currentCredentials);
        if (
          !credential &&
          ((user.user_id === 1 && user.role === "Admin") ||
            (user.user_id === 2 && user.role === "Staff")) &&
          password === staffInitialPassword
        ) {
          credential = await makeCredential(password);
        }
        if (
          !credential ||
          (await hashPassword(password, credential.salt)) !== credential.hash
        ) {
          showMessage(loginError, "Incorrect username or password.");
          return;
        }
        currentCredentials[userCredentialKey(user)] = credential;
        delete currentCredentials[user.username];
        localStorage.setItem(
          credentialsKey,
          JSON.stringify(currentCredentials),
        );
        setSession(user.user_id);
        window.location.replace(
          user.role === "Staff" ? "sales.html" : "dashboard.html",
        );
      } catch (error) {
        showMessage(loginError, `Could not sign in: ${error.message}`);
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function renderSignedInUser(account) {
    const chip = document.querySelector(".user-chip");
    if (!chip) return;

    const name = `${account.first_name} ${account.last_name}`;
    const initials = `${account.first_name[0]}${account.last_name[0]}`;
    chip.querySelector(".avatar").textContent = initials;
    chip.querySelector("strong").textContent = name;
    chip.querySelector("small").textContent = account.role;

    if (!chip.querySelector(".logout-btn")) {
      const logoutButton = document.createElement("button");
      logoutButton.className = "logout-btn";
      logoutButton.type = "button";
      logoutButton.textContent = "Log out";
      logoutButton.addEventListener("click", () => {
        clearSession();
        window.location.replace("login.html");
      });
      chip.append(logoutButton);
    }
  }

  function refreshUserTable() {
    if (typeof window.refreshUsersTable === "function") {
      window.refreshUsersTable();
    }
  }

  function openUserDialog(user = null) {
    const dialog = document.getElementById("user-dialog");
    const form = document.getElementById("user-form");
    const state = readUserState();
    form.reset();
    form.dataset.mode = user ? "edit" : "add";
    form.dataset.userId = user ? String(user.user_id) : "";
    document.getElementById("user-form-error").textContent = "";
    document.getElementById("user-dialog-title").textContent = user
      ? "Edit user"
      : "Add user";
    document.getElementById("user-password-hint").textContent = user
      ? "(leave blank to keep current)"
      : "(required)";

    form.elements.user_id.value = user ? user.user_id : state.nextId;
    form.elements.first_name.value = user ? user.first_name : "";
    form.elements.last_name.value = user ? user.last_name : "";
    form.elements.username.value = user ? user.username : "";
    form.elements.role.value = user ? user.role : "Staff";
    form.elements.is_active.value = user ? String(user.is_active) : "1";
    form.elements.password.value = "";
    form.elements.confirm_password.value = "";
    form.elements.password.required = !user;
    form.elements.confirm_password.required = !user;
    dialog.showModal();
  }

  function hasActiveAdmin(users) {
    return users.some((user) => user.role === "Admin" && user.is_active === 1);
  }

  function saveUserData(nextUsers, nextCredentials, nextId) {
    if (!hasActiveAdmin(nextUsers)) {
      throw new Error("At least one active admin account must remain.");
    }

    const previousUsers = localStorage.getItem(usersKey);
    const previousCredentials = localStorage.getItem(credentialsKey);
    const nextState = { users: nextUsers, nextId };
    try {
      localStorage.setItem(usersKey, JSON.stringify(nextState));
      localStorage.setItem(credentialsKey, JSON.stringify(nextCredentials));
    } catch (error) {
      try {
        if (previousUsers === null) localStorage.removeItem(usersKey);
        else localStorage.setItem(usersKey, previousUsers);
        if (previousCredentials === null)
          localStorage.removeItem(credentialsKey);
        else localStorage.setItem(credentialsKey, previousCredentials);
      } catch (rollbackError) {
        console.error("Could not roll back saved user changes.", rollbackError);
      }
      throw new Error(`Could not save user changes: ${error.message}`);
    }
  }

  function updateCurrentSession(user) {
    if (sessionUserId() !== user.user_id) return;
    if (!user.is_active) {
      clearSession();
      window.location.replace("login.html");
      return;
    }

    window.authContext.user = user;
    renderSignedInUser(user);
    if (user.role === "Staff" && document.body.dataset.page !== "sales") {
      window.location.replace("sales.html");
    }
  }

  async function submitUserForm(form) {
    const errorElement = document.getElementById("user-form-error");
    errorElement.textContent = "";
    const state = readUserState();
    const isEditing = form.dataset.mode === "edit";
    const existingUser = isEditing
      ? state.users.find(
          (user) => user.user_id === Number(form.dataset.userId),
        )
      : null;
    if (isEditing && !existingUser) {
      throw new Error("The selected user no longer exists.");
    }

    const firstName = form.elements.first_name.value.trim();
    const lastName = form.elements.last_name.value.trim();
    const username = form.elements.username.value.trim().toLowerCase();
    const role = form.elements.role.value;
    const isActive = Number(form.elements.is_active.value);
    const password = form.elements.password.value;
    const confirmation = form.elements.confirm_password.value;
    if (!firstName || !lastName || !username) {
      throw new Error("Name and username are required.");
    }
    if (!["Admin", "Staff"].includes(role) || ![0, 1].includes(isActive)) {
      throw new Error("Choose a valid role and status.");
    }
    if (
      state.users.some(
        (user) =>
          user.username === username &&
          user.user_id !== (existingUser && existingUser.user_id),
      )
    ) {
      throw new Error("That username is already in use.");
    }
    if ((!isEditing || password || confirmation) && password.length < 8) {
      throw new Error("Passwords must contain at least 8 characters.");
    }
    if (password !== confirmation) {
      throw new Error("The passwords do not match.");
    }

    const user = {
      user_id: existingUser ? existingUser.user_id : state.nextId,
      first_name: firstName,
      last_name: lastName,
      username,
      role,
      is_active: isActive,
    };
    const nextUsers = existingUser
      ? state.users.map((entry) =>
          entry.user_id === existingUser.user_id ? user : entry,
        )
      : [...state.users, user];
    if (!hasActiveAdmin(nextUsers)) {
      throw new Error("At least one active admin account must remain.");
    }

    const nextCredentials = readCredentials();
    const idCredentialKey = userCredentialKey(user);
    if (existingUser) {
      const existingCredential = credentialFor(existingUser, nextCredentials);
      if (existingCredential) {
        nextCredentials[idCredentialKey] = existingCredential;
      }
      delete nextCredentials[existingUser.username];
      if (username !== existingUser.username) delete nextCredentials[username];
    } else {
      delete nextCredentials[username];
    }
    if (password) {
      nextCredentials[idCredentialKey] = await makeCredential(password);
    }

    saveUserData(
      nextUsers,
      nextCredentials,
      existingUser ? state.nextId : state.nextId + 1,
    );
    document.getElementById("user-dialog").close();
    refreshUserTable();
    updateCurrentSession(user);
  }

  function deleteUser(userId) {
    const state = readUserState();
    const user = state.users.find((entry) => entry.user_id === userId);
    if (!user) return;
    if (sessionUserId() === user.user_id) {
      window.alert("You cannot delete the account you are currently using.");
      return;
    }
    if (
      !window.confirm(
        `Delete ${user.first_name} ${user.last_name}'s account? Existing history will be kept.`,
      )
    ) {
      return;
    }

    const nextUsers = state.users.filter(
      (entry) => entry.user_id !== user.user_id,
    );
    if (!hasActiveAdmin(nextUsers)) {
      window.alert("At least one active admin account must remain.");
      return;
    }
    const nextCredentials = readCredentials();
    delete nextCredentials[userCredentialKey(user)];
    delete nextCredentials[user.username];
    try {
      saveUserData(nextUsers, nextCredentials, state.nextId);
      refreshUserTable();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function initializeUserManagement() {
    const dialog = document.getElementById("user-dialog");
    if (!dialog) return;

    const form = document.getElementById("user-form");
    document.getElementById("add-user-btn").addEventListener("click", () => {
      try {
        openUserDialog();
      } catch (error) {
        window.alert(`Could not open the user form: ${error.message}`);
      }
    });
    document.getElementById("close-user-dialog").addEventListener("click", () => {
      dialog.close();
    });
    document.getElementById("users-table").addEventListener("click", (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest("[data-edit-user], [data-delete-user]")
          : null;
      if (!button) return;
      if (button.dataset.editUser) {
        try {
          const user = readUserState().users.find(
            (entry) => entry.user_id === Number(button.dataset.editUser),
          );
          if (user) openUserDialog(user);
        } catch (error) {
          window.alert(`Could not open the user record: ${error.message}`);
        }
      } else if (button.dataset.deleteUser) {
        try {
          deleteUser(Number(button.dataset.deleteUser));
        } catch (error) {
          window.alert(`Could not delete the user: ${error.message}`);
        }
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type=submit]");
      submitButton.disabled = true;
      try {
        await submitUserForm(form);
      } catch (error) {
        showMessage(
          document.getElementById("user-form-error"),
          error.message,
        );
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  window.getAppUsers = () => readUserState().users;
  window.passwordStatusFor = (user) => {
    try {
      if (credentialFor(user)) return "Configured";
      return user.user_id === 2 && user.role === "Staff"
        ? "Default password"
        : "Not set";
    } catch (error) {
      console.error("Could not read password status.", error);
      return "Unavailable";
    }
  };

  if (document.body.dataset.page === "login") {
    const currentAccount = getCurrentAccount();
    if (currentAccount) {
      window.location.replace(
        currentAccount.role === "Staff" ? "sales.html" : "dashboard.html",
      );
    } else {
      initializeLoginPage();
    }
    return;
  }

  const account = getCurrentAccount();
  const page = document.body.dataset.page;
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
  initializeUserManagement();

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
})();
