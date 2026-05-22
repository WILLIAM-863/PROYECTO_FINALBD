# Proyecto Final DB - Conjunto Residencial Mirador Central

## Stack recomendado (simple y rapido)
- Backend: Node.js + Express (MVP rapido, bajo acoplamiento)
- Base de datos: PostgreSQL 16
- Acceso a datos: SQL crudo con `pg` (sin ORM, sin query builder)
- Frontend: HTML server-rendered + CSS embebido (estetico y minimal viable)
- Contenedores: Docker + Docker Compose

## Justificacion tecnica
- Cumple la condicion de no usar librerias de abstraccion de DB.
- Facil para dos personas: una persona se enfoca en modelo/documentacion y otra en miniapp.
- Permite demostrar persistencia, reglas de negocio y trazabilidad modelo-prototipo en poco tiempo.

## Como ejecutar
1. `docker compose up --build`
2. Abrir `http://localhost:3000`
3. Healthcheck: `http://localhost:3000/health`

## Miniaplicacion implementada
Proceso: reserva de espacios comunes.
Entidades usadas: `espacio_comun`, `unidad`, `residente`, `reserva_espacio`.
Regla implementada: no permitir traslape de horarios para un mismo espacio.

## Estructura
- `db/01_schema.sql`: creacion de objetos
- `db/02_seed.sql`: datos de prueba
- `db/03_views_roles.sql`: vistas y roles
- `docs/`: entregables academicos
- `app/`: miniaplicacion
- `skill-propiedad-horizontal/`: skill auto-mejorable del proyecto

## Docker en esta maquina
Se intento instalar Docker Desktop automaticamente el 5 de mayo de 2026, pero fallo por permisos de administrador (UAC).

Ver guia: `docs/02_docker_setup.md`.
