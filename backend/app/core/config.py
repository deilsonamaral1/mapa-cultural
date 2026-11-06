from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 480
    cors_origins: str = "http://localhost:3000"

    sync_dry_run: bool = True
    sync_interval_minutes: int = 30
    sync_timeout_seconds: int = 20
    sync_max_retries: int = 3

    # A API de escrita do Mapas Culturais usa um "App" (Painel > Meus Apps): chave pública + privada.
    sync_aquiraz_base_url: str = ""
    sync_aquiraz_public_key: str = ""
    sync_aquiraz_private_key: str = ""
    sync_estado_base_url: str = ""
    sync_estado_public_key: str = ""
    sync_estado_private_key: str = ""

    def targets(self) -> dict[str, dict[str, str]]:
        """Instâncias configuradas. Só entram as que têm URL e as duas chaves."""
        raw = {
            "aquiraz": (self.sync_aquiraz_base_url, self.sync_aquiraz_public_key,
                        self.sync_aquiraz_private_key),
            "estado-ce": (self.sync_estado_base_url, self.sync_estado_public_key,
                          self.sync_estado_private_key),
        }
        return {
            name: {"base_url": url.rstrip("/"), "public_key": pub, "private_key": priv}
            for name, (url, pub, priv) in raw.items()
            if url and pub and priv
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
