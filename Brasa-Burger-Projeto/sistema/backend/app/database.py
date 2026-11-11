"""Configura SQLite, integridade referencial, criação inicial do banco e transações.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

"""Banco local SQLite. Cria e popula o banco na primeira execução."""
from pathlib import Path
import sqlite3
from sqlalchemy import create_engine, text, event
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

BASE = Path(__file__).resolve().parents[2]
DB_PATH = BASE / "sabor_cia.db"
engine = create_engine(f"sqlite:///{DB_PATH.as_posix()}", connect_args={"check_same_thread": False}, pool_pre_ping=True)


# --- CONFIGURE_SQLITE ---
# Ativa as configurações necessárias para cada conexão SQLite.
@event.listens_for(engine, "connect")
def configure_sqlite(dbapi_connection, connection_record):
    dbapi_connection.execute("PRAGMA foreign_keys=ON")
    dbapi_connection.execute("PRAGMA busy_timeout=3000")



# --- INIT_DB ---
# Inicializa a estrutura do banco de dados quando necessário.
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys=ON")
        existing = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cliente'").fetchone()
        if not existing:
            sql = (BASE / "db" / "init_sqlite.sql").read_text(encoding="utf-8")
            conn.executescript(sql)

init_db()


# --- ROWS ---
# Executa uma consulta e devolve os resultados em formato JSON compatível.
def rows(conn, sql, **p):
    return [dict(r._mapping) for r in conn.execute(text(sql), p)]


# --- RUN_TX ---
# Executa operações de escrita dentro de uma transação.
def run_tx(fn):
    try:
        with engine.begin() as c:
            return fn(c)
    except IntegrityError as e:
        raise HTTPException(409, "Violação de integridade: " + str(e.orig).split("\n")[0])
