"""Valida pedidos, calcula valores, registra pagamentos e acompanha status.

Projeto Brasa Burger — Python 3.14 / FastAPI / SQLite.
"""

from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..database import engine, rows, run_tx as _run
from ..schemas import *

router = APIRouter()
STATUS = ["recebido", "em preparo", "pronto", "saiu para entrega", "entregue/retirado", "cancelado"]

# ---------- Pedidos ----------

# --- ONE ---
# Rotina one: consulte os parâmetros e a implementação abaixo.
def one(c, sql, **p):
    r = c.execute(text(sql), p).first()
    if not r:
        raise HTTPException(422, "Referência inexistente ou inativa")
    return r[0]


# --- CRIAR_PEDIDO ---
# Cria um pedido e registra seus itens e valores.
@router.post("/api/pedidos", status_code=201)
def criar_pedido(p: PedidoIn):
    def tx(c):
        subtotal, linhas = Decimal(0), []
        for it in p.itens:
            if (it.produto_id is None) == (it.combo_id is None):
                raise HTTPException(422, "Cada item deve ter produto OU combo")
            if it.combo_id:
                unit = Decimal(str(one(c, "SELECT preco FROM combo WHERE id=:i AND ativo", i=it.combo_id)))
            else:
                promo = c.execute(text("""SELECT pp.preco_promocional FROM promocao_produto pp
                    JOIN promocao pr ON pr.id=pp.promocao_id WHERE pp.produto_id=:i
                    AND CURRENT_DATE BETWEEN pr.data_inicio AND pr.data_fim
                    ORDER BY pp.preco_promocional LIMIT 1"""), {"i": it.produto_id}).first()
                unit = Decimal(str(promo[0])) if promo else Decimal(str(one(c, "SELECT preco_base FROM produto WHERE id=:i AND ativo", i=it.produto_id)))
            if it.variacao_id:
                unit += Decimal(str(one(c, "SELECT acrescimo FROM variacao WHERE id=:v AND produto_id=:p", v=it.variacao_id, p=it.produto_id)))
            adds = []
            for a in it.adicionais:
                preco = one(c, "SELECT a.preco FROM adicional a JOIN produto_adicional pa ON pa.adicional_id=a.id "
                               "WHERE a.id=:a AND pa.produto_id=:p", a=a, p=it.produto_id)
                adds.append((a, Decimal(str(preco))))
            subtotal += (unit + sum(x[1] for x in adds)) * it.quantidade
            linhas.append((it, unit, adds))
        desconto, cupom_id = Decimal(0), None
        if p.cupom_codigo:
            if not p.cliente_id:
                raise HTTPException(422, "Cupom exige cliente identificado")
            cp = c.execute(text("SELECT id,tipo,valor FROM cupom WHERE codigo=:c AND CURRENT_DATE BETWEEN validade_inicio AND validade_fim"),
                           {"c": p.cupom_codigo}).first()
            if not cp:
                raise HTTPException(422, "Cupom inválido ou fora da validade")
            if c.execute(text("SELECT 1 FROM cupom_uso WHERE cupom_id=:c AND cliente_id=:k"), {"c": cp.id, "k": p.cliente_id}).first():
                raise HTTPException(409, "Cupom já utilizado por este cliente")
            cupom_id = cp.id
            bruto = subtotal * Decimal(str(cp.valor)) / 100 if cp.tipo == "percentual" else Decimal(str(cp.valor))
            desconto = min(subtotal, bruto).quantize(Decimal("0.01"))
        total = subtotal - desconto + p.taxa_entrega
        if sum(x.valor for x in p.pagamentos) != total:
            raise HTTPException(422, f"A soma dos pagamentos deve ser igual ao total: {total}")
        pid = one(c, """INSERT INTO pedido(cliente_id,atendente_id,mesa_id,entregador_id,endereco_id,cupom_id,canal,tipo,
            taxa_entrega,desconto,total) VALUES(:cl,:at,:me,:en,:ed,:cu,:ca,:ti,:tx,:de,:to) RETURNING id""",
            cl=p.cliente_id, at=p.atendente_id, me=p.mesa_id, en=p.entregador_id, ed=p.endereco_id, cu=cupom_id,
            ca=p.canal, ti=p.tipo, tx=float(p.taxa_entrega), de=float(desconto), to=float(total))
        for it, unit, adds in linhas:
            iid = one(c, """INSERT INTO item_pedido(pedido_id,produto_id,combo_id,variacao_id,quantidade,preco_unitario,observacao)
                VALUES(:p,:pr,:co,:va,:q,:u,:o) RETURNING id""", p=pid, pr=it.produto_id, co=it.combo_id,
                va=it.variacao_id, q=it.quantidade, u=float(unit), o=it.observacao)
            for a, preco in adds:
                c.execute(text("INSERT INTO item_pedido_adicional VALUES(:i,:a,:p)"), {"i": iid, "a": a, "p": float(preco)})
        for g in p.pagamentos:
            c.execute(text("INSERT INTO pagamento(pedido_id,forma,valor) VALUES(:p,:f,:v)"), {"p": pid, "f": g.forma, "v": float(g.valor)})
        if cupom_id:
            c.execute(text("INSERT INTO cupom_uso VALUES(:c,:k,:p)"), {"c": cupom_id, "k": p.cliente_id, "p": pid})
        c.execute(text("INSERT INTO pedido_status_historico(pedido_id,status) VALUES(:p,'recebido')"), {"p": pid})
        return {"id": pid, "total": total, "desconto": desconto}
    return _run(tx)


# --- LISTAR_PEDIDOS ---
# Retorna os pedidos registrados.
@router.get("/api/pedidos")
def listar_pedidos():
    with engine.connect() as c:
        return rows(c, """SELECT p.id,p.criado_em,p.tipo,p.canal,p.total,p.status_atual,
            COALESCE(cl.nome,'Balcão (anônimo)') cliente, f.nome atendente FROM pedido p
            LEFT JOIN cliente cl ON cl.id=p.cliente_id JOIN funcionario f ON f.id=p.atendente_id ORDER BY p.id DESC""")


# --- MUDAR_STATUS ---
# Atualiza o estado do pedido e registra o histórico.
@router.put("/api/pedidos/{id}/status")
def mudar_status(id: int, s: StatusIn):
    if s.status not in STATUS:
        raise HTTPException(422, "Status inválido")
    def tx(c):
        if not c.execute(text("UPDATE pedido SET status_atual=:s WHERE id=:i"), {"s": s.status, "i": id}).rowcount:
            raise HTTPException(404, "Pedido não encontrado")
        ja = c.execute(text("SELECT 1 FROM pedido_status_historico WHERE pedido_id=:i AND status='em preparo'"), {"i": id}).first()
        c.execute(text("INSERT INTO pedido_status_historico(pedido_id,status) VALUES(:i,:s)"), {"i": id, "s": s.status})
        if s.status == "em preparo" and not ja:  # baixa o estoque uma única vez por pedido
            consumos = c.execute(text("""SELECT pi.ingrediente_id, SUM(i.quantidade*pi.quantidade*COALESCE(cp.quantidade,1)) AS q
                FROM item_pedido i LEFT JOIN combo_produto cp ON cp.combo_id=i.combo_id
                JOIN produto_ingrediente pi ON pi.produto_id=COALESCE(i.produto_id,cp.produto_id)
                WHERE i.pedido_id=:i GROUP BY pi.ingrediente_id"""), {"i": id}).all()
            for ingrediente_id, quantidade in consumos:
                c.execute(text("UPDATE ingrediente SET qtd_estoque=qtd_estoque-:q WHERE id=:id"),
                          {"q": quantidade, "id": ingrediente_id})
        return {"ok": True}
    return _run(tx)


# --- HISTORICO ---
# Consulta as alterações de status de um pedido.
@router.get("/api/pedidos/{id}/historico")
def historico(id: int):
    with engine.connect() as c:
        return rows(c, "SELECT status,alterado_em FROM pedido_status_historico WHERE pedido_id=:i ORDER BY alterado_em,id", i=id)



# --- AVALIAR ---
# Registra a avaliação de um pedido.
@router.post("/api/pedidos/{id}/avaliacao", status_code=201)
def avaliar(id: int, a: AvaliacaoIn):
    def tx(c):
        st = c.execute(text("SELECT status_atual FROM pedido WHERE id=:i"), {"i": id}).first()
        if not st:
            raise HTTPException(404, "Pedido não encontrado")
        if st[0] != "entregue/retirado":
            raise HTTPException(422, "Só é possível avaliar pedidos entregues/retirados")
        c.execute(text("INSERT INTO avaliacao(pedido_id,nota,comentario) VALUES(:i,:n,:c)"), {"i": id, "n": a.nota, "c": a.comentario})
        return {"ok": True}
    return _run(tx)


# --- LISTAR_AVALIACOES ---
# Lista as avaliações armazenadas.
@router.get("/api/avaliacoes")
def listar_avaliacoes():
    with engine.connect() as c:
        return rows(c, "SELECT pedido_id,nota,comentario,criada_em FROM avaliacao ORDER BY criada_em DESC")
