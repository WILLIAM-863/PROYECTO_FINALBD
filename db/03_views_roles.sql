CREATE OR REPLACE VIEW vw_reservas_detalle AS
SELECT r.reserva_id,
       e.nombre AS espacio,
       u.torre || '-' || u.numero AS unidad,
       rs.nombre_completo AS residente,
       r.fecha_inicio,
       r.fecha_fin,
       r.estado
FROM reserva_espacio r
JOIN espacio_comun e ON e.espacio_id = r.espacio_id
JOIN unidad u ON u.unidad_id = r.unidad_id
JOIN residente rs ON rs.residente_id = r.residente_id;

CREATE OR REPLACE VIEW vw_pqrs_detalle AS
SELECT p.pqrs_id,
       u.torre || '-' || u.numero AS unidad,
       r.nombre_completo AS residente,
       e.nombre AS estado,
       p.asunto,
       p.descripcion,
       p.fecha_registro
FROM pqrs p
JOIN unidad u ON u.unidad_id = p.unidad_id
JOIN residente r ON r.residente_id = p.residente_id
JOIN estado_pqrs e ON e.estado_pqrs_id = p.estado_pqrs_id;

CREATE OR REPLACE VIEW vw_bitacora_acceso_detalle AS
SELECT b.bitacora_id,
       u.torre || '-' || u.numero AS unidad,
       r.nombre_completo AS residente,
       b.visitante_nombre,
       b.documento_visitante,
       b.tipo_movimiento,
       b.observacion,
       b.fecha_evento
FROM bitacora_acceso b
LEFT JOIN unidad u ON u.unidad_id = b.unidad_id
LEFT JOIN residente r ON r.residente_id = b.residente_id;

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rol_admin_ph') THEN
      CREATE ROLE rol_admin_ph LOGIN PASSWORD 'admin_ph_2026';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rol_consulta_ph') THEN
      CREATE ROLE rol_consulta_ph LOGIN PASSWORD 'consulta_ph_2026';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE ph TO rol_admin_ph, rol_consulta_ph;
GRANT USAGE ON SCHEMA public TO rol_admin_ph, rol_consulta_ph;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rol_admin_ph;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rol_admin_ph;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rol_consulta_ph;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rol_admin_ph;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO rol_consulta_ph;
