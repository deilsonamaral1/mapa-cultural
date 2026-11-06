"""Cliente HTTP da API do Mapas Culturais, conforme o repositório de referência
(secultce/mapacultural, documentation/docs/mc_config_api.md, seção "API de Escrita").

Autenticação e codificação ficam em `mapas_auth.py` (JWT no cabeçalho `authorization`, sem
"Bearer", mais `MapasSDK-REQUEST: true`; corpo como formulário, como nos exemplos da doc).

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
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.services.mapas_auth import auth_headers, to_form


@dataclass
class ApiResult:
    status_code: int
    body: Any


class MapasClient:
    def __init__(self, base_url: str, public_key: str, private_key: str):
        s = get_settings()
        self.base_url = base_url.rstrip("/")
        self.public_key = public_key
        self.private_key = private_key
        self.max_retries = s.sync_max_retries
        # sem seguir redirecionamentos: um 3xx para a tela de login indica autenticação inativa
        self._http = httpx.Client(timeout=s.sync_timeout_seconds, follow_redirects=False)

    def _request(self, method: str, path: str, form: dict | None = None,
                 params: dict | None = None) -> ApiResult:
        url = f"{self.base_url}{path}"
        content = None
        extra = {}
        if form is not None:
            content = urlencode(to_form(form))
            extra["Content-Type"] = "application/x-www-form-urlencoded"
        last_exc: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            # token novo a cada tentativa (o campo `tm` funciona como salt)
            headers = {**auth_headers(self.public_key, self.private_key), **extra}
            try:
                r = self._http.request(method, url, content=content, params=params,
                                       headers=headers)
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
        return self._request("POST", f"/{entity}/index", form=payload)

    def update(self, entity: str, remote_id: int, payload: dict) -> ApiResult:
        return self._request("PATCH", f"/{entity}/single/{remote_id}", form=payload)

    def find(self, entity: str, select: str = "id,name,updateTimestamp", limit: int = 50,
             page: int = 1) -> ApiResult:
        return self._request("GET", f"/api/{entity}/find",
                             params={"@select": select, "@limit": limit, "@page": page})

    def close(self) -> None:
        self._http.close()
