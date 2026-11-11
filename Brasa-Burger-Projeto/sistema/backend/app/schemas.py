"""Define os modelos de validação das requisições da API.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

"""Schemas Pydantic (validação de entrada)."""
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# --- MODELO ITEM ---
# Define os campos e validações usados pela API.
class Item(BaseModel):
    produto_id: Optional[int] = None
    combo_id: Optional[int] = None
    variacao_id: Optional[int] = None
    quantidade: int = Field(gt=0)
    observacao: Optional[str] = None
    adicionais: list[int] = []


# --- MODELO PAGTO ---
# Define os campos e validações usados pela API.
class Pagto(BaseModel):
    forma: str
    valor: Decimal = Field(gt=0)


# --- MODELO PEDIDOIN ---
# Define os campos e validações usados pela API.
class PedidoIn(BaseModel):
    cliente_id: Optional[int] = None
    atendente_id: int
    mesa_id: Optional[int] = None
    entregador_id: Optional[int] = None
    endereco_id: Optional[int] = None
    canal: str
    tipo: str
    taxa_entrega: Decimal = Decimal(0)
    cupom_codigo: Optional[str] = None
    itens: list[Item] = Field(min_length=1)
    pagamentos: list[Pagto] = Field(min_length=1)


# --- MODELO STATUSIN ---
# Define os campos e validações usados pela API.
class StatusIn(BaseModel):
    status: str



# --- MODELO AVALIACAOIN ---
# Define os campos e validações usados pela API.
class AvaliacaoIn(BaseModel):
    nota: int = Field(ge=1, le=5)
    comentario: Optional[str] = Field(default=None, max_length=300)
