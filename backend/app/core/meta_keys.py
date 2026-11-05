"""Chaves de metadados aceitas. Qualquer outra é rejeitada na API e ignorada no envio.

Importante: o mapper repassa estas chaves para a API das instâncias oficiais, então
a lista precisa ser fechada. Para liberar um campo novo, inclua-o aqui de forma consciente.
"""
AGENT_META_KEYS = frozenset({"emailPublico", "telefonePublico", "En_Municipio"})
SPACE_META_KEYS = frozenset({"acessibilidade", "capacidade", "horario"})
MAX_META_VALUE_LEN = 500
