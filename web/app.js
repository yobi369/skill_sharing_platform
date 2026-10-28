const API_BASE = (window.SKILLCHAIN_CONFIG?.apiBaseUrl ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "skillchain.session-token";
const state = {
  token: sessionStorage.getItem(TOKEN_KEY),
  user: null,
  skills: [],
  mySkills: [],
  requests: [],
  query: "",
  category: "",
  offset: 0,
  limit: 12,
  hasMore: false,
  requestingSkill: null
};

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

async function api(path, options = {}) {
  if (!API_BASE) {
    throw new Error("SkillChain is in preview mode. Account and marketplace actions become available after the API is configured.");
  }
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "omit",
      cache: "no-store"
    });
  } catch {
    throw new Error("Could not reach the API. Check the API URL and CORS_ORIGINS configuration.");
  }
  if (response.status === 204) return null;
  let data = {};
  try { data = await response.json(); } catch { /* Keep an empty error payload for non-JSON responses. */ }
  if (!response.ok) {
    const messages = {
      unauthorized: "Please sign in again to continue.",
      invalid_credentials: "Email or password is incorrect.",
      email_already_registered: "An account already uses that email.",
      skill_not_found: "That skill listing is no longer available.",
      cannot_request_own_skill: "You cannot request your own skill.",
      email_not_verified: "Verify your email address before signing in.",
      verification_token_invalid_or_expired: "That verification link has expired or has already been used.",
      reset_token_invalid_or_expired: "That password-reset link has expired or has already been used.",
      email_delivery_not_configured: "Email delivery is not configured on this server. Contact the site administrator."
    };
    const key = data.error;
    throw new Error(messages[key] ?? data.message ?? key ?? `Request failed (${response.status}).`);
  }
  return data;
}

function setMessage(element, message = "", kind = "") {
  element.textContent = message;
  element.classList.toggle("error", kind === "error");
  element.classList.toggle("success", kind === "success");
}

function notify(message) {
  const node = byId("global-message");
  node.textContent = message;
  node.classList.add("visible");
  window.setTimeout(() => node.classList.remove("visible"), 4200);
}

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(text, className, action) {
  const button = makeElement("button", `button ${className}`, text);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function emptyState(container, message) {
  container.replaceChildren(makeElement("p", "empty-state", message));
}

function renderSkills(items, append = false) {
  const container = byId("skill-list");
  if (!append) container.replaceChildren();
  if (!items.length && !append) {
    emptyState(container, "No published skills match your search yet. Try another term or check back later.");
    return;
  }
  for (const skill of items) {
    const card = makeElement("article", "skill-card");
    const meta = makeElement("div", "skill-meta");
    meta.append(makeElement("span", "pill", skill.category || "Other"));
    meta.append(makeElement("span", "", `Shared by ${skill.owner_name || "Community member"}`));
    const title = makeElement("h3", "", skill.title);
    const description = makeElement("p", "", skill.description);
    const date = makeElement("p", "muted", `Published ${formatDate(skill.created_at)}`);
    card.append(meta, title, description, date);
    if (state.user && skill.owner_id !== state.user.id) {
      card.append(makeButton("Request to learn", "button-primary", () => openRequest(skill)));
      card.append(makeButton("Report listing", "button-quiet", () => openReport("skill", skill.id)));
      card.append(makeButton("Report member", "button-quiet", () => openReport("user", skill.owner_id)));
    } else if (!state.user) {
      card.append(makeButton("Sign in to request", "button-secondary", () => {
        byId("auth-panel").scrollIntoView({ behavior: "smooth", block: "center" });
        setMessage(byId("auth-message"), "Sign in or create an account to request a skill.");
      }));
    } else {
      card.append(makeElement("span", "pill", "Your listing"));
    }
    container.append(card);
  }
}

async function loadSkills({ reset = false } = {}) {
  const container = byId("skill-list");
  if (reset) state.offset = 0;
  container.setAttribute("aria-busy", "true");
  byId("load-more").disabled = true;
  setMessage(byId("listing-message"), "Loading published skills…");
  try {
    const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
    if (state.query) params.set("q", state.query);
    if (state.category) params.set("category", state.category);
    const result = await api(`/api/skills?${params.toString()}`);
    state.hasMore = result.items.length === state.limit;
    state.offset += result.items.length;
    renderSkills(result.items, !reset && state.offset > result.items.length);
    byId("load-more").hidden = !state.hasMore;
    setMessage(byId("listing-message"), result.items.length ? `${state.offset} listing(s) loaded.` : "No listings found.");
  } catch (error) {
    setMessage(byId("listing-message"), error.message, "error");
    if (reset) emptyState(container, "Listings could not be loaded. Check the API connection and retry.");
    byId("load-more").hidden = true;
  } finally {
    container.setAttribute("aria-busy", "false");
    byId("load-more").disabled = false;
  }
}

function setSignedIn(user) {
  state.user = user;
  byId("auth-panel").hidden = Boolean(user);
  byId("account-panel").hidden = !user;
  byId("workspace").hidden = !user;
  byId("workspace-link").hidden = !user;
  byId("account-name").textContent = user ? `${user.name} · ${user.email}` : "";
  if (user) {
    byId("account-heading").textContent = `Welcome, ${user.name}`;
    byId("admin-panel").hidden = user.role !== "admin";
    void loadWorkspace();
    void loadNotifications();
    if (user.role === "admin") void loadAdminReports();
  } else {
    byId("admin-panel").hidden = true;
    state.mySkills = [];
    state.requests = [];
    byId("my-skills").replaceChildren();
    byId("request-list").replaceChildren();
  }
  void loadSkills({ reset: true });
}

function setLinkMessage(element, message, url, label) {
  element.replaceChildren(document.createTextNode(message + " "));
  if (url) {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = label;
    link.rel = "noopener noreferrer";
    element.append(link);
  }
}

async function establishSession(result, messageNode) {
  if (result.verificationRequired && !result.token) {
    setMessage(messageNode, "Account created. Check your email to verify the address before signing in.", "success");
    return;
  }
  if (!result.token) {
    setMessage(messageNode, result.message ?? "Check your email for the next step.", "success");
    return;
  }
  state.token = result.token;
  sessionStorage.setItem(TOKEN_KEY, result.token);
  setSignedIn(result.user);
  setMessage(messageNode, "You're signed in.", "success");
  if (result.verificationUrl) setLinkMessage(messageNode, "Development account created. Verify your email:", result.verificationUrl, "Verify email");
  notify(`Welcome, ${result.user.name}.`);
}

byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("auth-message");
  setMessage(message, "Signing in…");
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await api("/api/auth/login", { method: "POST", body: data });
    await establishSession(result, message);
    form.reset();
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("auth-message");
  setMessage(message, "Creating your account…");
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await api("/api/auth/register", { method: "POST", body: data });
    await establishSession(result, message);
    form.reset();
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("forgot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("auth-message");
  setMessage(message, "Requesting password reset…");
  try {
    const result = await api("/api/auth/forgot-password", { method: "POST", body: Object.fromEntries(new FormData(form)) });
    setMessage(message, result.message, "success");
    if (result.developmentUrl) setLinkMessage(message, result.message, result.developmentUrl, "Open reset link");
    form.reset();
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("resend-verification-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("auth-message");
  setMessage(message, "Requesting verification email…");
  try {
    const result = await api("/api/auth/resend-verification", { method: "POST", body: Object.fromEntries(new FormData(form)) });
    setMessage(message, result.message, "success");
    form.reset();
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("auth-message");
  setMessage(message, "Updating password…");
  try {
    const result = await api("/api/auth/reset-password", { method: "POST", body: Object.fromEntries(new FormData(form)) });
    setMessage(message, result.message, "success");
    form.reset();
    form.hidden = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("reset");
    window.history.replaceState({}, "", url);
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("delete-account-open").addEventListener("click", () => {
  byId("delete-account-password").value = "";
  setMessage(byId("delete-account-message"), "");
  byId("delete-account-dialog").showModal();
});

byId("delete-account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.confirm("Permanently delete this account and its listings? This cannot be undone.")) return;
  const message = byId("delete-account-message");
  setMessage(message, "Deleting account…");
  try {
    await api("/api/account", { method: "DELETE", body: { password: byId("delete-account-password").value } });
    byId("delete-account-dialog").close();
    state.token = null;
    sessionStorage.removeItem(TOKEN_KEY);
    setSignedIn(null);
    setMessage(byId("auth-message"), "Your account was deleted.", "success");
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("signout-button").addEventListener("click", () => {
  state.token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  setSignedIn(null);
  setMessage(byId("auth-message"), "You have signed out.", "success");
});

byId("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = byId("search-query").value.trim();
  state.category = byId("search-category").value.trim();
  void loadSkills({ reset: true });
});

byId("load-more").addEventListener("click", () => void loadSkills());

byId("skill-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId("skill-form-message");
  const data = Object.fromEntries(new FormData(form));
  setMessage(message, "Saving listing…");
  try {
    await api("/api/skills", { method: "POST", body: data });
    form.reset();
    setMessage(message, "Your skill listing was saved.", "success");
    notify("Skill listing saved.");
    await loadWorkspace();
    await loadSkills({ reset: true });
  } catch (error) { setMessage(message, error.message, "error"); }
});

function openRequest(skill) {
  if (!state.user) {
    byId("auth-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    setMessage(byId("auth-message"), "Sign in to send a request.");
    return;
  }
  state.requestingSkill = skill;
  byId("request-dialog-title").textContent = "Request to learn";
  byId("request-skill-name").textContent = skill.title;
  byId("request-message").value = "";
  setMessage(byId("request-message-status"), "");
  byId("request-dialog").showModal();
}

byId("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.requestingSkill) return;
  const message = byId("request-message-status");
  setMessage(message, "Sending request…");
  try {
    await api(`/api/skills/${encodeURIComponent(state.requestingSkill.id)}/requests`, {
      method: "POST",
      body: { message: byId("request-message").value.trim() }
    });
    byId("request-dialog").close();
    notify("Your skill request was sent.");
    await loadWorkspace();
  } catch (error) { setMessage(message, error.message, "error"); }
});

byId("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = byId("edit-skill-id").value;
  const message = byId("edit-message");
  setMessage(message, "Saving changes…");
  const body = {
    title: byId("edit-title").value.trim(),
    description: byId("edit-description").value.trim(),
    category: byId("edit-category").value.trim(),
    status: byId("edit-status").value
  };
  try {
    await api(`/api/skills/${encodeURIComponent(id)}`, { method: "PATCH", body });
    byId("edit-dialog").close();
    notify("Skill listing updated.");
    await loadWorkspace();
    await loadSkills({ reset: true });
  } catch (error) { setMessage(message, error.message, "error"); }
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => byId(button.dataset.closeDialog).close());
});

async function loadWorkspace() {
  if (!state.user) return;
  try {
    const [mine, requests] = await Promise.all([api("/api/skills/mine"), api("/api/requests")]);
    state.mySkills = mine.items;
    state.requests = requests.items;
    renderMySkills();
    renderRequests();
  } catch (error) {
    if (error.message.includes("sign in again")) {
      state.token = null;
      sessionStorage.removeItem(TOKEN_KEY);
      setSignedIn(null);
    } else {
      notify(error.message);
    }
  }
}

function renderMySkills() {
  const container = byId("my-skills");
  container.replaceChildren();
  if (!state.mySkills.length) {
    emptyState(container, "You haven't published a skill yet. Use the form to add your first listing.");
    return;
  }
  for (const skill of state.mySkills) {
    const item = makeElement("article", "list-item");
    item.append(makeElement("h4", "", skill.title));
    item.append(makeElement("p", "", skill.description));
    const meta = makeElement("div", "skill-meta");
    meta.append(makeElement("span", "pill", skill.status));
    meta.append(makeElement("span", "", skill.category));
    item.append(meta);
    const actions = makeElement("div", "item-actions");
    const edit = makeButton("Edit", "button-quiet", () => {
      byId("edit-skill-id").value = skill.id;
      byId("edit-title").value = skill.title;
      byId("edit-description").value = skill.description;
      byId("edit-category").value = skill.category;
      byId("edit-status").value = skill.status;
      setMessage(byId("edit-message"), "");
      byId("edit-dialog").showModal();
    });
    actions.append(edit);
    if (skill.status !== "archived") {
      actions.append(makeButton("Archive", "button-quiet", async () => {
        try {
          await api(`/api/skills/${encodeURIComponent(skill.id)}`, { method: "PATCH", body: { status: "archived" } });
          notify("Listing archived.");
          await loadWorkspace();
          await loadSkills({ reset: true });
        } catch (error) { notify(error.message); }
      }));
    }
    actions.append(makeButton("Delete", "button-quiet", async () => {
      if (!window.confirm("Delete this skill listing and its related requests? This cannot be undone.")) return;
      try {
        await api(`/api/skills/${encodeURIComponent(skill.id)}`, { method: "DELETE" });
        notify("Listing deleted.");
        await loadWorkspace();
        await loadSkills({ reset: true });
      } catch (error) { notify(error.message); }
    }));
    item.append(actions);
    container.append(item);
  }
}

function renderRequests() {
  const container = byId("request-list");
  container.replaceChildren();
  if (!state.requests.length) {
    emptyState(container, "No exchange requests yet. Requests you send or receive will appear here.");
    return;
  }
  for (const request of state.requests) {
    const item = makeElement("article", "list-item");
    const isProvider = request.provider_id === state.user.id;
    const otherPerson = isProvider ? request.requester_name : request.provider_name;
    item.append(makeElement("h4", "", request.skill_title));
    item.append(makeElement("p", "", `${isProvider ? "Request from" : "Request to"} ${otherPerson || "member"}`));
    item.append(makeElement("p", "", request.message));
    const meta = makeElement("div", "skill-meta");
    meta.append(makeElement("span", "pill", request.status));
    meta.append(makeElement("span", "", formatDate(request.created_at)));
    item.append(meta);
    if (request.status === "pending") {
      const actions = makeElement("div", "item-actions");
      if (isProvider) {
        actions.append(makeButton("Accept", "button-primary", () => updateRequest(request.id, "accepted")));
        actions.append(makeButton("Decline", "button-quiet", () => updateRequest(request.id, "declined")));
      } else {
        actions.append(makeButton("Cancel request", "button-quiet", () => updateRequest(request.id, "cancelled")));
      }
      item.append(actions);
    }
    container.append(item);
  }
}

async function updateRequest(id, status) {
  try {
    await api(`/api/requests/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
    notify(`Request ${status}.`);
    await loadWorkspace();
  } catch (error) { notify(error.message); }
}

function openReport(targetType, targetId) {
  if (!state.user) {
    byId("auth-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    setMessage(byId("auth-message"), "Sign in to report unsafe or misleading content.");
    return;
  }
  byId("report-target-type").value = targetType;
  byId("report-target-id").value = targetId;
  byId("report-details").value = "";
  setMessage(byId("report-message"), "");
  byId("report-dialog").showModal();
}

byId("report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = byId("report-message");
  setMessage(message, "Submitting report…");
  try {
    await api("/api/reports", { method: "POST", body: {
      targetType: byId("report-target-type").value,
      targetId: byId("report-target-id").value,
      reason: byId("report-reason").value,
      details: byId("report-details").value.trim()
    }});
    byId("report-dialog").close();
    notify("Report submitted for moderation.");
  } catch (error) { setMessage(message, error.message, "error"); }
});

async function loadNotifications() {
  const container = byId("notification-list");
  try {
    const result = await api("/api/notifications");
    container.replaceChildren();
    if (!result.items.length) { emptyState(container, "You're all caught up. New requests and updates will appear here."); return; }
    for (const item of result.items) {
      const row = makeElement("article", "list-item");
      row.append(makeElement("h4", "", item.title));
      row.append(makeElement("p", "", item.body));
      row.append(makeElement("p", "muted", formatDate(item.created_at) + (item.read_at ? " · Read" : " · Unread")));
      if (!item.read_at) row.append(makeButton("Mark as read", "button-quiet", async () => {
        try { await api("/api/notifications/" + encodeURIComponent(item.id) + "/read", { method: "PATCH", body: {} }); await loadNotifications(); }
        catch (error) { notify(error.message); }
      }));
      container.append(row);
    }
  } catch (error) { emptyState(container, error.message); }
}

async function loadAdminReports() {
  if (state.user?.role !== "admin") return;
  const container = byId("admin-report-list");
  try {
    const result = await api("/api/admin/reports?status=" + encodeURIComponent(byId("report-filter").value));
    container.replaceChildren();
    if (!result.items.length) { emptyState(container, "No reports in this queue."); return; }
    for (const report of result.items) {
      const row = makeElement("article", "list-item");
      row.append(makeElement("h4", "", report.reason + " · " + report.target_type));
      row.append(makeElement("p", "", report.details));
      row.append(makeElement("p", "muted", "Reported by " + report.reporter_name + " · " + formatDate(report.created_at)));
      const note = document.createElement("textarea");
      note.maxLength = 2000;
      note.rows = 2;
      note.placeholder = "Optional moderator note";
      note.setAttribute("aria-label", "Moderator note for report " + report.id);
      row.append(note);
      const actions = makeElement("div", "item-actions");
      for (const action of [
        { label: "Review", status: "reviewing", suspend: false },
        { label: "Resolve", status: "resolved", suspend: false },
        { label: "Dismiss", status: "dismissed", suspend: false },
        { label: "Resolve & suspend/archive", status: "resolved", suspend: true }
      ]) actions.append(makeButton(action.label, "button-quiet", async () => {
        if (action.suspend && !window.confirm("Suspend this reported user or archive this reported skill?")) return;
        try {
          await api("/api/admin/reports/" + encodeURIComponent(report.id), { method: "PATCH", body: { status: action.status, note: note.value.trim(), suspendTarget: action.suspend } });
          notify("Moderation action saved.");
          await loadAdminReports();
        } catch (error) { notify(error.message); }
      }));
      row.append(actions);
      container.append(row);
    }
  } catch (error) { emptyState(container, error.message); }
}

byId("refresh-notifications").addEventListener("click", () => void loadNotifications());
byId("refresh-reports").addEventListener("click", () => void loadAdminReports());
byId("report-filter").addEventListener("change", () => void loadAdminReports());

async function checkConnection() {
  const status = byId("connection-status");
  if (!API_BASE) {
    status.textContent = "Preview · API not connected";
    status.classList.add("error");
    status.classList.remove("connected");
    return;
  }
  try {
    await api("/health/ready");
    status.textContent = "API connected";
    status.classList.add("connected");
    status.classList.remove("error");
  } catch {
    status.textContent = "API unavailable";
    status.classList.add("error");
    status.classList.remove("connected");
  }
}

function applyApiAvailability() {
  if (API_BASE) return;
  document.body.classList.add("api-not-configured");
  document.querySelectorAll("form input, form textarea, form select, form button").forEach((control) => {
    control.disabled = true;
  });
  for (const id of ["load-more", "delete-account-open", "signout-button", "refresh-notifications", "refresh-reports"]) {
    const control = byId(id);
    if (control) control.disabled = true;
  }
}

async function init() {
  applyApiAvailability();
  const url = new URL(window.location.href);
  const verificationToken = url.searchParams.get("verify");
  const resetToken = url.searchParams.get("reset");
  if (resetToken) {
    byId("reset-token").value = resetToken;
    byId("reset-form").hidden = false;
    byId("reset-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (verificationToken) {
    try {
      const result = await api("/api/auth/verify-email", { method: "POST", body: { token: verificationToken } });
      setMessage(byId("auth-message"), result.message, "success");
    } catch (error) { setMessage(byId("auth-message"), error.message, "error"); }
    url.searchParams.delete("verify");
    window.history.replaceState({}, "", url);
  }
  await checkConnection();
  if (state.token) {
    try {
      const result = await api("/api/auth/me");
      setSignedIn(result.user);
    } catch {
      state.token = null;
      sessionStorage.removeItem(TOKEN_KEY);
      setSignedIn(null);
    }
  } else {
    setSignedIn(null);
  }
}

void init();
