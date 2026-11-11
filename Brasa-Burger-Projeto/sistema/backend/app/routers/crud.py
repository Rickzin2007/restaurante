"""Implementa cadastro, consulta, edição e exclusão segura de recursos.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException
from sqlalchemy import text, inspect
from sqlalchemy.exc import IntegrityError
from ..database import engine, rows, run_tx as _run
from ..schemas import *

router = APIRouter()
STATUS = ["recebido", "em preparo", "pronto", "saiu para entrega", "entregue/retirado", "cancelado"]

# ---------- CRUD genérico: recurso -> (tabela, colunas permitidas) ----------
RES = {
    "clientes": ("cliente", ["nome", "telefone", "email"]),
    "enderecos": ("endereco_cliente", ["cliente_id", "logradouro", "numero", "bairro", "cidade", "cep"]),
    "categorias": ("categoria", ["nome"]),
    "produtos": ("produto", ["categoria_id", "nome", "preco_base", "ativo"]),
    "ingredientes": ("ingrediente", ["fornecedor_id", "nome", "unidade", "qtd_estoque"]),
    "fornecedores": ("fornecedor", ["nome", "telefone"]),
    "funcionarios": ("funcionario", ["nome", "cpf", "telefone"]),
    "cargos": ("cargo", ["nome"]),
    "mesas": ("mesa", ["numero"]),
    "adicionais": ("adicional", ["nome", "preco"]),
    "variacoes": ("variacao", ["produto_id", "nome", "acrescimo"]),
    "combos": ("combo", ["nome", "preco", "ativo"]),
    "promocoes": ("promocao", ["nome", "data_inicio", "data_fim"]),
    "funcionario-cargos": ("funcionario_cargo", ["funcionario_id", "cargo_id", "data_inicio", "data_fim"]),
    "cupons": ("cupom", ["codigo", "tipo", "valor", "validade_inicio", "validade_fim"]),
}


# --- _RES ---
# Valida o recurso solicitado e localiza sua tabela e campos permitidos.
def _res(name):
    if name not in RES:
        raise HTTPException(404, "Recurso inexistente")
    return RES[name]


# --- _CLEAN ---
# Filtra campos enviados pelo formulário e normaliza valores vazios.
def _clean(cols, data):
    d = {k: (None if v == "" else v) for k, v in data.items() if k in cols}
    if not d:
        raise HTTPException(422, "Nenhum campo válido informado")
    return d


# --- LISTAR ---
# Consulta registros cadastrados para exibição nas tabelas.
@router.get("/api/{res}")
def listar(res: str):
    t, _ = _res(res)
    with engine.connect() as c:
        return rows(c, f"SELECT * FROM {t} ORDER BY 1")  # t vem da whitelist RES


# --- CRIAR ---
# Cadastra um novo registro com os campos autorizados.
@router.post("/api/{res}", status_code=201)
def criar(res: str, data: dict):
    t, cols = _res(res); d = _clean(cols, data)
    sql = f"INSERT INTO {t}({','.join(d)}) VALUES({','.join(':'+k for k in d)}) RETURNING *"
    return _run(lambda c: rows(c, sql, **d)[0])


# --- EDITAR ---
# Atualiza um registro existente pelo identificador.
@router.put("/api/{res}/{id}")
def editar(res: str, id: int, data: dict):
    t, cols = _res(res); d = _clean(cols, data)
    sql = f"UPDATE {t} SET {','.join(k+'=:'+k for k in d)} WHERE id=:_id RETURNING *"
    r = _run(lambda c: rows(c, sql, _id=id, **d))
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    return r[0]


# ===== EXCLUSÃO COM PRÉVIA, CONFIRMAÇÃO E PROTEÇÃO DO HISTÓRICO =====
# Todas as dependências são encontradas pelas chaves estrangeiras reais do SQLite.
# Tabelas de histórico jamais são apagadas para permitir excluir um cadastro.
# Produtos e combos já vendidos são DESATIVADOS (exclusão lógica), não apagados.
HISTORICO = {
    "pedido", "item_pedido", "item_pedido_adicional", "pagamento",
    "pedido_status_historico", "avaliacao", "cupom_uso",
}


def _plano_exclusao(c, tabela, identificador):
    """Monta a lista de linhas dependentes, de baixo para cima, sem alterar dados."""
    inspector = inspect(engine)
    referencias = {}
    for filha in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(filha):
            origem = fk.get("constrained_columns") or []
            destino = fk.get("referred_columns") or []
            if len(origem) == 1 and destino == ["id"]:
                referencias.setdefault(fk["referred_table"], []).append((filha, origem[0]))

    plano, visitados, protegidos = [], set(), []

    def percorrer(t, rid):
        chave = (t, rid)
        if chave in visitados:
            return
        visitados.add(chave)
        if t in HISTORICO:
            protegidos.append((t, rid))
            return
        for filha, coluna in referencias.get(t, []):
            # Identificadores de tabelas e colunas provêm do esquema, não do usuário.
            ids = c.execute(text(f'SELECT rowid FROM "{filha}" WHERE "{coluna}"=:id'), {"id": rid}).scalars().all()
            for filho_id in ids:
                percorrer(filha, filho_id)
        plano.append((t, rid))

    percorrer(tabela, identificador)
    return plano, protegidos


@router.get("/api/{res}/{id}/impacto-exclusao")
def impacto_exclusao(res: str, id: int):
    """Mostra exatamente quais tabelas serão afetadas antes da confirmação."""
    tabela, _ = _res(res)
    with engine.connect() as c:
        registro = rows(c, f'SELECT * FROM "{tabela}" WHERE id=:id', id=id)
        if not registro:
            raise HTTPException(404, "Registro não encontrado")
        plano, protegidos = _plano_exclusao(c, tabela, id)
        contagem = {}
        for t, _ in plano:
            contagem[t] = contagem.get(t, 0) + 1
        modo = "excluir"
        if protegidos:
            modo = "desativar" if tabela in ("produto", "combo") else "bloqueado"
        return {
            "modo": modo,
            "registro": registro[0],
            "dependencias": [{"tabela": t, "quantidade": n} for t, n in contagem.items() if t != tabela],
            "historico_protegido": sorted(set(t for t, _ in protegidos)),
        }


@router.delete("/api/{res}/{id}", status_code=200)
def excluir(res: str, id: int, confirmar_cascata: bool = False):
    """Exclusão transacional com confirmação obrigatória para dados relacionados."""
    tabela, _ = _res(res)

    def tx(c):
        if not c.execute(text(f'SELECT 1 FROM "{tabela}" WHERE id=:id'), {"id": id}).first():
            raise HTTPException(404, "Registro não encontrado")
        plano, protegidos = _plano_exclusao(c, tabela, id)
        if protegidos:
            if tabela in ("produto", "combo"):
                if not confirmar_cascata:
                    raise HTTPException(409, "Confirme a desativação: este registro consta em pedidos históricos")
                c.execute(text(f'UPDATE "{tabela}" SET ativo=0 WHERE id=:id'), {"id": id})
                return {"modo": "desativado", "mensagem": "Registro desativado para preservar o histórico de pedidos."}
            raise HTTPException(409, "Este registro participa de pedidos ou históricos. Não pode ser excluído sem perder dados históricos.")
        if len(plano) > 1 and not confirmar_cascata:
            raise HTTPException(409, "Confirme a exclusão dos registros vinculados antes de continuar")
        for t, rid in plano:
            c.execute(text(f'DELETE FROM "{t}" WHERE rowid=:id'), {"id": rid})
        return {"modo": "excluido", "mensagem": "Registro e vínculos excluídos com sucesso."}

    return _run(tx)
