const STORAGE_KEY = "rana54-control-centre-v2-state";
const app = document.getElementById("app");
const overlay = document.getElementById("overlay");
const toastRegion = document.getElementById("toast-region");

const clone = value => JSON.parse(JSON.stringify(value));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const required = ["enterprises","siteRequests","installers","jobs","devices","incidents","staff","supportGrants","services","audit"];
    if (saved && required.every(key => Array.isArray(saved[key]))) return saved;
  } catch (error) {
    console.warn("Network Operations state could not be restored", error);
  }
  return clone(window.RANA_CONTROL_SEED);
}

let state = loadState();
let currentOverlay = null;
let activeTabs = { enterprises: "accounts", field: "jobs", access: "staff", platform: "health" };
let filters = { enterprises: "", field: "", devices: "", incidents: "", access: "", status: "All" };

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn("Network Operations changes could not be persisted", error); }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function route() {
  return location.hash.replace(/^#\/?/, "").split("/")[0] || "overview";
}

function navigate(path) {
  location.hash = `#/${path}`;
}

function icon(name) {
  const icons = {
    overview: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    enterprise: '<svg viewBox="0 0 24 24"><path d="M4 21V8l8-4 8 4v13"/><path d="M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01M8 13h.01M12 13h.01M16 13h.01"/></svg>',
    field: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 3.6 12 1 11l-1 2.7 3.3 3.3L6 16l-1-2.6 8.4-8.4 2.3 2.3a4 4 0 0 0-1 5"/><path d="m13 13 8 8M17 17l2-2"/></svg>',
    device: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h4M16 15h.01"/></svg>',
    incident: '<svg viewBox="0 0 24 24"><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    access: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    platform: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="4"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7L20 14"/><path d="M20 8v6h-6"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M9 18 3.5 21V6L9 3l6 3 5.5-3v15L15 21l-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
    terminal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg>'
  };
  return `<span class="icon" aria-hidden="true">${icons[name] || icons.info}</span>`;
}

function chip(value) {
  const text = String(value);
  const lower = text.toLowerCase();
  let tone = "gray";
  if (["active", "live", "operational", "approved", "completed", "current", "available", "passing", "resolved", "accepted"].some(word => lower.includes(word))) tone = "green";
  if (["pending", "onboarding", "testing", "ready", "acknowledged", "investigating", "on job", "scheduled"].some(word => lower.includes(word))) tone = "amber";
  if (["needs attention", "blocked", "offline", "conflict", "degraded", "suspended", "returned", "open"].some(word => lower.includes(word))) tone = lower.includes("degraded") ? "orange" : "red";
  if (["read only", "measured", "assigned"].some(word => lower.includes(word))) tone = "blue";
  return `<span class="chip ${tone}">${escapeHtml(text)}</span>`;
}

function severity(level) {
  return `<span class="severity ${String(level).toLowerCase()}">${escapeHtml(level)}</span>`;
}

function addAudit(action, entity, outcome, reason) {
  const now = new Date();
  const time = now.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  state.audit.unshift({
    id: `AUD-${String(Date.now()).slice(-6)}`,
    time,
    actor: "Platform operations",
    action,
    entity,
    outcome,
    reason
  });
}

function toast(title, detail = "The change was recorded in the immutable audit history.") {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `${icon("check")}<div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
  toastRegion.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

function navItems() {
  const openIncidents = state.incidents.filter(item => item.status !== "Resolved").length;
  return [
    ["overview", "overview", "Overview", 0],
    ["enterprises", "enterprise", "Enterprises", state.siteRequests.filter(item => item.status === "Pending review").length],
    ["field", "field", "Field Operations", state.jobs.filter(item => ["Blocked", "Ready for acceptance"].includes(item.status)).length],
    ["devices", "device", "Devices", state.devices.filter(item => ["Offline", "Identity conflict"].includes(item.status)).length],
    ["incidents", "incident", "Incidents", openIncidents],
    ["access", "access", "Access", 0],
    ["platform", "platform", "Platform", state.services.filter(item => item.status !== "Operational").length]
  ];
}

function brand() {
  return `<a class="brand" href="#/overview" aria-label="Rana54 Network Operations home">
    <span class="brand-symbol"><img src="./assets/rana54-mark.png" alt="" /></span>
    <span class="brand-word">RANA<b>54</b></span>
    <span class="brand-tag">Network Ops</span>
  </a>`;
}

function shell(content, active) {
  return `<div class="app-shell">
    <aside class="sidebar" aria-label="Network Operations navigation">
      <div class="brand-wrap">${brand()}</div>
      <div class="environment-block">
        <span class="eyebrow">Environment</span>
        <div class="environment-name"><span class="pulse"></span> Production operations</div>
        <small>Cross-tenant, audited access</small>
      </div>
      <nav class="side-nav">
        ${navItems().map(([path, iconName, label, count]) => `<a class="nav-item ${active === path ? "active" : ""}" href="#/${path}">
          <span class="nav-icon">${icon(iconName)}</span>
          <span>${label}</span>
          ${count ? `<span class="nav-count">${count}</span>` : ""}
        </a>`).join("")}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="side-safety">
        <strong>${icon("shield")} Privileged workspace</strong>
        <p>Elevated actions require a reason. Tenant support access is read only, time limited, and audited.</p>
      </div>
    </aside>
    <button class="mobile-scrim" data-action="close-menu" aria-label="Close navigation"></button>
    <section class="workspace">
      <header class="topbar">
        <button class="mobile-menu" data-action="toggle-menu" aria-label="Open navigation">${icon("menu")}</button>
        <div class="scope-copy"><strong>Network Operations</strong><small>Rana54 live infrastructure</small></div>
        <div class="topbar-spacer"></div>
        <div class="global-search">
          ${icon("search")}
          <input id="global-search" type="search" autocomplete="off" placeholder="Search exact ID, serial, site, enterprise" aria-label="Global search" />
          <span class="search-key">/</span>
          <div id="search-results"></div>
        </div>
        <button class="icon-button" data-action="show-notifications" aria-label="Notifications">${icon("bell")}<span class="notification-count">${state.incidents.filter(item => item.status === "Open").length}</span></button>
      </header>
      ${content}
    </section>
  </div>`;
}

function pageHeader(kicker, title, description, actions = "") {
  return `<header class="page-header">
    <div class="page-title-group"><span class="eyebrow">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
    ${actions ? `<div class="header-actions">${actions}</div>` : ""}
  </header>`;
}

function panel(title, description, body, action = "") {
  return `<section class="panel">
    <div class="panel-head"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${action}</div>
    ${body}
  </section>`;
}

function metric(label, value, detail, tone = "") {
  return `<div class="metric"><div class="metric-label"><span class="dot ${tone}"></span>${escapeHtml(label)}</div><div class="metric-value">${value}</div><div class="metric-detail">${escapeHtml(detail)}</div></div>`;
}

function pageSearch(placeholder, key) {
  return `<div class="search-field">${icon("search")}<input type="search" data-filter-input="${key}" value="${escapeHtml(filters[key] || "")}" placeholder="${escapeHtml(placeholder)}" /></div>`;
}

function render() {
  const active = route();
  document.body.classList.remove("menu-open");
  const views = {
    overview: overviewView,
    enterprises: enterprisesView,
    field: fieldView,
    devices: devicesView,
    incidents: incidentsView,
    access: accessView,
    platform: platformView
  };
  const view = views[active] || overviewView;
  app.innerHTML = shell(view(), views[active] ? active : "overview");
  document.title = `${active === "overview" ? "Overview" : active[0].toUpperCase() + active.slice(1)} | Rana54 Network Operations`;
  bindGlobalSearch();
}

function overviewView() {
  const activeEnterprises = state.enterprises.filter(item => item.status === "Active").length;
  const openHigh = state.incidents.filter(item => item.status !== "Resolved" && ["P1", "P2"].includes(item.severity)).length;
  const blockedJobs = state.jobs.filter(item => ["Blocked", "Awaiting site approval"].includes(item.status)).length;
  const delayedGateways = state.devices.filter(item => ["Offline", "Identity conflict"].includes(item.status)).length;
  const health = Math.round(state.services.filter(item => item.status === "Operational").length / state.services.length * 100);
  const urgent = state.incidents.filter(item => item.status !== "Resolved").slice(0, 4);
  const jobs = state.jobs.filter(item => item.status !== "Completed").slice(0, 4);

  return `<main class="page">
    ${pageHeader("Operations command", "Network Operations", "See what needs attention, move onboarding forward, and protect every change with traceable operational evidence.", `<button class="btn btn-secondary" data-action="open-search">${icon("search")} Find a record</button><button class="btn btn-primary" data-action="new-enterprise">${icon("plus")} Create enterprise</button>`)}
    <section class="hero-console">
      <div class="hero-copy">
        <span class="eyebrow">Live infrastructure</span>
        <h2>One operational picture across every Rana54 account.</h2>
        <p>Enterprise onboarding, field delivery, gateway health, access, and incidents stay connected by exact identifiers and immutable history.</p>
        <div class="hero-actions"><button class="btn btn-primary" data-action="open-incident" data-id="${escapeHtml(urgent[0]?.id || "")}">${icon("incident")} Review highest priority</button><button class="btn btn-secondary" data-action="new-job">${icon("field")} Create field job</button></div>
      </div>
      <div class="hero-health">
        <div class="health-top"><span>Platform health</span><span class="status-live"><span class="pulse"></span> Live</span></div>
        <div><div class="health-score">${health}<small>% nominal</small></div><p>Three core services operational. Report generation remains degraded.</p></div>
        <div class="mini-service-list">${state.services.map(service => `<div class="mini-service"><span>${escapeHtml(service.name)}</span><b class="${service.status === "Operational" ? "" : "degraded"}">${escapeHtml(service.status)}</b></div>`).join("")}</div>
      </div>
    </section>
    <section class="metric-strip">
      ${metric("Active enterprises", `<span>${activeEnterprises}</span>`, `${state.enterprises.length - activeEnterprises} in onboarding or attention`)}
      ${metric("P1 and P2 incidents", `<span>${openHigh}</span>`, "Across device, installation, and platform", "red")}
      ${metric("Blocked field work", `<span>${blockedJobs}</span>`, "Includes jobs waiting for site approval", "amber")}
      ${metric("Gateway attention", `<span>${delayedGateways}</span>`, "Offline or identity conflict", "orange")}
    </section>
    <div class="grid two">
      ${panel("Priority queue", "Incidents ordered by severity and SLA", `<div class="panel-body"><div class="attention-list">${urgent.map(item => `<div class="attention-item"><span class="severity-bar ${item.severity.toLowerCase()}"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.enterprise)} · ${escapeHtml(item.scope)} · ${escapeHtml(item.owner)}</p></div><div class="attention-meta"><small>${escapeHtml(item.sla)}</small><button class="link-button" data-action="open-incident" data-id="${item.id}">Open incident</button></div></div>`).join("")}</div></div>`, `<a class="btn btn-small btn-quiet" href="#/incidents">View all ${icon("arrow")}</a>`)}
      ${panel("Field work in motion", "Installation progress and blockers", `<div class="panel-body"><div class="work-list">${jobs.map(job => `<button class="work-item" data-action="open-job" data-id="${job.id}" style="width:100%;text-align:left"><span class="work-icon">${icon("field")}</span><span><strong>${escapeHtml(job.site)}</strong><small>${escapeHtml(job.id)} · ${escapeHtml(job.installer)}</small></span>${chip(job.status)}</button>`).join("")}</div></div>`, `<a class="btn btn-small btn-quiet" href="#/field">Field queue ${icon("arrow")}</a>`)}
    </div>
  </main>`;
}

function enterprisesView() {
  const tab = activeTabs.enterprises;
  const query = (filters.enterprises || "").toLowerCase();
  const enterprises = state.enterprises.filter(item => !query || [item.id, item.name, item.region].some(value => String(value).toLowerCase().includes(query)));
  const requests = state.siteRequests.filter(item => !query || [item.id, item.enterprise, item.siteName, item.location].some(value => String(value).toLowerCase().includes(query)));
  const tabs = `<div class="tabs"><button class="tab ${tab === "accounts" ? "active" : ""}" data-action="set-tab" data-group="enterprises" data-tab="accounts">Accounts</button><button class="tab ${tab === "requests" ? "active" : ""}" data-action="set-tab" data-group="enterprises" data-tab="requests">Site requests <span>${state.siteRequests.filter(item => item.status === "Pending review").length}</span></button></div>`;
  const actions = `<button class="btn btn-secondary" data-action="new-support-grant">${icon("shield")} Support access</button><button class="btn btn-primary" data-action="new-enterprise">${icon("plus")} Create enterprise</button>`;

  let content = "";
  if (tab === "accounts") {
    content = `<div class="entity-grid">${enterprises.map(item => `<article class="entity-card">
      <div class="entity-card-top"><span class="entity-mark">${item.name.split(" ").map(word => word[0]).slice(0,2).join("")}</span>${chip(item.status)}</div>
      <h3>${escapeHtml(item.name)}</h3><span class="entity-id">${escapeHtml(item.id)}</span>
      <p>${escapeHtml(item.region)} · Initial admin ${escapeHtml(item.adminName || "Not assigned")}</p>
      <div class="progress"><span style="width:${item.readiness}%"></span></div>
      <div class="entity-stats"><span>Readiness<strong>${item.readiness}%</strong></span><span>Live sites<strong>${item.liveSites} of ${item.sites}</strong></span></div>
      <div style="margin-top:16px"><button class="btn btn-small btn-secondary" data-action="open-enterprise" data-id="${item.id}">Open account ${icon("arrow")}</button></div>
    </article>`).join("")}</div>`;
  } else {
    content = `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Request</th><th>Enterprise</th><th>Requested functions</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(item => `<tr><td class="row-main"><strong>${escapeHtml(item.siteName)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.location)}</small></td><td>${escapeHtml(item.enterprise)}</td><td>${escapeHtml(item.functions.join(", "))}</td><td>${escapeHtml(item.submitted)}</td><td>${chip(item.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-site-request" data-id="${item.id}">Review</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
  }

  return `<main class="page">
    ${pageHeader("Tenant operations", "Enterprises", "Create and govern enterprise accounts, approve site onboarding, and issue the first organization administrator invitation.", actions)}
    <div class="filters">${tabs}<div class="spacer"></div>${pageSearch("Search name, account ID, site, or request", "enterprises")}</div>
    ${content || `<div class="empty-state">${icon("enterprise")}<h3>No matching enterprise record</h3><p>Try an exact account or request identifier.</p></div>`}
  </main>`;
}

function fieldView() {
  const tab = activeTabs.field;
  const query = (filters.field || "").toLowerCase();
  const jobs = state.jobs.filter(item => !query || [item.id,item.site,item.enterprise,item.installer,item.status].some(value => String(value).toLowerCase().includes(query)));
  const installers = state.installers.filter(item => !query || [item.id,item.name,item.region,item.status].some(value => String(value).toLowerCase().includes(query)));
  const tabs = `<div class="tabs"><button class="tab ${tab === "jobs" ? "active" : ""}" data-action="set-tab" data-group="field" data-tab="jobs">Installation jobs</button><button class="tab ${tab === "installers" ? "active" : ""}" data-action="set-tab" data-group="field" data-tab="installers">Installers</button></div>`;
  const rows = tab === "jobs" ? `<div class="table-wrap"><table><thead><tr><th>Job</th><th>Enterprise</th><th>Installer</th><th>Progress</th><th>Status</th><th></th></tr></thead><tbody>${jobs.map(job => `<tr><td class="row-main"><strong>${escapeHtml(job.site)}</strong><small>${escapeHtml(job.id)} · ${escapeHtml(job.scheduled)}</small></td><td>${escapeHtml(job.enterprise)}</td><td class="row-main"><strong>${escapeHtml(job.installer)}</strong><small>${escapeHtml(job.installerId)}</small></td><td><div class="progress-wrap"><div class="progress"><span style="width:${job.progress}%"></span></div><small>${job.progress}% complete</small></div></td><td>${chip(job.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-job" data-id="${job.id}">Inspect</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="table-wrap"><table><thead><tr><th>Installer</th><th>Region</th><th>Certification</th><th>Current load</th><th>Status</th><th></th></tr></thead><tbody>${installers.map(installer => `<tr><td class="row-main"><strong>${escapeHtml(installer.name)}</strong><small>${escapeHtml(installer.id)} · ${escapeHtml(installer.phone)}</small></td><td>${escapeHtml(installer.region)}</td><td>${chip(installer.certification)}</td><td>${installer.activeJobs} active · ${escapeHtml(installer.capacity)}</td><td>${chip(installer.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-installer" data-id="${installer.id}">View</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<main class="page">
    ${pageHeader("Field delivery", "Field Operations", "Move approved sites through assignment, commissioning evidence, and final acceptance without bypassing safety controls.", `<button class="btn btn-primary" data-action="new-job">${icon("plus")} Create job</button>`)}
    <div class="filters">${tabs}<div class="spacer"></div>${pageSearch("Search job, site, installer, or exact ID", "field")}</div>
    <section class="panel">${rows}</section>
  </main>`;
}

function devicesView() {
  const query = (filters.devices || "").toLowerCase();
  const statusFilter = filters.status || "All";
  const devices = state.devices.filter(item => {
    const matchesQuery = !query || [item.id,item.serial,item.site,item.enterprise,item.status].some(value => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const live = state.devices.filter(item => item.status === "Live").length;
  const testing = state.devices.filter(item => item.status === "Testing").length;
  const attention = state.devices.filter(item => ["Offline","Identity conflict"].includes(item.status)).length;

  return `<main class="page">
    ${pageHeader("Fleet operations", "Devices", "Inspect gateway identity, firmware, heartbeat, and mapped energy functions. Raw readings remain immutable.", `<button class="btn btn-secondary" data-action="export-devices">${icon("download")} Export inventory</button>`)}
    <section class="metric-strip">
      ${metric("Gateways live", live, "Receiving within the current freshness window")}
      ${metric("Commissioning", testing, "Testing functions before site acceptance", "amber")}
      ${metric("Needs attention", attention, "Offline or duplicate identity", "red")}
      ${metric("Firmware baseline", "4.8.2", "Current approved production release")}
    </section>
    <div class="filters">${pageSearch("Search Rana ID, serial, site, or enterprise", "devices")}<select class="select" data-filter-select="status"><option>All</option>${["Live","Testing","Offline","Identity conflict"].map(value => `<option ${statusFilter === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Gateway</th><th>Assignment</th><th>Energy functions</th><th>Firmware</th><th>Heartbeat</th><th>Status</th><th></th></tr></thead><tbody>${devices.map(device => `<tr><td class="row-main"><strong>${escapeHtml(device.id)}</strong><small>Serial ${escapeHtml(device.serial)}</small></td><td class="row-main"><strong>${escapeHtml(device.site)}</strong><small>${escapeHtml(device.enterprise)}</small></td><td>${device.functions.length} mapped<br><span style="color:var(--muted);font-size:8.5px">${escapeHtml(device.functions.map(fn => fn.name).join(", "))}</span></td><td>${escapeHtml(device.firmware)}</td><td>${escapeHtml(device.heartbeat)}</td><td>${chip(device.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-device" data-id="${device.id}">Inspect</button></div></td></tr>`).join("")}</tbody></table></div>${devices.length ? "" : `<div class="empty-state">${icon("device")}<h3>No device found</h3><p>Use an exact gateway ID or serial to find a specific identity.</p></div>`}</section>
  </main>`;
}

function incidentsView() {
  const query = (filters.incidents || "").toLowerCase();
  const incidents = state.incidents.filter(item => !query || [item.id,item.title,item.enterprise,item.scope,item.owner,item.status].some(value => String(value).toLowerCase().includes(query)));
  const p1 = state.incidents.filter(item => item.severity === "P1" && item.status !== "Resolved").length;
  const unassigned = state.incidents.filter(item => item.owner === "Unassigned" && item.status !== "Resolved").length;
  const resolved = state.incidents.filter(item => item.status === "Resolved").length;
  return `<main class="page">
    ${pageHeader("Operational response", "Incidents", "A single response queue for tenant, installation, gateway, data, access, and platform issues.", `<button class="btn btn-primary" data-action="new-incident">${icon("plus")} Open incident</button>`)}
    <section class="metric-strip">
      ${metric("P1 open", p1, "Immediate operational response", "red")}
      ${metric("Unassigned", unassigned, "Requires a named owner", "amber")}
      ${metric("Under investigation", state.incidents.filter(item => ["Acknowledged","Investigating"].includes(item.status)).length, "Acknowledged and being worked")}
      ${metric("Resolved", resolved, "Retained in immutable history")}
    </section>
    <div class="filters">${pageSearch("Search incident, enterprise, owner, or scope", "incidents")}</div>
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Incident</th><th>Scope</th><th>Owner</th><th>SLA</th><th>Status</th><th></th></tr></thead><tbody>${incidents.map(item => `<tr><td>${severity(item.severity)}</td><td class="row-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.enterprise)}</small></td><td>${escapeHtml(item.scope)}</td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(item.sla)}</td><td>${chip(item.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-incident" data-id="${item.id}">Open</button></div></td></tr>`).join("")}</tbody></table></div></section>
  </main>`;
}

function accessView() {
  const tab = activeTabs.access;
  const query = (filters.access || "").toLowerCase();
  const staff = state.staff.filter(item => !query || [item.id,item.name,item.role,item.scope,item.status].some(value => String(value).toLowerCase().includes(query)));
  const grants = state.supportGrants.filter(item => !query || [item.id,item.staff,item.enterprise,item.reason,item.status].some(value => String(value).toLowerCase().includes(query)));
  const tabs = `<div class="tabs"><button class="tab ${tab === "staff" ? "active" : ""}" data-action="set-tab" data-group="access" data-tab="staff">Rana54 staff</button><button class="tab ${tab === "grants" ? "active" : ""}" data-action="set-tab" data-group="access" data-tab="grants">Support grants</button><button class="tab ${tab === "reviews" ? "active" : ""}" data-action="set-tab" data-group="access" data-tab="reviews">Access review</button></div>`;
  let content;
  if (tab === "staff") {
    content = `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Staff member</th><th>Role</th><th>Scope</th><th>Privilege</th><th>Last access</th><th>Status</th><th></th></tr></thead><tbody>${staff.map(person => `<tr><td class="row-main"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.id)} · ${escapeHtml(person.email)}</small></td><td>${escapeHtml(person.role)}</td><td>${escapeHtml(person.scope)}</td><td>${person.privileged ? chip("Privileged") : chip("Standard")}</td><td>${escapeHtml(person.lastAccess)}</td><td>${chip(person.status)}</td><td><div class="actions-cell"><button class="btn btn-small btn-secondary" data-action="open-staff" data-id="${person.id}">Manage</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
  } else if (tab === "grants") {
    content = `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Grant</th><th>Staff member</th><th>Enterprise</th><th>Mode</th><th>Expiry</th><th>Reason</th><th>Status</th></tr></thead><tbody>${grants.map(grant => `<tr><td class="row-id">${escapeHtml(grant.id)}</td><td>${escapeHtml(grant.staff)}</td><td>${escapeHtml(grant.enterprise)}</td><td>${chip(grant.mode)}</td><td>${escapeHtml(grant.expires)}</td><td>${escapeHtml(grant.reason)}</td><td>${chip(grant.status)}</td></tr>`).join("")}</tbody></table></div></section>`;
  } else {
    const privileged = state.staff.filter(item => item.privileged && item.status === "Active");
    content = `<div class="grid equal">${panel("Privileged access review", "Confirm every cross-tenant operator remains appropriate", `<div class="panel-body"><div class="work-list">${privileged.map(person => `<div class="work-item"><span class="work-icon">${icon("shield")}</span><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)} · ${escapeHtml(person.scope)}</small></span>${chip("Review due")}</div>`).join("")}</div><button class="btn btn-secondary" style="margin-top:15px" data-action="complete-access-review">Complete review</button></div>`)}${panel("Access safety rules", "Applied by the platform, not by UI convention", `<div class="panel-body"><div class="check-list"><div class="check-row">${icon("check")}<div><strong>No staff impersonation</strong><small>Support access opens a read-only tenant context with a visible audit marker.</small></div></div><div class="check-row">${icon("check")}<div><strong>Expiring grants</strong><small>Every tenant support grant has a named reason and automatic expiry.</small></div></div><div class="check-row">${icon("check")}<div><strong>Dual control for super admin changes</strong><small>Privilege escalation cannot be approved by the requester.</small></div></div></div></div>`)}</div>`;
  }

  return `<main class="page">
    ${pageHeader("Identity and access", "Access", "Manage Rana54 staff accounts and explicit, time-limited support access without exposing personal data or secrets.", `<button class="btn btn-secondary" data-action="new-support-grant">${icon("shield")} Grant support access</button><button class="btn btn-primary" data-action="invite-staff">${icon("plus")} Invite staff</button>`)}
    <div class="filters">${tabs}<div class="spacer"></div>${pageSearch("Search person, role, grant, or enterprise", "access")}</div>
    ${content}
  </main>`;
}

function platformView() {
  const tab = activeTabs.platform;
  const tabs = `<div class="tabs"><button class="tab ${tab === "health" ? "active" : ""}" data-action="set-tab" data-group="platform" data-tab="health">Service health</button><button class="tab ${tab === "audit" ? "active" : ""}" data-action="set-tab" data-group="platform" data-tab="audit">Audit history</button></div>`;
  const degraded = state.services.filter(item => item.status !== "Operational").length;
  let content;
  if (tab === "health") {
    content = `<div class="service-grid">${state.services.map(service => `<article class="service-card"><div class="service-card-head"><div><span class="eyebrow">${escapeHtml(service.id)}</span><h3>${escapeHtml(service.name)}</h3></div>${chip(service.status)}</div><p>${escapeHtml(service.detail)}</p><div class="service-metric">${escapeHtml(service.metric)} <small>last 30 days</small></div><button class="btn btn-small btn-secondary" style="margin-top:16px" data-action="run-service-check" data-id="${service.id}">${icon("refresh")} Run safe check</button></article>`).join("")}</div>`;
  } else {
    content = `<section class="panel"><div class="panel-toolbar"><span class="eyebrow">Append only · ${state.audit.length} events</span><span class="spacer"></span><button class="btn btn-small btn-secondary" data-action="export-audit">${icon("download")} Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Outcome</th><th>Reason</th></tr></thead><tbody>${state.audit.map(event => `<tr><td>${escapeHtml(event.time)}</td><td>${escapeHtml(event.actor)}</td><td class="row-main"><strong>${escapeHtml(event.action)}</strong><small>${escapeHtml(event.id)}</small></td><td class="row-id">${escapeHtml(event.entity)}</td><td>${chip(event.outcome)}</td><td>${escapeHtml(event.reason)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  return `<main class="page">
    ${pageHeader("Platform operations", "Platform", "Observe service health, run safe diagnostics, and inspect immutable operational history without exposing credentials.", `<button class="btn btn-secondary" data-action="export-audit">${icon("download")} Export audit</button>`)}
    <section class="metric-strip">
      ${metric("Services operational", `${state.services.length - degraded} of ${state.services.length}`, "Current service health")}
      ${metric("Degraded services", degraded, "Open incident required for persistent degradation", degraded ? "amber" : "")}
      ${metric("Audit events", state.audit.length, "Append only in this prototype")}
      ${metric("Active support grants", state.supportGrants.filter(item => item.status === "Active").length, "Read only and time limited")}
    </section>
    <div class="filters">${tabs}</div>
    ${content}
  </main>`;
}

function showModal(title, description, body, footer = "") {
  currentOverlay = "modal";
  overlay.innerHTML = `<button class="overlay-scrim" data-action="dismiss-overlay" aria-label="Close dialog"></button><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div><button class="icon-button" data-action="dismiss-overlay" aria-label="Close">${icon("close")}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}</section>`;
  requestAnimationFrame(() => overlay.querySelector("input, select, textarea, button")?.focus());
}

function showDrawer(title, body, footer = "") {
  currentOverlay = "drawer";
  overlay.innerHTML = `<button class="overlay-scrim" data-action="dismiss-overlay" aria-label="Close details"></button><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header class="drawer-head"><h2 id="drawer-title">${escapeHtml(title)}</h2><div><button class="icon-button" data-action="dismiss-overlay" aria-label="Close">${icon("close")}</button></div></header><div class="drawer-body">${body}</div>${footer ? `<footer class="drawer-footer">${footer}</footer>` : ""}</aside>`;
}

function dismissOverlay() {
  currentOverlay = null;
  overlay.innerHTML = "";
}

function enterpriseDrawer(id) {
  const item = state.enterprises.find(record => record.id === id);
  if (!item) return;
  const requests = state.siteRequests.filter(request => request.enterpriseId === id);
  const incidents = state.incidents.filter(incident => incident.enterprise === item.name && incident.status !== "Resolved");
  showDrawer(item.name, `<div class="detail-hero"><span class="eyebrow">Enterprise account</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.id)} · ${escapeHtml(item.region)}</p></div>
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(item.status)}</strong></div><div class="detail-cell"><span>Readiness</span><strong>${item.readiness}%</strong></div><div class="detail-cell"><span>Live sites</span><strong>${item.liveSites} of ${item.sites}</strong></div><div class="detail-cell"><span>Last activity</span><strong>${escapeHtml(item.lastActivity)}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Initial organization administrator</h3><button class="link-button" data-action="reissue-admin-invite" data-id="${item.id}">Reissue invite</button></div><div class="function-row"><div><strong>${escapeHtml(item.adminName || "Not assigned")}</strong><small>${escapeHtml(item.adminEmail || "No invitation issued")}</small></div>${chip(item.adminName ? "Invited" : "Missing")}</div></section>
    <section class="detail-section"><div class="detail-section-head"><h3>Enabled products</h3></div><div class="function-list">${item.products.map(product => `<div class="function-row"><div><strong>${escapeHtml(product)}</strong><small>Enabled for this tenant</small></div>${chip("Active")}</div>`).join("")}</div></section>
    <section class="detail-section"><div class="detail-section-head"><h3>Open site requests</h3></div>${requests.length ? `<div class="function-list">${requests.map(request => `<button class="function-row" style="width:100%;text-align:left" data-action="open-site-request" data-id="${request.id}"><div><strong>${escapeHtml(request.siteName)}</strong><small>${escapeHtml(request.id)} · ${escapeHtml(request.location)}</small></div>${chip(request.status)}</button>`).join("")}</div>` : `<div class="empty-state"><h3>No site requests</h3></div>`}</section>
    ${incidents.length ? `<section class="detail-section"><div class="detail-section-head"><h3>Open incidents</h3></div><div class="function-list">${incidents.map(incident => `<button class="function-row" style="width:100%;text-align:left" data-action="open-incident" data-id="${incident.id}"><div><strong>${escapeHtml(incident.title)}</strong><small>${escapeHtml(incident.id)}</small></div>${severity(incident.severity)}</button>`).join("")}</div></section>` : ""}`,
    `<button class="btn btn-secondary" data-action="new-support-grant" data-enterprise="${item.id}">${icon("shield")} Grant read-only support</button><button class="btn ${item.status==="Suspended"?"btn-secondary":"btn-danger"}" data-action="enterprise-transition" data-transition="${item.status==="Suspended"?"Reactivate":"Suspend"}" data-id="${item.id}">${item.status==="Suspended"?"Reactivate account":"Suspend account"}</button><button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`);
}

function siteRequestDrawer(id) {
  const item = state.siteRequests.find(record => record.id === id);
  if (!item) return;
  const footer = item.status === "Pending review" ? `<button class="btn btn-danger" data-action="site-decision" data-decision="Returned" data-id="${item.id}">Return with reason</button><button class="btn btn-primary" data-action="site-decision" data-decision="Approved" data-id="${item.id}">${icon("check")} Approve request</button>` : `<button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`;
  showDrawer(item.siteName, `<div class="detail-hero"><span class="eyebrow">Site request</span><h2>${escapeHtml(item.siteName)}</h2><p>${escapeHtml(item.id)} · ${escapeHtml(item.location)}</p></div>
    <div class="notice">${icon("info")} Approval creates the governed site identity and makes this request eligible for an installation job. It does not link a gateway or create readings.</div>
    <div class="detail-grid"><div class="detail-cell"><span>Enterprise</span><strong>${escapeHtml(item.enterprise)}</strong></div><div class="detail-cell"><span>Status</span><strong>${chip(item.status)}</strong></div><div class="detail-cell"><span>Requested by</span><strong>${escapeHtml(item.requestedBy)}</strong></div><div class="detail-cell"><span>Submitted</span><strong>${escapeHtml(item.submitted)}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Requested energy functions</h3></div><div class="function-list">${item.functions.map(fn => `<div class="function-row"><div><strong>${escapeHtml(fn)}</strong><small>Function requested. Source identity is established during commissioning.</small></div>${chip("Requested")}</div>`).join("")}</div></section>`, footer);
}

function jobDrawer(id) {
  const job = state.jobs.find(record => record.id === id);
  if (!job) return;
  const request = state.siteRequests.find(item => item.id === job.siteRequestId);
  const linked = state.devices.find(item => item.id === job.linkedDevice);
  const approved = request?.status === "Approved";
  const canAccept = job.status === "Ready for acceptance";
  const canLink = approved && !job.linkedDevice && !["Completed"].includes(job.status);
  showDrawer(job.site, `<div class="detail-hero"><span class="eyebrow">Installation job</span><h2>${escapeHtml(job.site)}</h2><p>${escapeHtml(job.id)} · ${escapeHtml(job.enterprise)}</p></div>
    ${job.blockers.length ? `<div class="notice danger">${icon("incident")} ${escapeHtml(job.blockers.join(" "))}</div>` : `<div class="notice">${icon("shield")} Gateway linking is available only inside an approved installation or replacement job.</div>`}
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(job.status)}</strong></div><div class="detail-cell"><span>Installer</span><strong>${escapeHtml(job.installer)}</strong></div><div class="detail-cell"><span>Schedule</span><strong>${escapeHtml(job.scheduled)}</strong></div><div class="detail-cell"><span>Site request</span><strong>${escapeHtml(job.siteRequestId)} · ${escapeHtml(request?.status || "Not found")}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Completion evidence</h3><span>${job.progress}%</span></div><div class="progress"><span style="width:${job.progress}%"></span></div><div class="timeline" style="margin-top:18px">${job.checklist.map(step => `<div class="timeline-item"><strong>${escapeHtml(step)}</strong><small>Recorded against ${escapeHtml(job.id)}</small></div>`).join("")}</div></section>
    <section class="detail-section"><div class="detail-section-head"><h3>Linked gateway</h3>${canLink ? `<button class="link-button" data-action="link-device" data-id="${job.id}">Link gateway</button>` : ""}</div>${linked ? `<button class="function-row" style="width:100%;text-align:left" data-action="open-device" data-id="${linked.id}"><div><strong>${escapeHtml(linked.id)}</strong><small>${escapeHtml(linked.serial)} · ${linked.functions.length} mapped functions</small></div>${chip(linked.status)}</button>` : `<div class="function-row"><div><strong>No gateway linked</strong><small>${approved ? "This approved job is eligible for gateway linking." : "Approve the site request before linking a device."}</small></div>${chip(approved ? "Available" : "Blocked")}</div>`}</section>`,
    `${job.status !== "Completed" ? `<button class="btn btn-secondary" data-action="reassign-job" data-id="${job.id}">Reassign installer</button>` : ""}${canAccept ? `<button class="btn btn-primary" data-action="accept-installation" data-id="${job.id}">${icon("check")} Accept installation</button>` : `<button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`}`);
}

function installerDrawer(id) {
  const installer = state.installers.find(record => record.id === id);
  if (!installer) return;
  const jobs = state.jobs.filter(job => job.installerId === id);
  const activeJobs = jobs.filter(job => job.status !== "Completed");
  showDrawer(installer.name, `<div class="detail-hero"><span class="eyebrow">Installer profile</span><h2>${escapeHtml(installer.name)}</h2><p>${escapeHtml(installer.id)} · ${escapeHtml(installer.region)}</p></div>
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(installer.status)}</strong></div><div class="detail-cell"><span>Certification</span><strong>${escapeHtml(installer.certification)}</strong></div><div class="detail-cell"><span>Capacity</span><strong>${escapeHtml(installer.capacity)}</strong></div><div class="detail-cell"><span>Contact</span><strong>${escapeHtml(installer.phone)}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Assigned jobs</h3></div><div class="function-list">${jobs.map(job => `<button class="function-row" style="width:100%;text-align:left" data-action="open-job" data-id="${job.id}"><div><strong>${escapeHtml(job.site)}</strong><small>${escapeHtml(job.id)}</small></div>${chip(job.status)}</button>`).join("")}</div></section>${activeJobs.length&&installer.status!=="Suspended"?`<div class="notice warning">${icon("info")} Reassign ${activeJobs.length} active job${activeJobs.length===1?"":"s"} before suspending this installer.</div>`:""}`, `${installer.status === "Suspended" ? `<button class="btn btn-secondary" data-action="installer-transition" data-transition="Restore" data-id="${installer.id}">Restore installer</button>` : `<button class="btn btn-danger" data-action="installer-transition" data-transition="Suspend" data-id="${installer.id}" ${activeJobs.length?"disabled":""}>Suspend installer</button>`}<button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`);
}

function deviceDrawer(id) {
  const device = state.devices.find(record => record.id === id);
  if (!device) return;
  const job = state.jobs.find(item => item.id === device.jobId);
  showDrawer(device.id, `<div class="detail-hero"><span class="eyebrow">Gateway identity</span><h2>${escapeHtml(device.id)}</h2><p>Serial ${escapeHtml(device.serial)} · ${escapeHtml(device.site)}</p></div>
    <div class="notice">${icon("lock")} Diagnostics are read only. Raw readings cannot be edited here, and credentials remain masked.</div>
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(device.status)}</strong></div><div class="detail-cell"><span>Heartbeat</span><strong>${escapeHtml(device.heartbeat)}</strong></div><div class="detail-cell"><span>Firmware</span><strong>${escapeHtml(device.firmware)}</strong></div><div class="detail-cell"><span>Source job</span><strong>${escapeHtml(device.jobId)}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Mapped energy functions</h3><span class="eyebrow">Not meter count</span></div><div class="function-list">${device.functions.map(fn => `<div class="function-row"><div><strong>${escapeHtml(fn.name)}</strong><small>Source ${escapeHtml(fn.source)}</small></div>${chip(fn.state)}</div>`).join("")}</div></section>
    <section class="detail-section"><div class="detail-section-head"><h3>Last diagnostic</h3></div><div class="function-row"><div><strong>${escapeHtml(device.lastDiagnostic)}</strong><small>Diagnostic output is recorded, not editable.</small></div>${icon("terminal")}</div></section>
    ${job ? `<section class="detail-section"><button class="btn btn-secondary" data-action="open-job" data-id="${job.id}">Open source job ${icon("arrow")}</button></section>` : ""}`,
    `<button class="btn btn-secondary" data-action="run-device-diagnostic" data-id="${device.id}">${icon("refresh")} Run safe diagnostic</button><button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`);
}

function incidentDrawer(id) {
  const incident = state.incidents.find(record => record.id === id);
  if (!incident) return;
  const linkedDevice = incident.deviceId ? state.devices.find(device => device.id === incident.deviceId) : null;
  const nextAction = incident.status === "Resolved" ? `<button class="btn btn-danger" data-action="incident-transition" data-transition="Reopen" data-id="${incident.id}">Reopen</button>` : `<button class="btn btn-secondary" data-action="incident-transition" data-transition="Assign" data-id="${incident.id}">Assign owner</button>${incident.status === "Open" ? `<button class="btn btn-secondary" data-action="incident-transition" data-transition="Acknowledge" data-id="${incident.id}">Acknowledge</button>` : ""}<button class="btn btn-primary" data-action="incident-transition" data-transition="Resolve" data-id="${incident.id}">${icon("check")} Resolve</button>`;
  showDrawer(incident.id, `<div class="detail-hero"><span class="eyebrow">${escapeHtml(incident.severity)} incident</span><h2>${escapeHtml(incident.title)}</h2><p>${escapeHtml(incident.enterprise)} · Open for ${escapeHtml(incident.age)}</p></div>
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(incident.status)}</strong></div><div class="detail-cell"><span>Severity</span><strong>${severity(incident.severity)}</strong></div><div class="detail-cell"><span>Owner</span><strong>${escapeHtml(incident.owner)}</strong></div><div class="detail-cell"><span>SLA</span><strong>${escapeHtml(incident.sla)}</strong></div></div>
    ${linkedDevice ? `<section class="detail-section"><div class="detail-section-head"><h3>Linked device</h3></div><button class="function-row" style="width:100%;text-align:left" data-action="open-device" data-id="${linkedDevice.id}"><div><strong>${escapeHtml(linkedDevice.id)}</strong><small>${escapeHtml(linkedDevice.site)} · ${escapeHtml(linkedDevice.status)}</small></div>${icon("arrow")}</button></section>` : ""}
    <section class="detail-section"><div class="detail-section-head"><h3>Operational notes</h3></div><div class="timeline">${incident.notes.map((note, index) => `<div class="timeline-item"><strong>${escapeHtml(note)}</strong><small>${index === 0 ? "Initial evidence" : "Platform operations update"}</small></div>`).join("")}</div></section>`, nextAction);
}

function staffDrawer(id) {
  const person = state.staff.find(record => record.id === id);
  if (!person) return;
  const grants = state.supportGrants.filter(grant => grant.staff === person.name);
  const isFinalPlatformOperator = person.role === "Platform Operator" && person.status === "Active" && state.staff.filter(item => item.role === "Platform Operator" && item.status === "Active").length === 1;
  showDrawer(person.name, `<div class="detail-hero"><span class="eyebrow">Rana54 staff access</span><h2>${escapeHtml(person.name)}</h2><p>${escapeHtml(person.id)} · ${escapeHtml(person.email)}</p></div>
    <div class="notice">${icon("shield")} Role permissions and tenant support grants are separate. This screen never reveals credentials or full personal data.</div>
    <div class="detail-grid"><div class="detail-cell"><span>Status</span><strong>${chip(person.status)}</strong></div><div class="detail-cell"><span>Role</span><strong>${escapeHtml(person.role)}</strong></div><div class="detail-cell"><span>Scope</span><strong>${escapeHtml(person.scope)}</strong></div><div class="detail-cell"><span>Last access</span><strong>${escapeHtml(person.lastAccess)}</strong></div></div>
    <section class="detail-section"><div class="detail-section-head"><h3>Tenant support grants</h3></div>${grants.length ? `<div class="function-list">${grants.map(grant => `<div class="function-row"><div><strong>${escapeHtml(grant.enterprise)}</strong><small>${escapeHtml(grant.mode)} · expires ${escapeHtml(grant.expires)}</small></div>${chip(grant.status)}</div>`).join("")}</div>` : `<div class="function-row"><div><strong>No tenant support access</strong><small>Create a time-limited grant only when support work requires it.</small></div>${chip("None")}</div>`}</section>${isFinalPlatformOperator?`<div class="notice warning">${icon("shield")} Invite and activate another Platform Operator before suspending this final platform-wide operator.</div>`:""}`,
    `${person.status === "Active" ? `<button class="btn btn-danger" data-action="staff-transition" data-transition="Suspend" data-id="${person.id}" ${isFinalPlatformOperator?"disabled":""}>Suspend access</button>` : `<button class="btn btn-secondary" data-action="staff-transition" data-transition="Restore" data-id="${person.id}">Restore access</button>`}<button class="btn btn-primary" data-action="dismiss-overlay">Done</button>`);
}

function notificationsDrawer() {
  const items = state.incidents.filter(item => item.status === "Open").slice(0, 5);
  showDrawer("Notifications", `<div class="notice">${icon("info")} Notifications point to governed records. Operational decisions are completed inside the record itself.</div><div class="attention-list">${items.map(item => `<button class="attention-item" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left" data-action="open-incident" data-id="${item.id}"><span class="severity-bar ${item.severity.toLowerCase()}"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.enterprise)} · ${escapeHtml(item.sla)}</p></div>${severity(item.severity)}</button>`).join("")}</div>`, `<button class="btn btn-primary" data-action="go-incidents">Open incident queue</button>`);
}

function newEnterpriseModal() {
  showModal("Create enterprise", "Create the tenant and issue its first organization administrator invitation.", `<form id="enterprise-form" class="form-grid">
    <div class="field full"><label>Legal or trading name</label><input name="name" required maxlength="90" placeholder="Enterprise name" /></div>
    <div class="field"><label>Country or region</label><select name="region" required><option value="">Select region</option><option>Nigeria</option><option>Ghana</option><option>Kenya</option><option>South Africa</option><option>Other</option></select></div>
    <div class="field"><label>Account state</label><select name="status"><option>Onboarding</option><option>Active</option></select></div>
    <div class="field"><label>First admin name</label><input name="adminName" required placeholder="Full name" /></div>
    <div class="field"><label>First admin email</label><input name="adminEmail" required type="email" placeholder="name@company.com" /><small>The stored presentation is masked after invitation.</small></div>
    <div class="field full"><label>Enabled products</label><div class="check-list"><label class="check-row"><input type="checkbox" name="product" value="Energy workspace" checked /><span><strong>Energy workspace</strong><small>Sites, functions, data quality, and reporting workspace.</small></span></label><label class="check-row"><input type="checkbox" name="product" value="dMRV reports" /><span><strong>dMRV reports</strong><small>Governed evidence and report workflows.</small></span></label></div></div>
  </form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="enterprise-form">${icon("plus")} Create and invite</button>`);
}

function siteDecisionModal(id, decision) {
  const request = state.siteRequests.find(item => item.id === id);
  if (!request) return;
  const isReturn = decision === "Returned";
  showModal(`${decision} site request`, `${request.siteName} · ${request.id}`, `<form id="site-decision-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><input type="hidden" name="decision" value="${escapeHtml(decision)}" /><div class="notice ${isReturn ? "warning" : ""}">${icon(isReturn ? "incident" : "shield")} ${isReturn ? "Returning the request keeps its history and gives the enterprise a clear correction path." : "Approval creates a governed site identity. Gateway linking still requires an approved installation job."}</div><div class="field full"><label>Decision reason</label><textarea name="reason" required minlength="8" placeholder="Record why this decision is appropriate"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn ${isReturn ? "btn-danger" : "btn-primary"}" data-action="submit-form" data-form="site-decision-form">Confirm ${decision.toLowerCase()}</button>`);
}

function newJobModal() {
  const approved = state.siteRequests.filter(item => item.status === "Approved" && !state.jobs.some(job => job.siteRequestId === item.id && job.status !== "Completed"));
  showModal("Create installation job", "Jobs can only begin from an approved site request.", approved.length ? `<form id="job-form" class="form-grid"><div class="field full"><label>Approved site request</label><select name="requestId" required><option value="">Select approved request</option>${approved.map(item => `<option value="${item.id}">${escapeHtml(item.siteName)} · ${escapeHtml(item.id)}</option>`).join("")}</select></div><div class="field full"><label>Assign installer</label><select name="installerId" required><option value="">Select installer</option>${state.installers.filter(item => item.status !== "Suspended").map(item => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.region)} · ${escapeHtml(item.capacity)}</option>`).join("")}</select></div><div class="field"><label>Scheduled date</label><input type="date" name="date" required /></div><div class="field"><label>Scheduled time</label><input type="time" name="time" required /></div><div class="field full"><label>Operations note</label><textarea name="note" required minlength="8" placeholder="Site access, owner contact, or delivery constraints"></textarea></div></form>` : `<div class="empty-state">${icon("field")}<h3>No approved site is available</h3><p>Approve a pending site request or finish the active job before creating another one.</p></div>`, approved.length ? `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="job-form">Create and assign</button>` : `<button class="btn btn-primary" data-action="go-enterprise-requests">Review site requests</button>`);
}

function inviteStaffModal() {
  showModal("Invite Rana54 staff", "Invite a staff member with explicit role and operating scope.", `<form id="staff-form" class="form-grid"><div class="field"><label>Full name</label><input name="name" required /></div><div class="field"><label>Work email</label><input name="email" type="email" required /></div><div class="field"><label>Role</label><select name="role" required><option>Support Analyst</option><option>Field Operations</option><option>Data Operations</option><option>Platform Operator</option></select></div><div class="field"><label>Scope</label><select name="scope" required><option>Assigned tenants</option><option>Nigeria</option><option>West Africa</option><option>All tenants</option></select></div><div class="field full"><label>Access reason</label><textarea name="reason" required minlength="8" placeholder="Why this staff access is required"></textarea></div><div class="notice full">${icon("shield")} Privileged cross-tenant access is reviewed separately and cannot be self-approved.</div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="staff-form">Send invitation</button>`);
}

function supportGrantModal(enterpriseId = "") {
  showModal("Grant tenant support access", "Create a read-only, time-limited, audited support session.", `<form id="support-form" class="form-grid"><div class="field"><label>Staff member</label><select name="staffId" required><option value="">Select staff</option>${state.staff.filter(item => item.status === "Active").map(item => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.role)}</option>`).join("")}</select></div><div class="field"><label>Enterprise</label><select name="enterpriseId" required><option value="">Select enterprise</option>${state.enterprises.map(item => `<option value="${item.id}" ${item.id === enterpriseId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label>Duration</label><select name="duration" required><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24">24 hours</option></select></div><div class="field"><label>Mode</label><input value="Read only" disabled /></div><div class="field full"><label>Support reason</label><textarea name="reason" required minlength="8" placeholder="Specific issue this access will support"></textarea></div><div class="notice full">${icon("lock")} This does not impersonate the enterprise user. Personal data stays masked and every view is audited.</div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="support-form">Grant temporary access</button>`);
}

function newIncidentModal() {
  showModal("Open incident", "Create a governed operational record and assign initial severity.", `<form id="incident-form" class="form-grid"><div class="field full"><label>Title</label><input name="title" required maxlength="120" /></div><div class="field"><label>Severity</label><select name="severity"><option>P1</option><option selected>P2</option><option>P3</option></select></div><div class="field"><label>Scope</label><select name="scope"><option>Platform</option><option>Tenant</option><option>Installation</option><option>Device and data</option><option>Access</option><option>Field operations</option></select></div><div class="field"><label>Enterprise</label><select name="enterprise"><option>Multiple tenants</option>${state.enterprises.map(item => `<option>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label>Initial owner</label><select name="owner"><option>Unassigned</option><option>Platform operations</option><option>Device operations</option><option>Field operations</option></select></div><div class="field full"><label>Initial evidence</label><textarea name="note" required minlength="8"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="incident-form">Open incident</button>`);
}

function transitionIncidentModal(id, transition) {
  const incident = state.incidents.find(item => item.id === id);
  if (!incident) return;
  const showOwner = transition === "Assign";
  showModal(`${transition} incident`, `${incident.id} · ${incident.title}`, `<form id="incident-transition-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><input type="hidden" name="transition" value="${escapeHtml(transition)}" />${showOwner ? `<div class="field full"><label>Assign to</label><select name="owner" required><option value="">Select owner</option><option>Platform operations</option><option>Device operations</option><option>Field operations</option><option>Data operations</option></select></div>` : ""}<div class="field full"><label>${transition === "Resolve" ? "Resolution" : "Reason"}</label><textarea name="reason" required minlength="8" placeholder="Record the evidence and reason for this change"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="incident-transition-form">Confirm ${transition.toLowerCase()}</button>`);
}

function staffTransitionModal(id, transition) {
  const person = state.staff.find(item => item.id === id);
  if (!person) return;
  showModal(`${transition} staff access`, `${person.name} · ${person.id}`, `<form id="staff-transition-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><input type="hidden" name="transition" value="${escapeHtml(transition)}" /><div class="notice ${transition === "Suspend" ? "danger" : ""}">${icon("shield")} History and assignments are retained. This action does not delete the staff identity.</div><div class="field full"><label>Reason</label><textarea name="reason" required minlength="8"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn ${transition === "Suspend" ? "btn-danger" : "btn-primary"}" data-action="submit-form" data-form="staff-transition-form">Confirm ${transition.toLowerCase()}</button>`);
}

function enterpriseTransitionModal(id, transition) {
  const enterprise = state.enterprises.find(item => item.id === id);
  if (!enterprise) return;
  showModal(`${transition} enterprise account`, `${enterprise.name} · ${enterprise.id}`, `<form id="enterprise-transition-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><input type="hidden" name="transition" value="${escapeHtml(transition)}" /><div class="notice ${transition === "Suspend" ? "danger" : ""}">${icon("shield")} The account, identifiers, evidence and audit history remain intact. ${transition === "Suspend" ? "New tenant activity and support grants will be blocked until reactivation." : "Normal tenant activity can resume after this audited action."}</div><div class="field full"><label>Reason</label><textarea name="reason" required minlength="8" placeholder="Record the operational or governance reason"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn ${transition === "Suspend" ? "btn-danger" : "btn-primary"}" data-action="submit-form" data-form="enterprise-transition-form">Confirm ${transition.toLowerCase()}</button>`);
}

function installerTransitionModal(id, transition) {
  const installer = state.installers.find(item => item.id === id);
  if (!installer) return;
  showModal(`${transition} installer`, `${installer.name} · ${installer.id}`, `<form id="installer-transition-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><input type="hidden" name="transition" value="${escapeHtml(transition)}" /><div class="notice ${transition === "Suspend" ? "danger" : ""}">${icon("shield")} The installer identity and completed job history will be retained. Active jobs must be reassigned separately.</div><div class="field full"><label>Reason</label><textarea name="reason" required minlength="8"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn ${transition === "Suspend" ? "btn-danger" : "btn-primary"}" data-action="submit-form" data-form="installer-transition-form">Confirm ${transition.toLowerCase()}</button>`);
}

function reassignJobModal(id) {
  const job = state.jobs.find(item => item.id === id);
  if (!job) return;
  showModal("Reassign installation job", `${job.site} · ${job.id}`, `<form id="reassign-job-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><div class="field full"><label>Installer</label><select name="installerId" required>${state.installers.filter(item => item.status !== "Suspended").map(item => `<option value="${item.id}" ${item.id === job.installerId ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.region)} · ${escapeHtml(item.capacity)}</option>`).join("")}</select></div><div class="field full"><label>Reassignment reason</label><textarea name="reason" required minlength="8"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="reassign-job-form">Reassign job</button>`);
}

function linkDeviceModal(id) {
  const job = state.jobs.find(item => item.id === id);
  const request = job ? state.siteRequests.find(item => item.id === job.siteRequestId) : null;
  if (!job || request?.status !== "Approved") {
    toast("Gateway link blocked", "A gateway can only be linked inside an approved installation or replacement job.");
    return;
  }
  showModal("Link gateway", `${job.site} · ${job.id}`, `<form id="link-device-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><div class="notice">${icon("shield")} The exact serial is checked against existing identities. Link history is retained and cannot be silently overwritten.</div><div class="field full"><label>Gateway serial</label><input name="serial" required minlength="8" placeholder="R54G-00A0-0000" /></div><div class="field full"><label>Commissioning note</label><textarea name="reason" required minlength="8" placeholder="Confirm the physical identity and evidence source"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="link-device-form">Check and link</button>`);
}

function acceptInstallationModal(id) {
  const job = state.jobs.find(item => item.id === id);
  if (!job) return;
  showModal("Accept installation", `${job.site} · ${job.id}`, `<form id="accept-installation-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><div class="notice">${icon("shield")} Acceptance confirms identity, mapped functions, commissioning evidence, and delivery testing. It does not certify future readings.</div><div class="field full"><label>Acceptance note</label><textarea name="reason" required minlength="8" placeholder="Summarize the evidence reviewed"></textarea></div><div class="field full"><label class="check-row"><input type="checkbox" name="confirmed" required /><span><strong>I reviewed the linked gateway and energy functions</strong><small>The accepted record becomes append-only operational history.</small></span></label></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="accept-installation-form">Accept installation</button>`);
}

function bindGlobalSearch() {
  const input = document.getElementById("global-search");
  const resultsHost = document.getElementById("search-results");
  if (!input || !resultsHost) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      resultsHost.innerHTML = "";
      return;
    }
    const records = [
      ...state.enterprises.map(item => ({ type: "Enterprise", id: item.id, label: item.name, meta: item.region, action: "open-enterprise" })),
      ...state.siteRequests.map(item => ({ type: "Site request", id: item.id, label: item.siteName, meta: item.enterprise, action: "open-site-request" })),
      ...state.jobs.map(item => ({ type: "Installation job", id: item.id, label: item.site, meta: item.installer, action: "open-job" })),
      ...state.devices.map(item => ({ type: "Gateway", id: item.id, label: item.site, meta: `Serial ${item.serial}`, action: "open-device", aliases: [item.serial] })),
      ...state.incidents.map(item => ({ type: "Incident", id: item.id, label: item.title, meta: item.enterprise, action: "open-incident" })),
      ...state.installers.map(item => ({ type: "Installer", id: item.id, label: item.name, meta: item.region, action: "open-installer" })),
      ...state.staff.map(item => ({ type: "Staff", id: item.id, label: item.name, meta: item.role, action: "open-staff" }))
    ];
    const matches = records.filter(record => [record.id, record.label, record.meta, ...(record.aliases || [])].some(value => String(value).toLowerCase().includes(query))).slice(0, 7);
    resultsHost.innerHTML = `<div class="search-results">${matches.length ? matches.map(record => `<button class="search-result" data-action="${record.action}" data-id="${record.id}"><span class="search-result-icon">${icon(record.type === "Gateway" ? "device" : record.type === "Incident" ? "incident" : record.type === "Installation job" || record.type === "Installer" ? "field" : record.type === "Staff" ? "access" : "enterprise")}</span><span><strong>${escapeHtml(record.label)}</strong><small>${escapeHtml(record.type)} · ${escapeHtml(record.meta)}</small></span><code>${escapeHtml(record.id)}</code></button>`).join("") : `<div class="search-empty">No record matches this exact identifier or name.</div>`}</div>`;
  });
}

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!domain) return "Masked";
  return `${name.slice(0,1)}••••@${domain}`;
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function validateAndSubmit(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  if (!form.reportValidity()) return;
  const data = formDataObject(form);
  const handlers = {
    "enterprise-form": submitEnterprise,
    "site-decision-form": submitSiteDecision,
    "job-form": submitJob,
    "staff-form": submitStaff,
    "support-form": submitSupportGrant,
    "incident-form": submitIncident,
    "incident-transition-form": submitIncidentTransition,
    "enterprise-transition-form": submitEnterpriseTransition,
    "staff-transition-form": submitStaffTransition,
    "installer-transition-form": submitInstallerTransition,
    "reassign-job-form": submitJobReassignment,
    "link-device-form": submitDeviceLink,
    "accept-installation-form": submitInstallationAcceptance
  };
  handlers[formId]?.(data, form);
}

function submitEnterprise(data, form) {
  const suffix = String(Date.now()).slice(-4);
  const id = `ENT-NEW-${suffix}`;
  const products = new FormData(form).getAll("product");
  const item = {
    id,
    name: data.name.trim(),
    region: data.region,
    status: data.status,
    readiness: data.status === "Active" ? 35 : 18,
    adminName: data.adminName.trim(),
    adminEmail: maskEmail(data.adminEmail.trim()),
    products: products.length ? products : ["Energy workspace"],
    sites: 0,
    liveSites: 0,
    lastActivity: "Just now"
  };
  state.enterprises.unshift(item);
  addAudit("Enterprise account created", id, "Created", `Initial administrator invitation issued to ${maskEmail(data.adminEmail.trim())}`);
  saveState();
  dismissOverlay();
  render();
  toast("Enterprise created", `${item.name} is ready for onboarding and the first administrator invitation was issued.`);
  setTimeout(() => enterpriseDrawer(id), 80);
}

function submitSiteDecision(data) {
  const request = state.siteRequests.find(item => item.id === data.id);
  if (!request) return;
  request.status = data.decision;
  const related = state.jobs.filter(job => job.siteRequestId === data.id && job.status === "Awaiting site approval");
  related.forEach(job => {
    if (data.decision === "Approved") {
      job.status = "Scheduled";
      job.progress = Math.max(job.progress, 18);
      job.blockers = [];
    } else {
      job.status = "Blocked";
      job.blockers = [`Site request returned: ${data.reason.trim()}`];
    }
  });
  const enterprise = state.enterprises.find(item => item.id === request.enterpriseId);
  if (data.decision === "Approved" && enterprise) {
    enterprise.sites += 1;
    enterprise.readiness = Math.min(100, enterprise.readiness + 5);
  }
  addAudit(`Site request ${data.decision.toLowerCase()}`, data.id, data.decision, data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast(`Site request ${data.decision.toLowerCase()}`, data.decision === "Approved" ? "The governed site identity is available for field operations." : "The request remains in history with a clear correction reason.");
}

function submitJob(data) {
  const request = state.siteRequests.find(item => item.id === data.requestId);
  const installer = state.installers.find(item => item.id === data.installerId);
  if (!request || request.status !== "Approved" || !installer) {
    toast("Job could not be created", "Select an approved site request and an active installer.");
    return;
  }
  const id = `JOB-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2,"0")}-${String(Date.now()).slice(-4)}`;
  const scheduled = `${data.date} ${data.time}`;
  state.jobs.unshift({ id, enterpriseId: request.enterpriseId, enterprise: request.enterprise, siteRequestId: request.id, site: request.siteName, installerId: installer.id, installer: installer.name, status: "Scheduled", scheduled, progress: 8, blockers: [], checklist: ["Approved site request received", `Operations note: ${data.note.trim()}`], linkedDevice: null });
  installer.activeJobs += 1;
  addAudit("Installation job created", id, "Scheduled", `Assigned to ${installer.name}. ${data.note.trim()}`);
  saveState();
  dismissOverlay();
  render();
  toast("Installation job created", `${id} was assigned to ${installer.name}.`);
  setTimeout(() => jobDrawer(id), 80);
}

function submitStaff(data) {
  const id = `STF-${data.role.slice(0,3).toUpperCase()}-${String(Date.now()).slice(-3)}`;
  const privileged = ["Platform Operator", "Data Operations"].includes(data.role) && data.scope === "All tenants";
  state.staff.unshift({ id, name: data.name.trim(), email: maskEmail(data.email.trim()), role: data.role, scope: data.scope, status: "Invited", lastAccess: "Never", privileged });
  addAudit("Rana54 staff invited", id, "Invitation issued", data.reason.trim());
  saveState();
  dismissOverlay();
  activeTabs.access = "staff";
  render();
  toast("Staff invitation sent", privileged ? "The account was invited. Privileged access still requires a separate access review." : "The role and scope were recorded with the invitation.");
}

function submitSupportGrant(data) {
  const staff = state.staff.find(item => item.id === data.staffId);
  const enterprise = state.enterprises.find(item => item.id === data.enterpriseId);
  if (!staff || !enterprise) return;
  const expiry = new Date(Date.now() + Number(data.duration) * 3600000);
  const expires = expiry.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const id = `GRANT-${String(Date.now()).slice(-4)}`;
  state.supportGrants.unshift({ id, staff: staff.name, enterprise: enterprise.name, mode: "Read only", expires, reason: data.reason.trim(), status: "Active" });
  addAudit("Tenant support access granted", id, "Read-only grant active", `${data.duration} hours. ${data.reason.trim()}`);
  saveState();
  dismissOverlay();
  activeTabs.access = "grants";
  render();
  toast("Temporary support access granted", `${staff.name} has read-only access to ${enterprise.name} until ${expires}.`);
}

function submitIncident(data) {
  const id = `INC-${data.severity}-${String(Date.now()).slice(-4)}`;
  state.incidents.unshift({ id, title: data.title.trim(), scope: data.scope, enterprise: data.enterprise, severity: data.severity, status: "Open", owner: data.owner, age: "Just now", sla: data.severity === "P1" ? "30 min remaining" : data.severity === "P2" ? "6 hr remaining" : "3 days remaining", deviceId: null, notes: [data.note.trim()] });
  addAudit("Incident opened", id, "Open", data.note.trim());
  saveState();
  dismissOverlay();
  render();
  toast("Incident opened", `${id} is now in the operational response queue.`);
  setTimeout(() => incidentDrawer(id), 80);
}

function submitIncidentTransition(data) {
  const incident = state.incidents.find(item => item.id === data.id);
  if (!incident) return;
  if (data.transition === "Assign") {
    incident.owner = data.owner;
    if (incident.status === "Open") incident.status = "Acknowledged";
  } else if (data.transition === "Acknowledge") {
    incident.status = "Acknowledged";
    if (incident.owner === "Unassigned") incident.owner = "Platform operations";
  } else if (data.transition === "Resolve") {
    incident.status = "Resolved";
    incident.sla = "Met";
  } else if (data.transition === "Reopen") {
    incident.status = "Open";
    incident.sla = incident.severity === "P1" ? "30 min remaining" : "6 hr remaining";
  }
  incident.notes.unshift(`${data.transition}: ${data.reason.trim()}`);
  addAudit(`Incident ${data.transition.toLowerCase()}`, incident.id, incident.status, data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast(`Incident ${data.transition.toLowerCase()}`, `${incident.id} is now ${incident.status.toLowerCase()}.`);
  setTimeout(() => incidentDrawer(incident.id), 80);
}

function submitEnterpriseTransition(data) {
  const enterprise = state.enterprises.find(item => item.id === data.id);
  if (!enterprise) return;
  enterprise.status = data.transition === "Suspend" ? "Suspended" : "Active";
  enterprise.lastActivity = "Just now";
  if (enterprise.status === "Suspended") {
    state.supportGrants.filter(grant => grant.enterprise === enterprise.name && grant.status === "Active").forEach(grant => grant.status = "Revoked");
  }
  addAudit(`Enterprise account ${data.transition.toLowerCase()}d`, enterprise.id, enterprise.status, data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast(`Enterprise account ${data.transition.toLowerCase()}d`, "The tenant identity, evidence and audit history were retained.");
}

function submitStaffTransition(data) {
  const person = state.staff.find(item => item.id === data.id);
  if (!person) return;
  const finalPlatformOperator = data.transition === "Suspend" && person.role === "Platform Operator" && person.status === "Active" && state.staff.filter(item => item.role === "Platform Operator" && item.status === "Active").length === 1;
  if (finalPlatformOperator) { dismissOverlay(); toast("Suspension blocked", "Activate another Platform Operator before suspending this final platform-wide operator."); return; }
  person.status = data.transition === "Suspend" ? "Suspended" : "Active";
  if (person.status === "Suspended") {
    state.supportGrants.filter(grant => grant.staff === person.name && grant.status === "Active").forEach(grant => grant.status = "Revoked");
  }
  addAudit(`Staff access ${data.transition.toLowerCase()}d`, person.id, person.status, data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast(`Staff access ${data.transition.toLowerCase()}d`, "Identity history and prior assignments were retained.");
}

function submitInstallerTransition(data) {
  const installer = state.installers.find(item => item.id === data.id);
  if (!installer) return;
  const activeJobs = state.jobs.filter(job => job.installerId === installer.id && job.status !== "Completed");
  if (data.transition === "Suspend" && activeJobs.length) { dismissOverlay(); toast("Suspension blocked", `Reassign ${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"} before suspending ${installer.name}.`); return; }
  installer.status = data.transition === "Suspend" ? "Suspended" : "Available";
  addAudit(`Installer ${data.transition.toLowerCase()}d`, installer.id, installer.status, data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast(`Installer ${data.transition.toLowerCase()}d`, "The installer identity and prior job history were retained.");
}

function submitJobReassignment(data) {
  const job = state.jobs.find(item => item.id === data.id);
  const next = state.installers.find(item => item.id === data.installerId);
  if (!job || !next) return;
  const previous = state.installers.find(item => item.id === job.installerId);
  if (previous && previous.id !== next.id) previous.activeJobs = Math.max(0, previous.activeJobs - 1);
  if (job.installerId !== next.id) next.activeJobs += 1;
  job.installerId = next.id;
  job.installer = next.name;
  addAudit("Installation job reassigned", job.id, "Assigned", data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast("Job reassigned", `${job.id} is now assigned to ${next.name}.`);
  setTimeout(() => jobDrawer(job.id), 80);
}

function submitDeviceLink(data) {
  const job = state.jobs.find(item => item.id === data.id);
  const request = job ? state.siteRequests.find(item => item.id === job.siteRequestId) : null;
  if (!job || request?.status !== "Approved") {
    dismissOverlay();
    toast("Gateway link blocked", "The source site request is not approved.");
    return;
  }
  const normalized = data.serial.trim().toUpperCase();
  const duplicate = state.devices.find(item => item.serial.toUpperCase() === normalized);
  if (duplicate) {
    job.status = "Blocked";
    job.blockers = [`Gateway serial already belongs to ${duplicate.id}`];
    const incidentId = `INC-P2-${String(Date.now()).slice(-4)}`;
    state.incidents.unshift({ id: incidentId, title: "Duplicate gateway identity blocks installation", scope: "Installation", enterprise: job.enterprise, severity: "P2", status: "Open", owner: "Device operations", age: "Just now", sla: "6 hr remaining", deviceId: duplicate.id, notes: [`Serial ${normalized} is already assigned to ${duplicate.site}.`] });
    addAudit("Gateway link blocked", job.id, "Identity conflict", `${normalized}. ${data.reason.trim()}`);
    saveState();
    dismissOverlay();
    render();
    toast("Duplicate identity detected", `No link was created. Incident ${incidentId} is now open.`);
    return;
  }
  const suffix = normalized.replace(/[^A-Z0-9]/g, "").slice(-4);
  const gatewayId = `GW-R54-NEW-${suffix}`;
  const functions = request.functions.map(name => ({ name, source: "Awaiting test", state: "Testing" }));
  state.devices.unshift({ id: gatewayId, serial: normalized, type: "Rana Gateway", enterprise: job.enterprise, enterpriseId: job.enterpriseId, site: job.site, status: "Testing", heartbeat: "Awaiting first heartbeat", firmware: "Pending check", jobId: job.id, functions, lastDiagnostic: "Commissioning diagnostic not yet run" });
  job.linkedDevice = gatewayId;
  job.progress = Math.max(job.progress, 32);
  job.status = "In progress";
  job.checklist.push("Gateway identity linked");
  addAudit("Gateway linked", gatewayId, "Testing", `${job.id}. ${data.reason.trim()}`);
  saveState();
  dismissOverlay();
  render();
  toast("Gateway linked", `${gatewayId} is now in commissioning. No readings were manually entered.`);
  setTimeout(() => deviceDrawer(gatewayId), 80);
}

function submitInstallationAcceptance(data) {
  const job = state.jobs.find(item => item.id === data.id);
  if (!job || job.status !== "Ready for acceptance") return;
  const device = state.devices.find(item => item.id === job.linkedDevice);
  job.status = "Completed";
  job.progress = 100;
  job.checklist.push("Installation accepted");
  if (device) {
    device.status = "Live";
    device.functions.forEach(fn => fn.state = "Passing");
  }
  const enterprise = state.enterprises.find(item => item.id === job.enterpriseId);
  if (enterprise) {
    enterprise.liveSites = Math.min(enterprise.sites, enterprise.liveSites + 1);
    enterprise.readiness = Math.min(100, enterprise.readiness + 8);
  }
  addAudit("Installation accepted", job.id, "Completed", data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast("Installation accepted", `${job.site} can now progress to waiting for first data or live status.`);
}

function reissueAdminModal(id) {
  const enterprise = state.enterprises.find(item => item.id === id);
  if (!enterprise) return;
  showModal("Reissue administrator invite", `${enterprise.name} · ${enterprise.adminEmail}`, `<form id="reissue-admin-form" class="form-grid"><input type="hidden" name="id" value="${escapeHtml(id)}" /><div class="field full"><label>Reason</label><textarea name="reason" required minlength="8" placeholder="Why a new invitation is required"></textarea></div></form>`, `<button class="btn btn-secondary" data-action="dismiss-overlay">Cancel</button><button class="btn btn-primary" data-action="submit-form" data-form="reissue-admin-form">Reissue invite</button>`);
}

function submitReissueAdmin(data) {
  const enterprise = state.enterprises.find(item => item.id === data.id);
  if (!enterprise) return;
  enterprise.lastActivity = "Just now";
  addAudit("Initial administrator invite reissued", enterprise.id, "Invitation issued", data.reason.trim());
  saveState();
  dismissOverlay();
  render();
  toast("Administrator invite reissued", `A fresh invitation was issued to ${enterprise.adminEmail}.`);
}

function exportCsv(filename, rows) {
  const content = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function runDeviceDiagnostic(id) {
  const device = state.devices.find(item => item.id === id);
  if (!device) return;
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  device.lastDiagnostic = `Safe identity, heartbeat, and function check completed at ${now}`;
  addAudit("Safe gateway diagnostic run", device.id, device.status === "Offline" ? "Offline confirmed" : "Completed", "Read-only operational diagnostic");
  saveState();
  dismissOverlay();
  render();
  toast("Safe diagnostic complete", "Identity, heartbeat, firmware, and mapped function states were checked without editing readings.");
  setTimeout(() => deviceDrawer(id), 80);
}

function runServiceCheck(id) {
  const service = state.services.find(item => item.id === id);
  if (!service) return;
  addAudit("Platform service check run", service.id, service.status, "Read-only service health probe");
  saveState();
  render();
  toast("Service check complete", `${service.name} remains ${service.status.toLowerCase()}. No retry or configuration change was applied.`);
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!action) return;
  if (action === "toggle-menu") document.body.classList.toggle("menu-open");
  else if (action === "close-menu") document.body.classList.remove("menu-open");
  else if (action === "dismiss-overlay") dismissOverlay();
  else if (action === "set-tab") { activeTabs[button.dataset.group] = button.dataset.tab; render(); }
  else if (action === "new-enterprise") newEnterpriseModal();
  else if (action === "new-job") newJobModal();
  else if (action === "invite-staff") inviteStaffModal();
  else if (action === "new-support-grant") { const enterprise = button.dataset.enterprise || ""; dismissOverlay(); supportGrantModal(enterprise); }
  else if (action === "new-incident") newIncidentModal();
  else if (action === "show-notifications") notificationsDrawer();
  else if (action === "open-enterprise") enterpriseDrawer(id);
  else if (action === "open-site-request") siteRequestDrawer(id);
  else if (action === "open-job") jobDrawer(id);
  else if (action === "open-installer") installerDrawer(id);
  else if (action === "open-device") deviceDrawer(id);
  else if (action === "open-incident") incidentDrawer(id);
  else if (action === "open-staff") staffDrawer(id);
  else if (action === "site-decision") { dismissOverlay(); siteDecisionModal(id, button.dataset.decision); }
  else if (action === "incident-transition") { dismissOverlay(); transitionIncidentModal(id, button.dataset.transition); }
  else if (action === "enterprise-transition") { dismissOverlay(); enterpriseTransitionModal(id, button.dataset.transition); }
  else if (action === "staff-transition") { dismissOverlay(); staffTransitionModal(id, button.dataset.transition); }
  else if (action === "installer-transition") { dismissOverlay(); installerTransitionModal(id, button.dataset.transition); }
  else if (action === "reassign-job") { dismissOverlay(); reassignJobModal(id); }
  else if (action === "link-device") { dismissOverlay(); linkDeviceModal(id); }
  else if (action === "accept-installation") { dismissOverlay(); acceptInstallationModal(id); }
  else if (action === "reissue-admin-invite") { dismissOverlay(); reissueAdminModal(id); }
  else if (action === "run-device-diagnostic") runDeviceDiagnostic(id);
  else if (action === "run-service-check") runServiceCheck(id);
  else if (action === "submit-form") validateAndSubmit(button.dataset.form);
  else if (action === "open-search") document.getElementById("global-search")?.focus();
  else if (action === "go-incidents") { dismissOverlay(); navigate("incidents"); }
  else if (action === "go-enterprise-requests") { dismissOverlay(); activeTabs.enterprises = "requests"; navigate("enterprises"); if (route() === "enterprises") render(); }
  else if (action === "complete-access-review") {
    addAudit("Privileged access review completed", "Rana54 staff", "Recorded", "Scheduled access review completed for all active privileged staff");
    saveState(); render(); toast("Access review recorded", "The review result was appended to audit history.");
  }
  else if (action === "export-audit") {
    addAudit("Audit history exported", "Rana54 Network Operations", "CSV prepared", "Platform operator requested immutable event export");
    saveState();
    exportCsv("rana54-control-center-audit.csv", [["Time","Actor","Action","Entity","Outcome","Reason"], ...state.audit.map(item => [item.time,item.actor,item.action,item.entity,item.outcome,item.reason])]);
    toast("Audit export prepared", "The immutable event view was exported as CSV.");
  }
  else if (action === "export-devices") {
    addAudit("Gateway inventory exported", "Device fleet", "CSV prepared", "Platform operator requested identity and function inventory");
    saveState();
    exportCsv("rana54-gateway-inventory.csv", [["Rana ID","Serial","Enterprise","Site","Functions","Firmware","Heartbeat","Status"], ...state.devices.map(item => [item.id,item.serial,item.enterprise,item.site,item.functions.map(fn => fn.name).join("; "),item.firmware,item.heartbeat,item.status])]);
    toast("Gateway inventory exported", "The export contains identities and function states, not raw readings or secrets.");
  }
}

let filterTimer = null;

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (button) handleAction(button);
  if (!event.target.closest(".global-search") && document.getElementById("search-results")) document.getElementById("search-results").innerHTML = "";
});

document.addEventListener("input", event => {
  const key = event.target.dataset.filterInput;
  if (!key) return;
  filters[key] = event.target.value;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    const selection = filters[key].length;
    render();
    const next = document.querySelector(`[data-filter-input="${key}"]`);
    next?.focus();
    next?.setSelectionRange(selection, selection);
  }, 180);
});

document.addEventListener("change", event => {
  const key = event.target.dataset.filterSelect;
  if (!key) return;
  filters[key] = event.target.value;
  render();
});

document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  const typing = ["INPUT","TEXTAREA","SELECT"].includes(tag);
  if (event.key === "Escape") {
    if (currentOverlay) dismissOverlay();
    else document.body.classList.remove("menu-open");
  }
  if (event.key === "/" && !typing) {
    event.preventDefault();
    document.getElementById("global-search")?.focus();
  }
});

window.addEventListener("hashchange", () => { dismissOverlay(); document.body.classList.remove("menu-open"); render(); });

const originalValidateAndSubmit = validateAndSubmit;
validateAndSubmit = function patchedValidateAndSubmit(formId) {
  if (formId === "reissue-admin-form") {
    const form = document.getElementById(formId);
    if (!form || !form.reportValidity()) return;
    submitReissueAdmin(formDataObject(form));
    return;
  }
  originalValidateAndSubmit(formId);
};

if (!location.hash) location.hash = "#/overview";
render();
