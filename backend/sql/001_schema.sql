-- Schema inspirado nas tabelas centrais do Mapas Culturais (agent, space, event, event_occurrence + *_meta).
-- ATENÇÃO: confira nomes/tipos contra a migration da versão do Mapas Culturais que você pretende espelhar.
-- Requer PostGIS.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Usuários do PAINEL (independentes da instância oficial)
CREATE TABLE app_user (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32) NOT NULL DEFAULT 'editor',  -- admin | editor
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- status no Mapas: 0 rascunho, 1 publicado, -1 lixeira, -2 arquivado, -5 pendente
CREATE TABLE agent (
    id                SERIAL PRIMARY KEY,
    parent_id         INTEGER REFERENCES agent(id) ON DELETE SET NULL,
    user_id           INTEGER NOT NULL REFERENCES app_user(id),
    type              SMALLINT NOT NULL DEFAULT 1,           -- 1 individual, 2 coletivo
    name              VARCHAR(255) NOT NULL,
    latitude          DOUBLE PRECISION,                       -- fonte da verdade no painel
    longitude         DOUBLE PRECISION,
    location          POINT,                                  -- (lng, lat), preenchido por trigger
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    _geo_location     GEOGRAPHY(POINT, 4326),
    short_description TEXT,
    long_description  TEXT,
    create_timestamp  TIMESTAMP NOT NULL DEFAULT now(),
    update_timestamp  TIMESTAMP,
    status            SMALLINT NOT NULL DEFAULT 1,
    is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    public_location   BOOLEAN DEFAULT TRUE
);
CREATE INDEX agent_geo_idx ON agent USING GIST (_geo_location);
CREATE INDEX agent_status_idx ON agent (status);

CREATE TABLE agent_meta (
    id        SERIAL PRIMARY KEY,
    object_id INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    key       VARCHAR(255) NOT NULL,
    value     TEXT,
    UNIQUE (object_id, key)
);
-- chaves usuais: documento, emailPublico, telefonePublico, En_CEP, En_Nome_Logradouro,
-- En_Num, En_Bairro, En_Municipio, En_Estado, site, facebook, instagram, ...

CREATE TABLE space (
    id                SERIAL PRIMARY KEY,
    parent_id         INTEGER REFERENCES space(id) ON DELETE SET NULL,
    agent_id          INTEGER NOT NULL REFERENCES agent(id),  -- responsável
    type              SMALLINT NOT NULL,
    name              VARCHAR(255) NOT NULL,
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    location          POINT,
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    _geo_location     GEOGRAPHY(POINT, 4326),
    short_description TEXT,
    long_description  TEXT,
    create_timestamp  TIMESTAMP NOT NULL DEFAULT now(),
    update_timestamp  TIMESTAMP,
    status            SMALLINT NOT NULL DEFAULT 1,
    is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    public            BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX space_geo_idx ON space USING GIST (_geo_location);

CREATE TABLE space_meta (
    id        SERIAL PRIMARY KEY,
    object_id INTEGER NOT NULL REFERENCES space(id) ON DELETE CASCADE,
    key       VARCHAR(255) NOT NULL,
    value     TEXT,
    UNIQUE (object_id, key)
);
-- chaves usuais: acessibilidade, capacidade, horario, En_CEP, En_Nome_Logradouro, En_Num, ...

CREATE TABLE event (
    id                SERIAL PRIMARY KEY,
    agent_id          INTEGER NOT NULL REFERENCES agent(id),
    type              SMALLINT NOT NULL DEFAULT 1,
    name              VARCHAR(255) NOT NULL,
    short_description TEXT,
    long_description  TEXT,
    rules             TEXT,
    create_timestamp  TIMESTAMP NOT NULL DEFAULT now(),
    update_timestamp  TIMESTAMP,
    status            SMALLINT NOT NULL DEFAULT 1,
    is_verified       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE event_occurrence (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    space_id      INTEGER NOT NULL REFERENCES space(id),
    starts_on     DATE,
    ends_on       DATE,
    starts_at     TIMESTAMP,
    ends_at       TIMESTAMP,
    frequency     VARCHAR(32),
    timezone_name VARCHAR(64) NOT NULL DEFAULT 'America/Fortaleza',
    status        SMALLINT NOT NULL DEFAULT 1
);

-- Preenche location/_geo_location (padrão Mapas) a partir de latitude/longitude
CREATE OR REPLACE FUNCTION set_geo_from_latlng() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := point(NEW.longitude, NEW.latitude);
    NEW._geo_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
    NEW._geo_location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_geo BEFORE INSERT OR UPDATE ON agent
  FOR EACH ROW EXECUTE FUNCTION set_geo_from_latlng();
CREATE TRIGGER space_geo BEFORE INSERT OR UPDATE ON space
  FOR EACH ROW EXECUTE FUNCTION set_geo_from_latlng();

-- Mantém location (POINT) e _geo_location (geography) coerentes com latitude/longitude
CREATE OR REPLACE FUNCTION fill_geo() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := point(NEW.longitude, NEW.latitude);
    NEW._geo_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
    NEW._geo_location := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER agent_fill_geo BEFORE INSERT OR UPDATE ON agent
  FOR EACH ROW EXECUTE FUNCTION fill_geo();
CREATE TRIGGER space_fill_geo BEFORE INSERT OR UPDATE ON space
  FOR EACH ROW EXECUTE FUNCTION fill_geo();

-- ===== Controle da sincronização (exclusivo deste sistema) =====

CREATE TABLE sync_target (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,      -- ex.: 'aquiraz', 'estado-ce'
    base_url    VARCHAR(255) NOT NULL,
    auth_mode   VARCHAR(32) NOT NULL DEFAULT 'bearer',
    enabled     BOOLEAN NOT NULL DEFAULT FALSE     -- só liga depois de ter autorização
);

CREATE TABLE sync_state (
    id             SERIAL PRIMARY KEY,
    target_id      INTEGER NOT NULL REFERENCES sync_target(id),
    entity_type    VARCHAR(16) NOT NULL,            -- agent | space | event
    local_id       INTEGER NOT NULL,
    remote_id      INTEGER,
    content_hash   CHAR(64),
    status         VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | synced | error
    last_error     TEXT,
    last_synced_at TIMESTAMP,
    UNIQUE (target_id, entity_type, local_id)
);

CREATE TABLE sync_log (
    id          BIGSERIAL PRIMARY KEY,
    target_id   INTEGER REFERENCES sync_target(id),
    entity_type VARCHAR(16),
    local_id    INTEGER,
    method      VARCHAR(8),
    http_status INTEGER,
    dry_run     BOOLEAN NOT NULL DEFAULT TRUE,
    message     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
