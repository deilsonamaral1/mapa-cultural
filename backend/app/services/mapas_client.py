"""Cliente HTTP da API REST do Mapas Culturais.

Endpoints usados (padrão do Mapas Culturais; confirme na sua versão):
  POST /api/{entity}          -> cria
  PUT  /api/{entity}/{id}     -> atualiza
  GET  /api/{entity}/find     -> consulta (usado para pull / reconciliação)

AUTENTICAÇÃO: o esquema exato varia entre instâncias/versões (Bearer, OAuth2 ou o par
chave pública/privada do MapasSDK). Isolei tudo em `_auth_headers` para você ajustar
em um único lugar conforme o que o(a) administrador(a) da instância lhe entregar.
"""
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings


@dataclass
class ApiResult:
    status_code: int
    body: Any


class MapasClient:
    def __init__(self, base_url: str, token: str, auth_mode: str = "bearer"):
        s = get_settings()
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.auth_mode = auth_mode
        self.max_retries = s.sync_max_retries
        self._http = httpx.Client(timeout=s.sync_timeout_seconds, follow_redirects=False)

    def _auth_headers(self) -> dict[str, str]:
        if self.auth_mode == "bearer":
            return {"Authorization": f"Bearer {self.token}"}
        # Exemplo de ponto de extensão: assinatura do MapasSDK, header customizado etc.
        raise NotImplementedError(f"auth_mode '{self.auth_mode}' não implementado")

    def _request(self, method: str, path: str, json: dict | None = None,
                 params: dict | None = None) -> ApiResult:
        url = f"{self.base_url}{path}"
        headers = {**self._auth_headers(), "Accept": "application/json"}
        last_exc: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                r = self._http.request(method, url, json=json, params=params, headers=headers)
                # 429/5xx: retry com backoff exponencial. 4xx (exceto 429) não adianta repetir.
                if r.status_code == 429 or r.status_code >= 500:
                    time.sleep(2 ** attempt)
                    last_exc = RuntimeError(f"HTTP {r.status_code}")
                    continue
                body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
                return ApiResult(r.status_code, body)
            except httpx.TransportError as exc:
                last_exc = exc
                time.sleep(2 ** attempt)

        raise RuntimeError(f"Falha após {self.max_retries} tentativas: {last_exc}")

    def create(self, entity: str, payload: dict) -> ApiResult:
        return self._request("POST", f"/api/{entity}", json=payload)

    def update(self, entity: str, remote_id: int, payload: dict) -> ApiResult:
        return self._request("PUT", f"/api/{entity}/{remote_id}", json=payload)

    def find(self, entity: str, select: str = "id,name,updateTimestamp", limit: int = 50,
             page: int = 1) -> ApiResult:
        return self._request("GET", f"/api/{entity}/find",
                             params={"@select": select, "@limit": limit, "@page": page})

    def close(self) -> None:
        self._http.close()
