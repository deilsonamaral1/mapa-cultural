"""Autenticação e codificação de requisições da API de escrita do Mapas Culturais.

Esquema documentado em documentation/docs/mc_config_api.md do repositório de referência
e implementado em src/modules/Apps/JWTAuthProvider.php:
  - JWT HS256 (também aceita HS384/HS512/RS256), payload {"pk": <chave pública>, "tm": <salt>}
  - assinado com a chave PRIVADA do aplicativo ("Meus aplicativos" no painel do Mapas)
  - enviado no header `authorization` (sem prefixo "Bearer") + `MapasSDK-REQUEST: true`

Este módulo não importa nada do app para poder ser testado isoladamente.
"""
import time

import jwt


def build_token(public_key: str, private_key: str, max_tries: int = 50) -> str:
    """Gera o JWT do MapasSDK.

    O servidor lê o payload com `json_decode(base64_decode(...))` do PHP em modo não estrito,
    que DESCARTA os caracteres '-' e '_' do base64url. Se o payload os contiver, o `pk` some e
    a resposta é 401. Por isso repetimos com outro `tm` (salt) até o payload ficar sem eles.
    """
    for _ in range(max_tries):
        token = jwt.encode(
            {"pk": public_key, "tm": f"{time.time():.4f}"}, private_key, algorithm="HS256")
        payload_b64 = token.split(".")[1]
        if "-" not in payload_b64 and "_" not in payload_b64:
            return token
        time.sleep(0.002)  # muda o timestamp
    raise RuntimeError("Não foi possível gerar um JWT compatível com o servidor")


def auth_headers(public_key: str, private_key: str) -> dict[str, str]:
    return {
        "authorization": build_token(public_key, private_key),
        "MapasSDK-REQUEST": "true",
        "Accept": "application/json",
    }


def to_form(payload: dict) -> list[tuple[str, str]]:
    """Codifica o payload como formulário (o que a doc usa: `$curl->post($url, $data)`).

    Dicionários viram `campo[chave]=valor` (o PHP remonta o array); booleanos viram "1"/"0";
    valores None são omitidos.
    """
    out: list[tuple[str, str]] = []
    for key, value in payload.items():
        if value is None:
            continue
        if isinstance(value, dict):
            out.extend((f"{key}[{k}]", str(v)) for k, v in value.items() if v is not None)
        elif isinstance(value, (list, tuple)):
            # `location => [lng, lat]` vira location[0]=lng&location[1]=lat (como o curl do PHP)
            out.extend((f"{key}[{i}]", str(v)) for i, v in enumerate(value) if v is not None)
        elif isinstance(value, bool):
            out.append((key, "1" if value else "0"))
        else:
            out.append((key, str(value)))
    return out
