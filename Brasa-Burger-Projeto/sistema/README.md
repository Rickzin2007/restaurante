# Brasa Burger

Sistema administrativo de hamburgueria com frontend HTML/CSS/JavaScript, API FastAPI e SQLite.

## Executar no Windows (Python 3.14)

Abra `sistema/INICIAR_WINDOWS.bat`. O banco `sistema/sabor_cia.db` é criado automaticamente na primeira execução. Acesse http://127.0.0.1:8000.

## Estrutura

- `frontend/`: interface, estilos, scripts e imagens.
- `backend/app/`: servidor, conexão com o banco e rotas.
- `backend/requirements.txt`: dependências Python.
- `db/init_sqlite.sql`: estrutura e dados iniciais do banco.
- `backend/tests/`: testes automatizados existentes.
- `../documentacao/`: materiais da atividade (MER, DER, dicionário e relatório).

**Atenção:** não apague o arquivo `sabor_cia.db` depois de começar a cadastrar dados. O script de inicialização instala dependências quando necessário.

## Onde alterar cada parte

- **Menus, telas, botões e formulários:** `frontend/js/app.js` (procure os títulos `===== ... =====`).
- **Cores, espaçamentos e aparência:** `frontend/css/style.css`.
- **Estrutura HTML:** `frontend/index.html`.
- **Cadastros e exclusão:** `backend/app/routers/crud.py` (dicionário `RES` e função `excluir`).
- **Pedidos:** `backend/app/routers/pedidos.py`.
- **Relatórios e dashboard:** `backend/app/routers/relatorios.py`.
- **Vínculos entre registros:** `backend/app/routers/vinculos.py`.
- **Conexão e criação do banco:** `backend/app/database.py` e `db/init_sqlite.sql`.

**Exclusão:** esta versão apenas organiza e comenta o código. A regra atual de proteção de registros vinculados permanece ativa; excluir um fornecedor com ingredientes associados continuará retornando erro 409 até que os vínculos sejam alterados.
