"""Cliente HTTP da API do Mapas Culturais, conforme a documentação do repositório de referência
(secultce/mapacultural, documentation/docs/mc_config_api.md, seção "API de Escrita").

Autenticação: JWT assinado (HS256) com a chave PRIVADA do App, payload {"pk": <chave pública>,
"tm": <timestamp>}. O token vai CRU no cabeçalho `authorization` (sem "Bearer"), junto com
`MapasSDK-REQUEST: true`. Um token novo é gerado a cada requisição.

Endpoints:
  POST   /{entidade}/index        cria        (entidade: agent | space | event)
  PATCH  /{entidade}/single/{id}  atualiza
  GET    /api/{entidade}/find     consulta (@select, @limit, @page)

ATENÇÃO: no código dessa versão do repositório, o gancho que ativa o JWT pelo cabeçalho
`authorization` (src/modules/Apps/Module.php) está COMENTADO. A documentação descreve o recurso,
mas é preciso confirmar com a administração de cada instância que a API de escrita está ativa
na versão que ela executa. Uma resposta 3xx/401/403 aqui costuma indicar isso.
"""
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt

from app.core.config import get_settings


@dataclass
class ApiResult:
    status_code: int
    body: Any


class MapasClient:
    def __init__(self, base_url: str, public_key: str, private_key: str, alg: str = "HS256"):
        s = get_settings()
        self.base_url = base_url.rstrip("/")
        self.public_key = public_key
        self.private_key = private_key
        self.alg = alg
        self.max_retries = s.sync_max_retries
        # sem seguir redirecionamentos: um 3xx para a tela de login indica autenticação inativa
        self._http = httpx.Client(timeout=s.sync_timeout_seconds, follow_redirects=False)

    def _auth_headers(self) -> dict[str, str]:
        token = jwt.encode({"pk": self.public_key, "tm": str(time.time())},
                           self.private_key, algorithm=self.alg)
        return {"authorization": token, "MapasSDK-REQUEST": "true"}

    def _request(self, method: str, path: str, json: dict | None = None,
                 params: dict | None = None) -> ApiResult:
        url = f"{self.base_url}{path}"
        last_exc: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            headers = {**self._auth_headers(), "Accept": "application/json"}
            try:
                r = self._http.request(method, url, json=json, params=params, headers=headers)
                # 429/5xx: retry com backoff exponencial. 4xx (exceto 429) não adianta repetir.
                if r.status_code == 429 or r.status_code >= 500:
                    time.sleep(2 ** attempt)
                    last_exc = RuntimeError(f"HTTP {r.status_code}")
                    continue
                ctype = r.headers.get("content-type", "")
                body = r.json() if ctype.startswith("application/json") else r.text
                return ApiResult(r.status_code, body)
            except httpx.TransportError as exc:
                last_exc = exc
                time.sleep(2 ** attempt)

        raise RuntimeError(f"Falha após {self.max_retries} tentativas: {last_exc}")

    def create(self, entity: str, payload: dict) -> ApiResult:
        return self._request("POST", f"/{entity}/index", json=payload)

    def update(self, entity: str, remote_id: int, payload: dict) -> ApiResult:
        return self._request("PATCH", f"/{entity}/single/{remote_id}", json=payload)

    def find(self, entity: str, select: str = "id,name,updateTimestamp", limit: int = 50,
             page: int = 1) -> ApiResult:
        return self._request("GET", f"/api/{entity}/find",
                             params={"@select": select, "@limit": limit, "@page": page})

    def close(self) -> None:
        self._http.close()
