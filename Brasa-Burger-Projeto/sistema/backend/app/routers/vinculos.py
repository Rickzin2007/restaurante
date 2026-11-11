"""Gerencia associações entre entidades do restaurante.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

"""Relacionamentos N:N com chave composta (receitas, combos, adicionais, promoções)."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..database import engine, rows

router = APIRouter()
# nome -> (tabela, coluna A, coluna B, coluna extra ou None)
VINC = {
    "produto-ingrediente": ("produto_ingrediente", "produto_id", "ingrediente_id", "quantidade"),
    "combo-produto": ("combo_produto", "combo_id", "produto_id", "quantidade"),
    "produto-adicional": ("produto_adicional", "produto_id", "adicional_id", None),
    "promocao-produto": ("promocao_produto", "promocao_id", "produto_id", "preco_promocional"),
}


# --- _V ---
# Valida o nome de uma relação entre tabelas.
def _v(nome):
    if nome not in VINC:
        raise HTTPException(404, "Vínculo inexistente")
    return VINC[nome]


# --- LISTAR ---
# Consulta registros cadastrados para exibição nas tabelas.
@router.get("/api/vinculos/{nome}")
def listar(nome: str):
    t, a, b, x = _v(nome)
    with engine.connect() as c:
        return rows(c, f"SELECT * FROM {t} ORDER BY {a},{b}")


# --- SALVAR ---
# Cria ou atualiza o vínculo solicitado.
@router.post("/api/vinculos/{nome}", status_code=201)
def salvar(nome: str, data: dict):
    t, a, b, x = _v(nome)
    d = {k: data.get(k) for k in (a, b, x) if k}
    if any(v in (None, "") for v in d.values()):
        raise HTTPException(422, "Preencha todos os campos")
    cols = list(d)
    sql = f"INSERT INTO {t}({','.join(cols)}) VALUES({','.join(':'+k for k in cols)})"
    sql += f" ON CONFLICT({a},{b}) DO " + (f"UPDATE SET {x}=EXCLUDED.{x}" if x else "NOTHING")
    try:
        with engine.begin() as c:
            c.execute(text(sql), d)
    except IntegrityError as e:
        raise HTTPException(409, "Violação de integridade: " + str(e.orig).split("\n")[0])
    return {"ok": True}


# --- REMOVER ---
# Desfaz um vínculo existente.
@router.post("/api/vinculos/{nome}/remover")
def remover(nome: str, data: dict):
    t, a, b, x = _v(nome)
    with engine.begin() as c:
        n = c.execute(text(f"DELETE FROM {t} WHERE {a}=:a AND {b}=:b"), {"a": data.get(a), "b": data.get(b)}).rowcount
    if not n:
        raise HTTPException(404, "Vínculo não encontrado")
    return {"ok": True}
