"""Gera as listas de tipos a partir do repositório de referência (secultce/mapacultural).

Uso:
  python3 -I scripts/gen_mapas_types.py <pasta src/conf do mapacultural> <saida.py> <saida.ts>

Lê conf/space-types.php e conf/agent-types.php. Rode de novo se a referência mudar.
"""
import json
import re
import sys
from pathlib import Path

STR = r"'((?:[^'\\]|\\.)*)'"
GROUP_RE = re.compile(r"i::__\(\s*" + STR + r"\s*\)\s*=>\s*array\(\s*$")
ITEM_RE = re.compile(r"^\s*(\d+)\s*=>\s*array\(\s*'name'\s*=>\s*\\MapasCulturais\\i::__\(\s*" + STR)


def parse(path: Path) -> list[tuple[str, int, str]]:
    group, out = "Outros", []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if m := GROUP_RE.search(line):
            group = m.group(1).replace("\\'", "'")
        elif m := ITEM_RE.match(line):
            name = m.group(2).replace("\\'", "'").replace("­", "").strip()
            out.append((group, int(m.group(1)), name))
    return out


def main(conf: str, out_py: str, out_ts: str) -> None:
    conf_dir = Path(conf)
    spaces = parse(conf_dir / "space-types.php")
    agents = [(g, i, n) for g, i, n in parse(conf_dir / "agent-types.php") if i in (1, 2)]
    if not spaces or {i for _, i, _ in agents} != {1, 2}:
        sys.exit("Não consegui extrair os tipos: o formato dos arquivos mudou?")

    space_map = {i: n for _, i, n in spaces}
    space_opts = [{"value": i, "label": n, "group": g} for g, i, n in spaces]
    agent_map = {i: n for _, i, n in agents}

    def as_dict(d: dict[int, str]) -> str:
        # chaves inteiras (json.dumps as transformaria em texto)
        body = "".join(f"    {k}: {json.dumps(v, ensure_ascii=False)},\n" for k, v in d.items())
        return "{\n" + body + "}"

    Path(out_py).write_text(
        '"""GERADO por scripts/gen_mapas_types.py a partir de secultce/mapacultural. Não edite à mão."""\n'
        f"SPACE_TYPES: dict[int, str] = {as_dict(space_map)}\n\n"
        f"AGENT_TYPES: dict[int, str] = {as_dict(agent_map)}\n\n"
        'EVENT_TYPES: dict[int, str] = {1: "Padrão"}  # event-types.php define só o tipo 1\n',
        encoding="utf-8",
    )
    Path(out_ts).write_text(
        "// GERADO por backend/scripts/gen_mapas_types.py a partir de secultce/mapacultural. Não edite à mão.\n"
        "export const SPACE_TYPE_OPTIONS: { value: number; label: string; group: string }[] = "
        f"{json.dumps(space_opts, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"{len(spaces)} tipos de espaço, {len(agents)} tipos de agente")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
