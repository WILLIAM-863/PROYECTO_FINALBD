let actorActual = localStorage.getItem("ph_actor");
let permisos = [];

// Si no hay actor en sesion, volvemos al login.
if (!actorActual) {
  window.location.href = "/login.html";
}

function fmtDate(v) { return new Date(v).toLocaleString(); }
function setMessage(type, text) { document.getElementById("msg").innerHTML = text ? `<div class="${type}">${text}</div>` : ""; }
function optionList(items, key, label) { return items.map((i) => `<option value="${i[key]}">${label(i)}</option>`).join(""); }
function formToObject(f) { return Object.fromEntries(new FormData(f).entries()); }
// Convierte fecha ISO en valor compatible con input datetime-local.
function toDateTimeLocal(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

// Muestra modal y alterna campos segun tipo de edicion.
function openEditModal(type, data) {
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-type").value = type;
  document.getElementById("edit-id").value = String(data.id);

  const isReserva = type === "reserva";
  const isPqrs = type === "pqrs";
  const isTorre = type === "torre";
  const isUnidad = type === "unidad";
  const isEspacio = type === "espacio";
  const isResidente = type === "residente";
  document.getElementById("edit-modal-title").textContent = isReserva ? "Editar Reserva" : "Editar PQRS";
  if (isTorre) document.getElementById("edit-modal-title").textContent = "Editar Torre";
  if (isUnidad) document.getElementById("edit-modal-title").textContent = "Editar Unidad";
  if (isEspacio) document.getElementById("edit-modal-title").textContent = "Editar Espacio";
  if (isResidente) document.getElementById("edit-modal-title").textContent = "Editar Residente";
  ["field-reserva-inicio", "field-reserva-fin", "field-reserva-estado"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isReserva);
  });
  ["field-pqrs-estado", "field-pqrs-asunto", "field-pqrs-descripcion"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isPqrs);
  });
  ["field-torre-nombre"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isTorre);
  });
  ["field-unidad-torre", "field-unidad-numero", "field-unidad-area", "field-unidad-estado"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isUnidad);
  });
  ["field-espacio-nombre", "field-espacio-tipo", "field-espacio-aforo", "field-espacio-activo"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isEspacio);
  });
  ["field-residente-nombre", "field-residente-documento", "field-residente-telefono", "field-residente-email", "field-residente-activo"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", !isResidente);
  });

  if (isReserva) {
    document.getElementById("edit-reserva-inicio").value = toDateTimeLocal(data.fecha_inicio);
    document.getElementById("edit-reserva-fin").value = toDateTimeLocal(data.fecha_fin);
    document.getElementById("edit-reserva-estado").value = data.estado || "ACTIVA";
  } else if (isPqrs) {
    document.getElementById("edit-pqrs-estado-id").value = String(data.estado_pqrs_id || "1");
    document.getElementById("edit-pqrs-asunto").value = data.asunto || "";
    document.getElementById("edit-pqrs-descripcion").value = data.descripcion || "";
  } else if (isTorre) {
    document.getElementById("edit-torre-nombre").value = data.nombre || "";
  } else if (isUnidad) {
    document.getElementById("edit-unidad-torre").value = data.torre || "";
    document.getElementById("edit-unidad-numero").value = data.numero || "";
    document.getElementById("edit-unidad-area").value = data.area_m2 || "";
    document.getElementById("edit-unidad-estado").value = data.estado_ocupacion || "OCUPADA";
  } else if (isEspacio) {
    document.getElementById("edit-espacio-nombre").value = data.nombre || "";
    document.getElementById("edit-espacio-tipo").value = data.tipo || "";
    document.getElementById("edit-espacio-aforo").value = data.aforo_maximo || "";
    document.getElementById("edit-espacio-activo").value = String(data.activo !== false);
  } else if (isResidente) {
    document.getElementById("edit-residente-nombre").value = data.nombre_completo || "";
    document.getElementById("edit-residente-documento").value = data.documento || "";
    document.getElementById("edit-residente-telefono").value = data.telefono || "";
    document.getElementById("edit-residente-email").value = data.email || "";
    document.getElementById("edit-residente-activo").value = String(data.activo !== false);
  }
}

// Cierra modal de edicion.
function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  document.getElementById("edit-type").value = "";
  document.getElementById("edit-id").value = "";
}

async function apiCall(url, options = {}) {
  // Enviamos el actor activo para que backend aplique permisos.
  const headers = { ...(options.headers || {}), "x-actor": actorActual };
  const resp = await fetch(url, { ...options, headers });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Error inesperado");
  return data;
}

function toggleUI() {
  // Muestra u oculta modulos segun permisos del actor.
  const has = (p) => permisos.includes(p);
  const canCatalogoCreate = has("unidad.create") || has("espacio.create");
  const canCatalogoRead = has("unidad.read") || has("espacio.read");
  const canResidentesCreate = has("residente.create") || has("residente.update");
  const canResidentesRead = has("residente.read");
  const canReservaRead = has("reserva.read");
  const canPqrsRead = has("pqrs.read");
  const canBitacoraRead = has("bitacora.read");
  const canBitacoraCreate = has("bitacora.create");

  document.getElementById("catalogo-create-section").classList.toggle("hidden", !canCatalogoCreate);
  document.getElementById("catalogo-read-section").classList.toggle("hidden", !canCatalogoRead);
  document.getElementById("residentes-create-section").classList.toggle("hidden", !canResidentesCreate);
  document.getElementById("residentes-read-section").classList.toggle("hidden", !canResidentesRead);

  const showAdminSection = canCatalogoCreate || canCatalogoRead || canResidentesCreate || canResidentesRead;
  document.getElementById("admin-section").classList.toggle("hidden", !showAdminSection);

  document.getElementById("reserva-section").classList.toggle("hidden", !has("reserva.create"));
  document.getElementById("pqrs-section").classList.toggle("hidden", !has("pqrs.create"));
  document.getElementById("reserva-read-section").classList.toggle("hidden", !canReservaRead);
  document.getElementById("pqrs-read-section").classList.toggle("hidden", !canPqrsRead);
  document.getElementById("bitacora-section").classList.toggle("hidden", !(canBitacoraRead || canBitacoraCreate));
  const bitacoraForm = document.querySelector("[data-create-bitacora]");
  if (bitacoraForm) bitacoraForm.classList.toggle("hidden", !canBitacoraCreate);
}

function renderReservas(rows) {
  // Solo perfiles con update pueden cancelar reservas.
  const canCancel = permisos.includes("reserva.update");
  const canEdit = permisos.includes("reserva.update");
  const canDelete = permisos.includes("reserva.delete");
  const body = document.getElementById("reservas-body");
  body.innerHTML = rows.map((r) => `<tr><td>${r.reserva_id}</td><td>${r.espacio}</td><td>${r.unidad}</td><td>${r.residente}</td><td>${fmtDate(r.fecha_inicio)}</td><td>${fmtDate(r.fecha_fin)}</td><td>${r.estado}</td><td>${canEdit ? `<button type="button" data-edit-reserva="${r.reserva_id}" data-start="${r.fecha_inicio}" data-end="${r.fecha_fin}" data-state="${r.estado}">Editar</button>` : ""} ${canCancel && r.estado === "ACTIVA" ? `<button type="button" data-cancel="${r.reserva_id}">Cancelar</button>` : ""} ${canDelete ? `<button type="button" data-del-reserva="${r.reserva_id}" class="alt-btn">Eliminar</button>` : ""}</td></tr>`).join("");
  body.querySelectorAll("button[data-edit-reserva]").forEach((b) => b.addEventListener("click", () => {
    openEditModal("reserva", {
      id: b.dataset.editReserva,
      fecha_inicio: b.dataset.start,
      fecha_fin: b.dataset.end,
      estado: b.dataset.state
    });
  }));
  body.querySelectorAll("button[data-cancel]").forEach((b) => b.addEventListener("click", async () => {
    try {
      const d = await apiCall(`/api/reservas/${b.dataset.cancel}/cancelar`, { method: "PATCH" });
      setMessage("ok", d.ok);
      await loadViews();
    } catch (e) { setMessage("error", e.message); }
  }));
  body.querySelectorAll("button[data-del-reserva]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await apiCall(`/api/reservas/${b.dataset.delReserva}`, { method: "DELETE" });
      setMessage("ok", "Reserva eliminada");
      await loadViews();
    } catch (e) { setMessage("error", e.message); }
  }));
}

function renderPqrs(rows) {
  const canEdit = permisos.includes("pqrs.update");
  const canDelete = permisos.includes("pqrs.delete");
  const body = document.getElementById("pqrs-body");
  body.innerHTML = rows.map((p) => `<tr><td>${p.pqrs_id}</td><td>${p.unidad}</td><td>${p.residente}</td><td>${p.estado}</td><td>${p.asunto}</td><td>${fmtDate(p.fecha_registro)}</td><td>${canEdit ? `<button type="button" data-edit-pqrs="${p.pqrs_id}" data-asunto="${(p.asunto || "").replace(/"/g, "&quot;")}" data-descripcion="${(p.descripcion || "").replace(/"/g, "&quot;")}">Editar</button>` : ""} ${canDelete ? `<button type="button" data-del-pqrs="${p.pqrs_id}" class="alt-btn">Eliminar</button>` : "-"}</td></tr>`).join("");
  body.querySelectorAll("button[data-edit-pqrs]").forEach((b) => b.addEventListener("click", () => {
    const estadoActual = (rows.find((x) => String(x.pqrs_id) === String(b.dataset.editPqrs))?.estado || "ABIERTA").toUpperCase();
    const estadoMap = { ABIERTA: "1", EN_REVISION: "2", CERRADA: "3" };
    openEditModal("pqrs", {
      id: b.dataset.editPqrs,
      estado_pqrs_id: estadoMap[estadoActual] || "1",
      asunto: b.dataset.asunto || "",
      descripcion: b.dataset.descripcion || ""
    });
  }));
  body.querySelectorAll("button[data-del-pqrs]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await apiCall(`/api/pqrs/${b.dataset.delPqrs}`, { method: "DELETE" });
      setMessage("ok", "PQRS eliminada");
      await loadViews();
    } catch (e) { setMessage("error", e.message); }
  }));
}

// Pinta tabla de bitacora con acciones segun permisos.
function renderBitacora(rows) {
  const canEdit = permisos.includes("bitacora.update");
  const canDelete = permisos.includes("bitacora.delete");
  const body = document.getElementById("bitacora-body");
  if (!body) return;
  body.innerHTML = rows.map((b) => `<tr><td>${b.bitacora_id}</td><td>${b.unidad || "-"}</td><td>${b.residente || "-"}</td><td>${b.visitante_nombre}</td><td>${b.documento_visitante || "-"}</td><td>${b.tipo_movimiento}</td><td>${fmtDate(b.fecha_evento)}</td><td>${canEdit ? `<button type="button" data-edit-bitacora="${b.bitacora_id}" data-visitante="${(b.visitante_nombre || "").replace(/"/g, "&quot;")}" data-documento="${(b.documento_visitante || "").replace(/"/g, "&quot;")}" data-movimiento="${b.tipo_movimiento}" data-observacion="${(b.observacion || "").replace(/"/g, "&quot;")}">Editar</button>` : ""} ${canDelete ? `<button type="button" data-del-bitacora="${b.bitacora_id}" class="alt-btn">Eliminar</button>` : "-"}</td></tr>`).join("");
  body.querySelectorAll("button[data-edit-bitacora]").forEach((btn) => btn.addEventListener("click", () => {
    const visitante_nombre = prompt("Visitante", btn.dataset.visitante || "");
    const documento_visitante = prompt("Documento", btn.dataset.documento || "");
    const tipo_movimiento = prompt("Movimiento (INGRESO/SALIDA)", btn.dataset.movimiento || "INGRESO");
    const observacion = prompt("Observacion", btn.dataset.observacion || "");
    if (!visitante_nombre || !tipo_movimiento) return;
    apiCall(`/api/bitacora-acceso/${btn.dataset.editBitacora}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitante_nombre, documento_visitante, tipo_movimiento, observacion })
    }).then(async () => {
      setMessage("ok", "Bitacora actualizada");
      await loadViews();
    }).catch((e) => setMessage("error", e.message));
  }));
  body.querySelectorAll("button[data-del-bitacora]").forEach((btn) => btn.addEventListener("click", () => {
    apiCall(`/api/bitacora-acceso/${btn.dataset.delBitacora}`, { method: "DELETE" })
      .then(async () => {
        setMessage("ok", "Bitacora eliminada");
        await loadViews();
      })
      .catch((e) => setMessage("error", e.message));
  }));
}

// Pinta tabla compacta para editar y eliminar catalogos.
function renderCatalogoCrud(torres, unidades, espacios) {
  const body = document.getElementById("catalogo-crud-body");
  if (!body) return;
  const canUnidadUpdate = permisos.includes("unidad.update");
  const canUnidadDelete = permisos.includes("unidad.delete");
  const canEspacioUpdate = permisos.includes("espacio.update");
  const canEspacioDelete = permisos.includes("espacio.delete");
  const rows = [];
  torres.slice(0, 5).forEach((t) => rows.push(`<tr><td>Torre</td><td>${t.nombre}</td><td>${canUnidadUpdate ? `<button data-edit-torre="${t.torre_id}">Editar</button>` : ""} ${canUnidadDelete ? `<button data-del-torre="${t.torre_id}" class="alt-btn">Eliminar</button>` : ""}</td></tr>`));
  unidades.slice(0, 5).forEach((u) => rows.push(`<tr><td>Unidad</td><td>${u.torre}-${u.numero} (${u.estado_ocupacion})</td><td>${canUnidadUpdate ? `<button data-edit-unidad="${u.unidad_id}">Editar</button>` : ""} ${canUnidadDelete ? `<button data-del-unidad="${u.unidad_id}" class="alt-btn">Eliminar</button>` : ""}</td></tr>`));
  espacios.slice(0, 5).forEach((e) => rows.push(`<tr><td>Espacio</td><td>${e.nombre} (${e.tipo})</td><td>${canEspacioUpdate ? `<button data-edit-espacio="${e.espacio_id}">Editar</button>` : ""} ${canEspacioDelete ? `<button data-del-espacio="${e.espacio_id}" class="alt-btn">Eliminar</button>` : ""}</td></tr>`));
  body.innerHTML = rows.join("");
}

// Pinta tabla de residentes para CRUD rapido.
function renderResidentesCrud(residentes) {
  const body = document.getElementById("residentes-crud-body");
  if (!body) return;
  const canUpdate = permisos.includes("residente.update");
  const canDelete = permisos.includes("residente.delete");
  body.innerHTML = residentes.slice(0, 10).map((r) => `<tr><td>${r.residente_id}</td><td>${r.nombre_completo}</td><td>${r.documento}</td><td>${canUpdate ? `<button data-edit-residente="${r.residente_id}">Editar</button>` : ""} ${canDelete ? `<button data-del-residente="${r.residente_id}" class="alt-btn">Eliminar</button>` : ""}</td></tr>`).join("");
}

async function loadDashboard() {
  // Carga catalogos para formularios y selects.
  const d = await apiCall("/api/dashboard");
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set("espacio_id", optionList(d.espacios, "espacio_id", (e) => `${e.nombre} (aforo ${e.aforo_maximo})`));
  set("unidad_id", optionList(d.unidades, "unidad_id", (u) => `${u.torre}-${u.numero}`));
  set("pqrs_unidad_id", optionList(d.unidades, "unidad_id", (u) => `${u.torre}-${u.numero}`));
  set("vinculo_unidad_id", optionList(d.unidades, "unidad_id", (u) => `${u.torre}-${u.numero}`));
  set("residente_id", optionList(d.residentes, "residente_id", (r) => r.nombre_completo));
  set("pqrs_residente_id", optionList(d.residentes, "residente_id", (r) => r.nombre_completo));
  set("vinculo_residente_id", optionList(d.residentes, "residente_id", (r) => r.nombre_completo));
  set("estado_pqrs_id", optionList(d.estadosPqrs, "estado_pqrs_id", (e) => e.nombre));
  set("bitacora_unidad_id", optionList(d.unidades, "unidad_id", (u) => `${u.torre}-${u.numero}`));
  set("bitacora_residente_id", optionList(d.residentes, "residente_id", (r) => r.nombre_completo));

  // Carga lecturas CRUD extras solo si el actor tiene permisos de lectura por entidad.
  const has = (p) => permisos.includes(p);
  const torres = has("unidad.read") ? await apiCall("/api/torres") : { torres: [] };
  const unidades = has("unidad.read") ? await apiCall("/api/unidades") : { unidades: [] };
  const espacios = has("espacio.read") ? await apiCall("/api/espacios") : { espacios: [] };
  const residentes = has("residente.read") ? await apiCall("/api/residentes") : { residentes: [] };

  renderCatalogoCrud(torres.torres, unidades.unidades, espacios.espacios);
  renderResidentesCrud(residentes.residentes);
  bindCrudActions(torres.torres, unidades.unidades, espacios.espacios, residentes.residentes);
}

async function loadViews() {
  // Carga vistas consolidadas de reservas y PQRS.
  const r = permisos.includes("reserva.read")
    ? await apiCall("/api/vistas/reservas")
    : { reservas: [] };
  const p = permisos.includes("pqrs.read")
    ? await apiCall("/api/vistas/pqrs")
    : { pqrs: [] };
  const b = permisos.includes("bitacora.read")
    ? await apiCall("/api/bitacora-acceso")
    : { bitacora: [] };
  renderReservas(r.reservas);
  renderPqrs(p.pqrs);
  renderBitacora(b.bitacora);
}

async function submitJsonForm(ev, url) {
  ev.preventDefault();
  try {
    const form = ev.currentTarget;
    const data = await apiCall(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToObject(form))
    });
    setMessage("ok", data.ok || "Operacion exitosa");
    form.reset();
    await loadDashboard();
    await loadViews();
  } catch (e) { setMessage("error", e.message); }
}

// Conecta acciones de editar y eliminar en tablas CRUD.
function bindCrudActions(torres, unidades, espacios, residentes) {
  document.querySelectorAll("[data-edit-torre]").forEach((b) => b.addEventListener("click", async () => {
    const t = torres.find((x) => String(x.torre_id) === b.dataset.editTorre);
    openEditModal("torre", { id: b.dataset.editTorre, nombre: t?.nombre || "" });
  }));
  document.querySelectorAll("[data-del-torre]").forEach((b) => b.addEventListener("click", async () => {
    try { await apiCall(`/api/torres/${b.dataset.delTorre}`, { method: "DELETE" }); await loadDashboard(); setMessage("ok", "Torre eliminada"); } catch (e) { setMessage("error", e.message); }
  }));
  document.querySelectorAll("[data-edit-unidad]").forEach((b) => b.addEventListener("click", async () => {
    const u = unidades.find((x) => String(x.unidad_id) === b.dataset.editUnidad);
    openEditModal("unidad", { id: b.dataset.editUnidad, ...u });
  }));
  document.querySelectorAll("[data-del-unidad]").forEach((b) => b.addEventListener("click", async () => {
    try { await apiCall(`/api/unidades/${b.dataset.delUnidad}`, { method: "DELETE" }); await loadDashboard(); setMessage("ok", "Unidad eliminada"); } catch (e) { setMessage("error", e.message); }
  }));
  document.querySelectorAll("[data-edit-espacio]").forEach((b) => b.addEventListener("click", async () => {
    const e = espacios.find((x) => String(x.espacio_id) === b.dataset.editEspacio);
    openEditModal("espacio", { id: b.dataset.editEspacio, ...e });
  }));
  document.querySelectorAll("[data-del-espacio]").forEach((b) => b.addEventListener("click", async () => {
    try { await apiCall(`/api/espacios/${b.dataset.delEspacio}`, { method: "DELETE" }); await loadDashboard(); setMessage("ok", "Espacio eliminado"); } catch (e) { setMessage("error", e.message); }
  }));
  document.querySelectorAll("[data-edit-residente]").forEach((b) => b.addEventListener("click", async () => {
    const r = residentes.find((x) => String(x.residente_id) === b.dataset.editResidente);
    openEditModal("residente", { id: b.dataset.editResidente, ...r });
  }));
  document.querySelectorAll("[data-del-residente]").forEach((b) => b.addEventListener("click", async () => {
    try { await apiCall(`/api/residentes/${b.dataset.delResidente}`, { method: "DELETE" }); await loadDashboard(); setMessage("ok", "Residente eliminado"); } catch (e) { setMessage("error", e.message); }
  }));
}

async function iniciarSesionActor() {
  // Obtiene permisos efectivos del actor autenticado.
  const ctx = await apiCall("/api/auth/context");
  permisos = ctx.permisos;
  document.getElementById("actor-label").textContent = `Sesion activa: ${ctx.actor}`;
  toggleUI();
  await loadDashboard();
  await loadViews();
}

document.getElementById("logout-btn").addEventListener("click", () => {
  // Limpia sesion local y regresa al login.
  localStorage.removeItem("ph_actor");
  window.location.href = "/login.html";
});

// Guarda cambios desde modal para reservas o PQRS.
document.getElementById("edit-modal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = document.getElementById("edit-type").value;
  const id = document.getElementById("edit-id").value;
  if (!type || !id) return;

  try {
    if (type === "reserva") {
      const fecha_inicio = document.getElementById("edit-reserva-inicio").value;
      const fecha_fin = document.getElementById("edit-reserva-fin").value;
      const estado = document.getElementById("edit-reserva-estado").value;
      await apiCall(`/api/reservas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_inicio, fecha_fin, estado })
      });
      setMessage("ok", "Reserva actualizada");
    } else if (type === "pqrs") {
      const estado_pqrs_id = document.getElementById("edit-pqrs-estado-id").value;
      const asunto = document.getElementById("edit-pqrs-asunto").value;
      const descripcion = document.getElementById("edit-pqrs-descripcion").value;
      await apiCall(`/api/pqrs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_pqrs_id, asunto, descripcion })
      });
      setMessage("ok", "PQRS actualizada");
    } else if (type === "torre") {
      const nombre = document.getElementById("edit-torre-nombre").value;
      await apiCall(`/api/torres/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre })
      });
      setMessage("ok", "Torre actualizada");
      await loadDashboard();
    } else if (type === "unidad") {
      const torre = document.getElementById("edit-unidad-torre").value;
      const numero = document.getElementById("edit-unidad-numero").value;
      const area_m2 = document.getElementById("edit-unidad-area").value;
      const estado_ocupacion = document.getElementById("edit-unidad-estado").value;
      await apiCall(`/api/unidades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torre, numero, area_m2, estado_ocupacion })
      });
      setMessage("ok", "Unidad actualizada");
      await loadDashboard();
    } else if (type === "espacio") {
      const nombre = document.getElementById("edit-espacio-nombre").value;
      const tipo = document.getElementById("edit-espacio-tipo").value;
      const aforo_maximo = document.getElementById("edit-espacio-aforo").value;
      const activo = document.getElementById("edit-espacio-activo").value;
      await apiCall(`/api/espacios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, tipo, aforo_maximo, activo })
      });
      setMessage("ok", "Espacio actualizado");
      await loadDashboard();
    } else if (type === "residente") {
      const nombre_completo = document.getElementById("edit-residente-nombre").value;
      const documento = document.getElementById("edit-residente-documento").value;
      const telefono = document.getElementById("edit-residente-telefono").value;
      const email = document.getElementById("edit-residente-email").value;
      const activo = document.getElementById("edit-residente-activo").value;
      await apiCall(`/api/residentes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_completo, documento, telefono, email, activo })
      });
      setMessage("ok", "Residente actualizado");
      await loadDashboard();
    }
    closeEditModal();
    await loadViews();
  } catch (e) {
    setMessage("error", e.message);
  }
});

document.getElementById("edit-modal-close").addEventListener("click", closeEditModal);

[
  ["form-torre", "/api/torres"],
  ["form-unidad", "/api/unidades"],
  ["form-espacio", "/api/espacios"],
  ["form-residente", "/api/residentes"],
  ["form-vinculo", "/api/unidad-residente"],
  ["form-reserva", "/api/reservas"],
  ["form-pqrs", "/api/pqrs"],
  ["form-bitacora", "/api/bitacora-acceso"]
].forEach(([id, url]) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("submit", (e) => submitJsonForm(e, url));
});

iniciarSesionActor().catch((e) => setMessage("error", e.message));
