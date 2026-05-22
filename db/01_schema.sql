CREATE TABLE torre (
  torre_id SERIAL PRIMARY KEY,
  nombre VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE unidad (
  unidad_id SERIAL PRIMARY KEY,
  torre VARCHAR(20) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  area_m2 NUMERIC(8,2),
  estado_ocupacion VARCHAR(20) NOT NULL DEFAULT 'OCUPADA',
  UNIQUE (torre, numero)
);

CREATE TABLE residente (
  residente_id SERIAL PRIMARY KEY,
  nombre_completo VARCHAR(120) NOT NULL,
  documento VARCHAR(30) UNIQUE NOT NULL,
  telefono VARCHAR(30),
  email VARCHAR(120),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE unidad_residente (
  unidad_id INT NOT NULL REFERENCES unidad(unidad_id),
  residente_id INT NOT NULL REFERENCES residente(residente_id),
  rol_tenencia VARCHAR(30) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  PRIMARY KEY (unidad_id, residente_id, fecha_inicio)
);

CREATE TABLE espacio_comun (
  espacio_id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) UNIQUE NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  aforo_maximo INT NOT NULL CHECK (aforo_maximo > 0),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE reserva_espacio (
  reserva_id SERIAL PRIMARY KEY,
  espacio_id INT NOT NULL REFERENCES espacio_comun(espacio_id),
  unidad_id INT NOT NULL REFERENCES unidad(unidad_id),
  residente_id INT NOT NULL REFERENCES residente(residente_id),
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP NOT NULL,
  estado VARCHAR(20) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_reserva_espacio_horario ON reserva_espacio (espacio_id, fecha_inicio, fecha_fin);

CREATE TABLE estado_pqrs (
  estado_pqrs_id SERIAL PRIMARY KEY,
  nombre VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE pqrs (
  pqrs_id SERIAL PRIMARY KEY,
  unidad_id INT NOT NULL REFERENCES unidad(unidad_id),
  residente_id INT NOT NULL REFERENCES residente(residente_id),
  estado_pqrs_id INT NOT NULL REFERENCES estado_pqrs(estado_pqrs_id),
  asunto VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE respuesta_pqrs (
  respuesta_id SERIAL PRIMARY KEY,
  pqrs_id INT NOT NULL REFERENCES pqrs(pqrs_id) ON DELETE CASCADE,
  detalle TEXT NOT NULL,
  fecha_respuesta TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE bitacora_acceso (
  bitacora_id SERIAL PRIMARY KEY,
  unidad_id INT REFERENCES unidad(unidad_id),
  residente_id INT REFERENCES residente(residente_id),
  visitante_nombre VARCHAR(120) NOT NULL,
  documento_visitante VARCHAR(40),
  tipo_movimiento VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('INGRESO','SALIDA')),
  observacion VARCHAR(250),
  fecha_evento TIMESTAMP NOT NULL DEFAULT now()
);
