"""Disponibiliza consultas e indicadores usados nos relatórios.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..database import engine, rows
from ..schemas import *

router = APIRouter()
STATUS = ["recebido", "em preparo", "pronto", "saiu para entrega", "entregue/retirado", "cancelado"]

# ---------- Relatórios e dashboard (rotas fixas antes das genéricas) ----------

# --- DASHBOARD ---
# Reúne os indicadores exibidos no painel inicial.
@router.get("/api/dashboard")
def dashboard():
    with engine.connect() as c:
        return rows(c, """SELECT (SELECT count(*) FROM pedido) pedidos,
            (SELECT count(*) FROM produto) produtos,
            (SELECT count(*) FROM pedido WHERE status_atual='em preparo') em_preparo,
            (SELECT COALESCE(sum(total),0) FROM pedido WHERE status_atual<>'cancelado') faturamento""")[0]


# --- REL_CLIENTE ---
# Consulta o histórico de pedidos de um cliente.
@router.get("/api/relatorios/historico-cliente/{id}")
def rel_cliente(id: int):  # 1:N cliente -> pedidos
    with engine.connect() as c:
        return rows(c, "SELECT id,criado_em,tipo,total,status_atual FROM pedido WHERE cliente_id=:i ORDER BY criado_em DESC", i=id)


# --- REL_VENDIDOS ---
# Calcula os produtos mais vendidos no intervalo informado.
@router.get("/api/relatorios/mais-vendidos")
def rel_vendidos(inicio: date = date(2000, 1, 1), fim: date = date(2999, 1, 1)):
    with engine.connect() as c:
        return rows(c, """SELECT COALESCE(pr.nome,'[Combo] '||co.nome) item, SUM(i.quantidade) quantidade,
            SUM(i.quantidade*i.preco_unitario) receita FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id
            LEFT JOIN produto pr ON pr.id=i.produto_id LEFT JOIN combo co ON co.id=i.combo_id
            WHERE p.status_atual<>'cancelado' AND date(p.criado_em) BETWEEN :a AND :b
            GROUP BY 1 ORDER BY 2 DESC""", a=inicio.isoformat(), b=fim.isoformat())


# --- REL_CONSUMO ---
# Calcula o consumo de ingredientes no período.
@router.get("/api/relatorios/consumo-ingredientes")
def rel_consumo(inicio: date = date(2000, 1, 1), fim: date = date(2999, 1, 1)):  # N:N produto<->ingrediente
    with engine.connect() as c:
        return rows(c, """SELECT g.nome, g.unidade, SUM(i.quantidade*pi.quantidade*COALESCE(cp.quantidade,1)) consumo_estimado
            FROM item_pedido i JOIN pedido p ON p.id=i.pedido_id
            LEFT JOIN combo_produto cp ON cp.combo_id=i.combo_id
            JOIN produto_ingrediente pi ON pi.produto_id=COALESCE(i.produto_id,cp.produto_id)
            JOIN ingrediente g ON g.id=pi.ingrediente_id
            WHERE p.status_atual<>'cancelado' AND date(p.criado_em) BETWEEN :a AND :b
            GROUP BY g.nome,g.unidade ORDER BY 3 DESC""", a=inicio.isoformat(), b=fim.isoformat())


# --- REL_ESTOQUE ---
# Consulta os saldos de estoque.
@router.get("/api/relatorios/estoque")
def rel_estoque():
    with engine.connect() as c:
        return rows(c, """SELECT g.nome,g.unidade,g.qtd_estoque,f.nome fornecedor FROM ingrediente g
            JOIN fornecedor f ON f.id=g.fornecedor_id ORDER BY g.nome""")

