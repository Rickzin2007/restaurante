import os; os.environ["DATABASE_URL"]="postgresql+psycopg2://sabor:x@localhost:5433/sabor_cia"
from fastapi.testclient import TestClient
from app.main import app
c=TestClient(app); R=[]
def chk(nome,cond,extra=""): R.append((nome,bool(cond))); print(("PASS " if cond else "FAIL ")+nome,extra)
chk("dashboard", c.get("/api/dashboard").json()["produtos"]==3)
r=c.post("/api/clientes",json={"nome":"Teste","telefone":"6100"}); chk("CRUD criar cliente",r.status_code==201); cid=r.json()["id"]
chk("CRUD editar",c.put(f"/api/clientes/{cid}",json={"nome":"Teste2"}).json()["nome"]=="Teste2")
chk("CRUD excluir c/ FK ok",c.delete(f"/api/clientes/{cid}").status_code==204)
chk("excluir categoria em uso -> 409",c.delete("/api/categorias/1").status_code==409)
chk("recurso inexistente 404",c.get("/api/pg_user").status_code==404)
# pedido: X-Burger grande(22+6)+bacon 4 =32 x2 =64 ; cupom 10% => 57.60 ; delivery taxa 5 => 62.60
body={"cliente_id":1,"atendente_id":1,"entregador_id":2,"endereco_id":1,"canal":"aplicativo","tipo":"delivery","taxa_entrega":"5.00","cupom_codigo":"BEMVINDO10",
 "itens":[{"produto_id":1,"variacao_id":2,"quantidade":2,"adicionais":[1],"observacao":"sem cebola"}],
 "pagamentos":[{"forma":"dinheiro","valor":"30.00"},{"forma":"pix","valor":"32.60"}]}
bad=dict(body,pagamentos=[{"forma":"pix","valor":"10"}]); chk("pagamento diferente do total -> 422",c.post("/api/pedidos",json=bad).status_code==422)
r=c.post("/api/pedidos",json=body); chk("pedido delivery completo",r.status_code==201 and float(r.json()["total"])==62.60,r.text); pid=r.json()["id"]
r=c.post("/api/pedidos",json=body); chk("cupom 2ª vez -> 409",r.status_code==409,r.text)
chk("pedido sem dados de delivery barrado (CHECK)",c.post("/api/pedidos",json={"atendente_id":1,"canal":"balcao","tipo":"delivery","itens":[{"produto_id":3,"quantidade":1}],"pagamentos":[{"forma":"pix","valor":"6"}]}).status_code==409)
r=c.post("/api/pedidos",json={"atendente_id":1,"canal":"balcao","tipo":"local","mesa_id":2,"itens":[{"combo_id":1,"quantidade":1}],"pagamentos":[{"forma":"dinheiro","valor":"25"}]}); chk("balcão anônimo + combo + mesa",r.status_code==201,r.text); pid2=r.json()["id"]
chk("adicional não permitido -> 422",c.post("/api/pedidos",json={"atendente_id":1,"canal":"balcao","tipo":"retirada","itens":[{"produto_id":2,"quantidade":1,"adicionais":[1]}],"pagamentos":[{"forma":"pix","valor":"31"}]}).status_code==422)
est0={e["nome"]:float(e["qtd_estoque"]) for e in c.get("/api/relatorios/estoque").json()}
chk("status em preparo",c.put(f"/api/pedidos/{pid}/status",json={"status":"em preparo"}).status_code==200)
c.put(f"/api/pedidos/{pid}/status",json={"status":"em preparo"})
est1={e["nome"]:float(e["qtd_estoque"]) for e in c.get("/api/relatorios/estoque").json()}
chk("baixa de estoque única (2 pães)",est0["Pão de hambúrguer"]-est1["Pão de hambúrguer"]==2,str(est0["Pão de hambúrguer"]-est1["Pão de hambúrguer"]))
for s in ["pronto","saiu para entrega","entregue/retirado"]: c.put(f"/api/pedidos/{pid}/status",json={"status":s})
h=c.get(f"/api/pedidos/{pid}/historico").json(); chk("histórico preservado (6 registros)",len(h)==6,str([x["status"] for x in h]))
chk("status inválido 422",c.put(f"/api/pedidos/{pid}/status",json={"status":"x"}).status_code==422)
chk("avaliar entregue",c.post(f"/api/pedidos/{pid}/avaliacao",json={"nota":5,"comentario":"ótimo"}).status_code==201)
chk("avaliar não entregue 422",c.post(f"/api/pedidos/{pid2}/avaliacao",json={"nota":5}).status_code==422)
chk("nota inválida 422",c.post(f"/api/pedidos/{pid}/avaliacao",json={"nota":9}).status_code==422)
chk("relatório histórico cliente",len(c.get("/api/relatorios/historico-cliente/1").json())==1)
mv=c.get("/api/relatorios/mais-vendidos").json(); chk("mais vendidos",mv[0]["item"]=="X-Burger" and mv[0]["quantidade"]==2,str(mv))
ci=c.get("/api/relatorios/consumo-ingredientes?inicio=2020-01-01&fim=2999-12-31").json(); print(ci)
chk("consumo de ingredientes (combo incluso)",any(x["nome"]=="Refrigerante lata" and float(x["consumo_estimado"])==1 for x in ci))
chk("vínculo promoção",c.post("/api/promocoes",json={"nome":"Verão","data_inicio":"2026-01-01","data_fim":"2026-12-31"}).status_code==201)
chk("vincular produto à promoção",c.post("/api/vinculos/promocao-produto",json={"promocao_id":1,"produto_id":3,"preco_promocional":4}).status_code==201)
r=c.post("/api/pedidos",json={"atendente_id":1,"canal":"balcao","tipo":"retirada","itens":[{"produto_id":3,"quantidade":1}],"pagamentos":[{"forma":"pix","valor":"4"}]}); chk("preço promocional aplicado",r.status_code==201,r.text)
chk("vinculos listar",len(c.get("/api/vinculos/produto-ingrediente").json())==7)
chk("frontend servido",c.get("/").status_code==200 and "Sabor" in c.get("/").text)
print(sum(1 for _,o in R if o),"/",len(R))
