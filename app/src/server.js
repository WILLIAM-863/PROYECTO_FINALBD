const express = require("express");
const path = require("path");
const pool = require("./db");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Actores definidos en el documento de mapa de actores.
const ACTORES = {
  ADMINISTRADOR: "Administrador",
  AUXILIAR: "Auxiliar Administrativo",
  VIGILANTE: "Vigilante",
  RESIDENTE: "Residente"
};

const PERMISOS = {
  // Administrador: CRUD en unidad/residente/espacio, RUD en reserva y PQRS, y lectura general.
  [ACTORES.ADMINISTRADOR]: new Set([
    "unidad.create", "unidad.read", "unidad.update", "unidad.delete",
    "residente.create", "residente.read", "residente.update", "residente.delete",
    "espacio.create", "espacio.read", "espacio.update", "espacio.delete",
    "reserva.read", "reserva.update", "reserva.delete",
    "pqrs.read", "pqrs.update", "pqrs.delete",
    "bitacora.read",
    "vistas.read"
  ]),
  // Auxiliar administrativo: READ de unidad, CRU de residente y READ de PQRS.
  [ACTORES.AUXILIAR]: new Set([
    "unidad.read",
    "residente.create", "residente.read", "residente.update",
    "pqrs.read",
    "vistas.read"
  ]),
  // Vigilante: lectura en residente y reserva, mas vistas del panel.
  [ACTORES.VIGILANTE]: new Set([
    "residente.read", "reserva.read",
    "bitacora.create", "bitacora.read", "bitacora.update", "bitacora.delete",
    "vistas.read"
  ]),
  // Residente: lectura de espacio, CR en reserva y C en PQRS.
  [ACTORES.RESIDENTE]: new Set(["espacio.read", "reserva.create", "reserva.read", "pqrs.create", "vistas.read"])
};

// Toma el actor desde header para aplicar permisos en cada request.
function actorFromRequest(req) {
  const actor = req.header("x-actor") || ACTORES.RESIDENTE;
  return Object.values(ACTORES).includes(actor) ? actor : null;
}

// Middleware de control de acceso por permiso puntual.
function requirePermiso(permiso) {
  return (req, res, next) => {
    const actor = actorFromRequest(req);
    if (!actor) return res.status(400).json({ error: "Actor invalido" });
    req.actor = actor;
    if (!PERMISOS[actor].has(permiso)) {
      return res.status(403).json({ error: `El actor ${actor} no tiene permiso para esta accion` });
    }
    next();
  };
}

// Carga catalogos y listados base para poblar el panel.
async function loadDashboardData(actor) {
  const actorPermisos = PERMISOS[actor] || new Set();
  const canReadReservas = actorPermisos.has("reserva.read");
  const canReadPqrs = actorPermisos.has("pqrs.read");
  const canReadBitacora = actorPermisos.has("bitacora.read");
  const canReadEspacios = actorPermisos.has("espacio.read") || actorPermisos.has("espacio.create");
  const canReadUnidades = actorPermisos.has("unidad.read") || actorPermisos.has("reserva.create") || actorPermisos.has("pqrs.create") || actorPermisos.has("bitacora.create") || actorPermisos.has("bitacora.read");
  const canReadResidentes = actorPermisos.has("residente.read") || actorPermisos.has("reserva.create") || actorPermisos.has("pqrs.create") || actorPermisos.has("bitacora.create") || actorPermisos.has("bitacora.read");

  const [torres, espacios, unidades, residentes, reservas, pqrs, estadosPqrs, bitacora] = await Promise.all([
    // Consulta de torres.
    actorPermisos.has("unidad.read")
      ? pool.query("SELECT torre_id, nombre FROM torre ORDER BY nombre")
      : Promise.resolve({ rows: [] }),
    // Consulta de espacios activos.
    canReadEspacios
      ? pool.query("SELECT espacio_id, nombre, aforo_maximo FROM espacio_comun WHERE activo = true ORDER BY nombre")
      : Promise.resolve({ rows: [] }),
    // Consulta de unidades.
    canReadUnidades
      ? pool.query("SELECT unidad_id, torre, numero, estado_ocupacion FROM unidad ORDER BY torre, numero")
      : Promise.resolve({ rows: [] }),
    // Consulta de residentes activos.
    canReadResidentes
      ? pool.query("SELECT residente_id, nombre_completo FROM residente WHERE activo = true ORDER BY nombre_completo")
      : Promise.resolve({ rows: [] }),
    // Consulta de reservas recientes.
    canReadReservas
      ? pool.query(`SELECT r.reserva_id, e.nombre AS espacio, u.torre || '-' || u.numero AS unidad,
        rs.nombre_completo AS residente, r.fecha_inicio, r.fecha_fin, r.estado,
        r.unidad_id, r.espacio_id
        FROM reserva_espacio r
        JOIN espacio_comun e ON e.espacio_id = r.espacio_id
        JOIN unidad u ON u.unidad_id = r.unidad_id
        JOIN residente rs ON rs.residente_id = r.residente_id
        ORDER BY r.reserva_id DESC LIMIT 20`)
      : Promise.resolve({ rows: [] }),
    // Consulta de PQRS recientes.
    canReadPqrs
      ? pool.query(`SELECT p.pqrs_id, u.torre || '-' || u.numero AS unidad,
        r.nombre_completo AS residente, ep.nombre AS estado, p.asunto, p.fecha_registro
        FROM pqrs p
        JOIN unidad u ON u.unidad_id = p.unidad_id
        JOIN residente r ON r.residente_id = p.residente_id
        JOIN estado_pqrs ep ON ep.estado_pqrs_id = p.estado_pqrs_id
        ORDER BY p.pqrs_id DESC LIMIT 20`)
      : Promise.resolve({ rows: [] }),
    // Consulta de estados validos para PQRS.
    actorPermisos.has("pqrs.create")
      ? pool.query("SELECT estado_pqrs_id, nombre FROM estado_pqrs ORDER BY estado_pqrs_id")
      : Promise.resolve({ rows: [] }),
    canReadBitacora
      ? pool.query(`SELECT b.bitacora_id, u.torre || '-' || u.numero AS unidad, r.nombre_completo AS residente,
          b.visitante_nombre, b.documento_visitante, b.tipo_movimiento, b.observacion, b.fecha_evento
          FROM bitacora_acceso b
          LEFT JOIN unidad u ON u.unidad_id = b.unidad_id
          LEFT JOIN residente r ON r.residente_id = b.residente_id
          ORDER BY b.bitacora_id DESC LIMIT 30`)
      : Promise.resolve({ rows: [] })
  ]);

  return {
    torres: torres.rows,
    espacios: espacios.rows,
    unidades: unidades.rows,
    residentes: residentes.rows,
    reservas: reservas.rows,
    pqrs: pqrs.rows,
    estadosPqrs: estadosPqrs.rows,
    bitacora: bitacora.rows
  };
}

app.get("/", (_, res) => res.redirect("/login.html"));
app.get("/panel", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (_, res) => res.json({ ok: true }));

// Retorna actor y permisos para pintar la UI segun sesion.
app.get("/api/auth/context", (req, res) => {
  const actor = actorFromRequest(req) || ACTORES.RESIDENTE;
  res.json({ actor, actores: Object.values(ACTORES), permisos: Array.from(PERMISOS[actor]) });
});

// Data general para cargar selects y tablas del panel.
app.get("/api/dashboard", requirePermiso("vistas.read"), async (_, res) => {
  try { res.json(await loadDashboardData(_.actor)); }
  catch (err) { res.status(500).json({ error: `Error de carga de dashboard: ${err.message}` }); }
});

// Vista consolidada de reservas para perfiles de lectura.
app.get("/api/vistas/reservas", requirePermiso("reserva.read"), async (_, res) => {
  try { res.json({ reservas: (await pool.query("SELECT * FROM vw_reservas_detalle ORDER BY reserva_id DESC LIMIT 100")).rows }); }
  catch (err) { res.status(500).json({ error: `Error consultando vista reservas: ${err.message}` }); }
});

// Vista consolidada de PQRS para perfiles de lectura.
app.get("/api/vistas/pqrs", requirePermiso("pqrs.read"), async (_, res) => {
  try { res.json({ pqrs: (await pool.query("SELECT * FROM vw_pqrs_detalle ORDER BY pqrs_id DESC LIMIT 100")).rows }); }
  catch (err) { res.status(500).json({ error: `Error consultando vista pqrs: ${err.message}` }); }
});

// Historial de reservas con filtros por unidad y espacio.
app.get("/api/reservas", requirePermiso("reserva.read"), async (req, res) => {
  try {
    const unidadId = req.query.unidad_id ? Number(req.query.unidad_id) : null;
    const espacioId = req.query.espacio_id ? Number(req.query.espacio_id) : null;
    // Consulta de historial filtrable.
    const result = await pool.query(
      `SELECT r.reserva_id, e.nombre AS espacio, u.torre || '-' || u.numero AS unidad,
        rs.nombre_completo AS residente, r.fecha_inicio, r.fecha_fin, r.estado,
        r.unidad_id, r.espacio_id
       FROM reserva_espacio r
       JOIN espacio_comun e ON e.espacio_id = r.espacio_id
       JOIN unidad u ON u.unidad_id = r.unidad_id
       JOIN residente rs ON rs.residente_id = r.residente_id
       WHERE ($1::int IS NULL OR r.unidad_id = $1)
         AND ($2::int IS NULL OR r.espacio_id = $2)
       ORDER BY r.fecha_inicio DESC LIMIT 100`,
      [unidadId, espacioId]
    );
    res.json({ reservas: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando historial: ${err.message}` });
  }
});

app.post("/api/torres", requirePermiso("unidad.create"), async (req, res) => {
  try {
    // Inserta una torre nueva.
    const result = await pool.query("INSERT INTO torre (nombre) VALUES ($1) RETURNING torre_id, nombre", [req.body.nombre?.trim()]);
    res.status(201).json({ ok: "Torre registrada", torre: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error registrando torre: ${err.message}` });
  }
});

// Consulta de torres para operaciones de listado.
app.get("/api/torres", requirePermiso("unidad.read"), async (_, res) => {
  try {
    // Lista torres ordenadas por nombre.
    const result = await pool.query("SELECT torre_id, nombre FROM torre ORDER BY nombre");
    res.json({ torres: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando torres: ${err.message}` });
  }
});

// Actualiza el nombre de una torre existente.
app.put("/api/torres/:id", requirePermiso("unidad.update"), async (req, res) => {
  try {
    // Actualiza la torre por id.
    const result = await pool.query(
      "UPDATE torre SET nombre = $1 WHERE torre_id = $2 RETURNING torre_id, nombre",
      [req.body.nombre?.trim(), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Torre no encontrada" });
    res.json({ ok: "Torre actualizada", torre: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando torre: ${err.message}` });
  }
});

// Elimina una torre por id.
app.delete("/api/torres/:id", requirePermiso("unidad.delete"), async (req, res) => {
  try {
    // Elimina torre por identificador.
    const result = await pool.query("DELETE FROM torre WHERE torre_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Torre no encontrada" });
    res.json({ ok: "Torre eliminada" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando torre: ${err.message}` });
  }
});

app.post("/api/unidades", requirePermiso("unidad.create"), async (req, res) => {
  try {
    const { torre, numero, area_m2, estado_ocupacion } = req.body;
    // Inserta unidad con estado de ocupacion.
    const result = await pool.query(
      `INSERT INTO unidad (torre, numero, area_m2, estado_ocupacion)
       VALUES ($1, $2, $3, $4)
       RETURNING unidad_id, torre, numero, area_m2, estado_ocupacion`,
      [torre.trim(), numero.trim(), area_m2 ? Number(area_m2) : null, estado_ocupacion.trim().toUpperCase()]
    );
    res.status(201).json({ ok: "Unidad registrada", unidad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error registrando unidad: ${err.message}` });
  }
});

// Consulta de unidades para operaciones CRUD.
app.get("/api/unidades", requirePermiso("unidad.read"), async (_, res) => {
  try {
    // Lista unidades con datos base.
    const result = await pool.query(
      "SELECT unidad_id, torre, numero, area_m2, estado_ocupacion FROM unidad ORDER BY torre, numero"
    );
    res.json({ unidades: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando unidades: ${err.message}` });
  }
});

// Actualiza una unidad por id.
app.put("/api/unidades/:id", requirePermiso("unidad.update"), async (req, res) => {
  try {
    const { torre, numero, area_m2, estado_ocupacion } = req.body;
    // Actualiza datos editables de la unidad.
    const result = await pool.query(
      `UPDATE unidad
       SET torre = $1, numero = $2, area_m2 = $3, estado_ocupacion = $4
       WHERE unidad_id = $5
       RETURNING unidad_id, torre, numero, area_m2, estado_ocupacion`,
      [torre.trim(), numero.trim(), area_m2 ? Number(area_m2) : null, estado_ocupacion.trim().toUpperCase(), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Unidad no encontrada" });
    res.json({ ok: "Unidad actualizada", unidad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando unidad: ${err.message}` });
  }
});

// Elimina una unidad por id.
app.delete("/api/unidades/:id", requirePermiso("unidad.delete"), async (req, res) => {
  try {
    // Elimina unidad por identificador.
    const result = await pool.query("DELETE FROM unidad WHERE unidad_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Unidad no encontrada" });
    res.json({ ok: "Unidad eliminada" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando unidad: ${err.message}` });
  }
});

app.post("/api/residentes", requirePermiso("residente.create"), async (req, res) => {
  try {
    const { nombre_completo, documento, telefono, email } = req.body;
    // Inserta residente para operacion diaria.
    const result = await pool.query(
      `INSERT INTO residente (nombre_completo, documento, telefono, email)
       VALUES ($1, $2, $3, $4)
       RETURNING residente_id, nombre_completo, documento, activo`,
      [nombre_completo.trim(), documento.trim(), (telefono || "").trim() || null, (email || "").trim() || null]
    );
    res.status(201).json({ ok: "Residente registrado", residente: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error registrando residente: ${err.message}` });
  }
});

// Consulta de residentes para operaciones CRUD.
app.get("/api/residentes", requirePermiso("residente.read"), async (_, res) => {
  try {
    // Lista residentes registrados.
    const result = await pool.query(
      "SELECT residente_id, nombre_completo, documento, telefono, email, activo FROM residente ORDER BY residente_id DESC"
    );
    res.json({ residentes: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando residentes: ${err.message}` });
  }
});

// Actualiza datos de residente.
app.put("/api/residentes/:id", requirePermiso("residente.update"), async (req, res) => {
  try {
    const { nombre_completo, documento, telefono, email, activo } = req.body;
    // Actualiza residente por id.
    const result = await pool.query(
      `UPDATE residente
       SET nombre_completo = $1, documento = $2, telefono = $3, email = $4, activo = $5
       WHERE residente_id = $6
       RETURNING residente_id, nombre_completo, documento, telefono, email, activo`,
      [nombre_completo.trim(), documento.trim(), (telefono || "").trim() || null, (email || "").trim() || null, String(activo) !== "false", req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Residente no encontrado" });
    res.json({ ok: "Residente actualizado", residente: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando residente: ${err.message}` });
  }
});

// Elimina residente por id.
app.delete("/api/residentes/:id", requirePermiso("residente.delete"), async (req, res) => {
  try {
    // Elimina residente.
    const result = await pool.query("DELETE FROM residente WHERE residente_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Residente no encontrado" });
    res.json({ ok: "Residente eliminado" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando residente: ${err.message}` });
  }
});

app.post("/api/unidad-residente", requirePermiso("residente.update"), async (req, res) => {
  try {
    const { unidad_id, residente_id, rol_tenencia, fecha_inicio, fecha_fin } = req.body;
    // Inserta la vinculacion unidad-residente.
    await pool.query(
      `INSERT INTO unidad_residente (unidad_id, residente_id, rol_tenencia, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5)`,
      [unidad_id, residente_id, rol_tenencia.trim().toUpperCase(), fecha_inicio, fecha_fin || null]
    );
    res.status(201).json({ ok: "Vinculacion registrada" });
  } catch (err) {
    res.status(500).json({ error: `Error vinculando residente: ${err.message}` });
  }
});

// Consulta de vinculaciones unidad-residente.
app.get("/api/unidad-residente", requirePermiso("residente.read"), async (_, res) => {
  try {
    // Lista vinculaciones con nombre de residente y unidad.
    const result = await pool.query(
      `SELECT ur.unidad_id, ur.residente_id, ur.rol_tenencia, ur.fecha_inicio, ur.fecha_fin,
              u.torre, u.numero, r.nombre_completo
       FROM unidad_residente ur
       JOIN unidad u ON u.unidad_id = ur.unidad_id
       JOIN residente r ON r.residente_id = ur.residente_id
       ORDER BY ur.fecha_inicio DESC`
    );
    res.json({ vinculaciones: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando vinculaciones: ${err.message}` });
  }
});

app.post("/api/espacios", requirePermiso("espacio.create"), async (req, res) => {
  try {
    const { nombre, tipo, aforo_maximo } = req.body;
    // Inserta espacio comun con tipo y aforo.
    const result = await pool.query(
      `INSERT INTO espacio_comun (nombre, tipo, aforo_maximo)
       VALUES ($1, $2, $3)
       RETURNING espacio_id, nombre, tipo, aforo_maximo, activo`,
      [nombre.trim(), tipo.trim().toUpperCase(), Number(aforo_maximo)]
    );
    res.status(201).json({ ok: "Espacio registrado", espacio: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error registrando espacio: ${err.message}` });
  }
});

// Consulta de espacios comunes para operaciones CRUD.
app.get("/api/espacios", requirePermiso("espacio.read"), async (_, res) => {
  try {
    // Lista espacios disponibles y su estado.
    const result = await pool.query(
      "SELECT espacio_id, nombre, tipo, aforo_maximo, activo FROM espacio_comun ORDER BY nombre"
    );
    res.json({ espacios: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando espacios: ${err.message}` });
  }
});

// Actualiza espacio comun por id.
app.put("/api/espacios/:id", requirePermiso("espacio.update"), async (req, res) => {
  try {
    const { nombre, tipo, aforo_maximo, activo } = req.body;
    // Actualiza datos editables del espacio.
    const result = await pool.query(
      `UPDATE espacio_comun
       SET nombre = $1, tipo = $2, aforo_maximo = $3, activo = $4
       WHERE espacio_id = $5
       RETURNING espacio_id, nombre, tipo, aforo_maximo, activo`,
      [nombre.trim(), tipo.trim().toUpperCase(), Number(aforo_maximo), String(activo) !== "false", req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Espacio no encontrado" });
    res.json({ ok: "Espacio actualizado", espacio: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando espacio: ${err.message}` });
  }
});

// Elimina espacio comun por id.
app.delete("/api/espacios/:id", requirePermiso("espacio.delete"), async (req, res) => {
  try {
    // Elimina espacio por identificador.
    const result = await pool.query("DELETE FROM espacio_comun WHERE espacio_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Espacio no encontrado" });
    res.json({ ok: "Espacio eliminado" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando espacio: ${err.message}` });
  }
});

app.post("/api/reservas", requirePermiso("reserva.create"), async (req, res) => {
  try {
    const { espacio_id, unidad_id, residente_id, fecha_inicio, fecha_fin } = req.body;
    // Consulta de traslape para evitar doble reserva.
    const overlap = await pool.query(
      `SELECT 1 FROM reserva_espacio
       WHERE espacio_id = $1
         AND estado IN ('ACTIVA','APROBADA')
         AND tsrange(fecha_inicio, fecha_fin, '[)') && tsrange($2::timestamp, $3::timestamp, '[)')
       LIMIT 1`,
      [espacio_id, fecha_inicio, fecha_fin]
    );

    if (overlap.rowCount > 0) return res.status(409).json({ error: "Horario no disponible para ese espacio" });

    // Inserta reserva activa.
    await pool.query(
      `INSERT INTO reserva_espacio (espacio_id, unidad_id, residente_id, fecha_inicio, fecha_fin, estado)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVA')`,
      [espacio_id, unidad_id, residente_id, fecha_inicio, fecha_fin]
    );

    res.status(201).json({ ok: "Reserva creada correctamente" });
  } catch (err) {
    res.status(500).json({ error: `Error al crear reserva: ${err.message}` });
  }
});

app.patch("/api/reservas/:id/cancelar", requirePermiso("reserva.update"), async (req, res) => {
  try {
    // Actualiza reserva a estado CANCELADA.
    const result = await pool.query(
      `UPDATE reserva_espacio SET estado='CANCELADA'
       WHERE reserva_id = $1 AND estado IN ('ACTIVA','APROBADA')`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Reserva no encontrada o ya cancelada" });
    res.json({ ok: "Reserva cancelada" });
  } catch (err) {
    res.status(500).json({ error: `Error al cancelar reserva: ${err.message}` });
  }
});

// Actualiza campos principales de una reserva por id.
app.put("/api/reservas/:id", requirePermiso("reserva.update"), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado } = req.body;
    if (!fecha_inicio || !fecha_fin || !estado) {
      return res.status(400).json({ error: "Datos incompletos para actualizar reserva" });
    }

    // Consulta de traslape excluyendo la reserva actual.
    const overlap = await pool.query(
      `SELECT 1 FROM reserva_espacio
       WHERE reserva_id <> $1
         AND espacio_id = (SELECT espacio_id FROM reserva_espacio WHERE reserva_id = $1)
         AND estado IN ('ACTIVA','APROBADA')
         AND tsrange(fecha_inicio, fecha_fin, '[)') && tsrange($2::timestamp, $3::timestamp, '[)')
       LIMIT 1`,
      [req.params.id, fecha_inicio, fecha_fin]
    );
    if (overlap.rowCount > 0) return res.status(409).json({ error: "Horario traslapado en la reserva" });

    // Actualiza fechas y estado de la reserva.
    const result = await pool.query(
      `UPDATE reserva_espacio
       SET fecha_inicio = $1, fecha_fin = $2, estado = $3
       WHERE reserva_id = $4
       RETURNING reserva_id, fecha_inicio, fecha_fin, estado`,
      [fecha_inicio, fecha_fin, estado.trim().toUpperCase(), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Reserva no encontrada" });
    res.json({ ok: "Reserva actualizada", reserva: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando reserva: ${err.message}` });
  }
});

// Elimina una reserva por id (solo perfiles con permiso delete).
app.delete("/api/reservas/:id", requirePermiso("reserva.delete"), async (req, res) => {
  try {
    // Elimina la reserva por identificador.
    const result = await pool.query("DELETE FROM reserva_espacio WHERE reserva_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Reserva no encontrada" });
    res.json({ ok: "Reserva eliminada" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando reserva: ${err.message}` });
  }
});

app.post("/api/pqrs", requirePermiso("pqrs.create"), async (req, res) => {
  try {
    const { unidad_id, residente_id, estado_pqrs_id, asunto, descripcion } = req.body;
    // Inserta la PQRS reportada por el actor.
    await pool.query(
      `INSERT INTO pqrs (unidad_id, residente_id, estado_pqrs_id, asunto, descripcion)
       VALUES ($1, $2, $3, $4, $5)`,
      [unidad_id, residente_id, estado_pqrs_id, asunto.trim(), descripcion.trim()]
    );
    res.status(201).json({ ok: "PQRS registrada correctamente" });
  } catch (err) {
    res.status(500).json({ error: `Error al registrar PQRS: ${err.message}` });
  }
});

// Actualiza campos editables de una PQRS.
app.put("/api/pqrs/:id", requirePermiso("pqrs.update"), async (req, res) => {
  try {
    const { estado_pqrs_id, asunto, descripcion } = req.body;
    if (!estado_pqrs_id || !asunto || !descripcion) {
      return res.status(400).json({ error: "Datos incompletos para actualizar PQRS" });
    }

    // Actualiza estado, asunto y descripcion.
    const result = await pool.query(
      `UPDATE pqrs
       SET estado_pqrs_id = $1, asunto = $2, descripcion = $3
       WHERE pqrs_id = $4
       RETURNING pqrs_id, estado_pqrs_id, asunto, descripcion`,
      [estado_pqrs_id, asunto.trim(), descripcion.trim(), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "PQRS no encontrada" });
    res.json({ ok: "PQRS actualizada", pqrs: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando PQRS: ${err.message}` });
  }
});

// Elimina una PQRS por id (solo perfiles con permiso delete).
app.delete("/api/pqrs/:id", requirePermiso("pqrs.delete"), async (req, res) => {
  try {
    // Elimina la PQRS por identificador.
    const result = await pool.query("DELETE FROM pqrs WHERE pqrs_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "PQRS no encontrada" });
    res.json({ ok: "PQRS eliminada" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando PQRS: ${err.message}` });
  }
});

// Crea un registro de bitacora de acceso.
app.post("/api/bitacora-acceso", requirePermiso("bitacora.create"), async (req, res) => {
  try {
    const { unidad_id, residente_id, visitante_nombre, documento_visitante, tipo_movimiento, observacion } = req.body;
    if (!visitante_nombre || !tipo_movimiento) {
      return res.status(400).json({ error: "Datos incompletos para bitacora" });
    }
    // Inserta evento de ingreso o salida.
    const result = await pool.query(
      `INSERT INTO bitacora_acceso (unidad_id, residente_id, visitante_nombre, documento_visitante, tipo_movimiento, observacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING bitacora_id, visitante_nombre, tipo_movimiento, fecha_evento`,
      [unidad_id || null, residente_id || null, visitante_nombre.trim(), (documento_visitante || "").trim() || null, tipo_movimiento.trim().toUpperCase(), (observacion || "").trim() || null]
    );
    res.status(201).json({ ok: "Registro de bitacora creado", bitacora: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error creando bitacora: ${err.message}` });
  }
});

// Lista registros de bitacora para perfiles autorizados.
app.get("/api/bitacora-acceso", requirePermiso("bitacora.read"), async (_, res) => {
  try {
    // Consulta detallada de bitacora.
    const result = await pool.query(
      `SELECT b.bitacora_id, b.unidad_id, b.residente_id, u.torre || '-' || u.numero AS unidad,
              r.nombre_completo AS residente, b.visitante_nombre, b.documento_visitante,
              b.tipo_movimiento, b.observacion, b.fecha_evento
       FROM bitacora_acceso b
       LEFT JOIN unidad u ON u.unidad_id = b.unidad_id
       LEFT JOIN residente r ON r.residente_id = b.residente_id
       ORDER BY b.bitacora_id DESC LIMIT 100`
    );
    res.json({ bitacora: result.rows });
  } catch (err) {
    res.status(500).json({ error: `Error consultando bitacora: ${err.message}` });
  }
});

// Actualiza un registro de bitacora.
app.put("/api/bitacora-acceso/:id", requirePermiso("bitacora.update"), async (req, res) => {
  try {
    const { visitante_nombre, documento_visitante, tipo_movimiento, observacion } = req.body;
    // Actualiza campos editables del evento.
    const result = await pool.query(
      `UPDATE bitacora_acceso
       SET visitante_nombre = $1, documento_visitante = $2, tipo_movimiento = $3, observacion = $4
       WHERE bitacora_id = $5
       RETURNING bitacora_id, visitante_nombre, tipo_movimiento, observacion`,
      [visitante_nombre.trim(), (documento_visitante || "").trim() || null, tipo_movimiento.trim().toUpperCase(), (observacion || "").trim() || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Registro de bitacora no encontrado" });
    res.json({ ok: "Bitacora actualizada", bitacora: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: `Error actualizando bitacora: ${err.message}` });
  }
});

// Elimina un registro de bitacora.
app.delete("/api/bitacora-acceso/:id", requirePermiso("bitacora.delete"), async (req, res) => {
  try {
    // Elimina registro por id.
    const result = await pool.query("DELETE FROM bitacora_acceso WHERE bitacora_id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Registro de bitacora no encontrado" });
    res.json({ ok: "Bitacora eliminada" });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando bitacora: ${err.message}` });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Miniapp ejecutandose en puerto ${port}`);
});
