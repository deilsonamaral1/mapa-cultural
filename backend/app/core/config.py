from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 480
    cors_origins: str = "http://localhost:3000"

    cors_origins: str = "http://localhost:3000"

    sync_dry_run: bool = True
    sync_interval_minutes: int = 30
    sync_timeout_seconds: int = 20
    sync_max_retries: int = 3

    sync_aquiraz_base_url: str = ""
    sync_aquiraz_token: str = ""
    sync_estado_base_url: str = ""
    sync_estado_token: str = ""

    def targets(self) -> dict[str, dict[str, str]]:
        """Instâncias configuradas. Só entram as que têm URL e token."""
        raw = {
            "aquiraz": (self.sync_aquiraz_base_url, self.sync_aquiraz_token),
            "estado-ce": (self.sync_estado_base_url, self.sync_estado_token),
        }
        return {
            name: {"base_url": url.rstrip("/"), "token": token}
            for name, (url, token) in raw.items()
            if url and token
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
