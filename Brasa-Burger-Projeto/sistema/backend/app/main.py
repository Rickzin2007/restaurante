"""Cria a aplicação FastAPI, registra as rotas da API e publica o frontend.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

"""Ponto de entrada. Rotas fixas (relatórios, pedidos) são registradas antes do CRUD genérico."""
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routers import relatorios, pedidos, vinculos, crud

app = FastAPI(title="Sabor & Cia API")
app.include_router(relatorios.router)
app.include_router(pedidos.router)
app.include_router(vinculos.router)
app.include_router(crud.router)
app.mount("/", StaticFiles(directory=str(Path(__file__).resolve().parents[2] / "frontend"), html=True), name="frontend")
