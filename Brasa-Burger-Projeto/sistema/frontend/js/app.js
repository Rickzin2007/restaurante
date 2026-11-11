/*
 * BRASA BURGER — INTERFACE ADMINISTRATIVA
 * Navegação, renderização de telas, chamadas à API FastAPI e formulários CRUD.
 * As operações persistentes usam /api/...; não substitua por dados fictícios.
 * Backend: sistema/backend/app/ | Banco: sistema/sabor_cia.db (criado ao iniciar).
 */

// ============================================================
// 1. UTILITÁRIOS E ESTADO DA INTERFACE
// ============================================================
const $ = s => document.querySelector(s);
let telaAtual='dash';
const statusClass = s => String(s||'').includes('cancel')?'bad':String(s||'').includes('entreg')?'good':String(s||'').includes('preparo')?'working':'neutral';
const brl = v => Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const dt = v => v ? new Date(v).toLocaleString('pt-BR') : '';

// ===== AVISO =====
// Exibe mensagens de sucesso ou erro na interface.
function aviso(t, ok=true){ $('#msg').innerHTML=`<div class="${ok?'ok':'err'}"></div>`; $('#msg div').textContent=t; }

// ===== API =====
// Centraliza as requisições HTTP ao backend e o indicador de carregamento.
async function api(url, method='GET', body){
  $('#load').hidden=false;
  try{
    const r = await fetch('/api/'+url, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined});
    if(r.status===204) return null;
    const j = await r.json();
    if(!r.ok) throw new Error(typeof j.detail==='string' ? j.detail : JSON.stringify(j.detail));
    return j;
  } finally { $('#load').hidden=true; }
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ===== TABELA =====
// Monta tabelas HTML e seus botões de ação.
function tabela(cols, data, acoes){
  if(!data.length) return '<p>Nenhum registro. Use o formulário para cadastrar.</p>';
  return `<div class="wrap"><table><tr>${cols.map(c=>`<th>${c}</th>`).join('')}${acoes?'<th>Ações</th>':''}</tr>`+
    data.map((r,i)=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}${acoes?`<td>${acoes(r,i)}</td>`:''}</tr>`).join('')+'</table></div>';
}
// ---- CRUD: campos [nome, rótulo, tipo, (opcional) recurso para <select>]
// ============================================================
// 2. CONFIGURAÇÃO DOS CADASTROS E CAMPOS
// ============================================================
const CRUD = {
  clientes:{t:'Clientes',f:[['nome','Nome','text'],['telefone','Telefone','text'],['email','E-mail','email']]},
  enderecos:{t:'Endereços',f:[['cliente_id','Cliente','sel','clientes'],['logradouro','Rua','text'],['numero','Número','text'],['bairro','Bairro','text'],['cidade','Cidade','text'],['cep','CEP','text']]},
  categorias:{t:'Categorias',f:[['nome','Nome','text']]},
  produtos:{t:'Produtos',f:[['categoria_id','Categoria','sel','categorias'],['nome','Nome','text'],['preco_base','Preço base','number'],['ativo','Ativo','bool']]},
  combos:{t:'Combos',f:[['nome','Nome','text'],['preco','Preço promocional','number'],['ativo','Ativo','bool']]},
  ingredientes:{t:'Ingredientes',f:[['fornecedor_id','Fornecedor','sel','fornecedores'],['nome','Nome','text'],['unidade','Unidade (kg, l, un)','text'],['qtd_estoque','Estoque','number']]},
  fornecedores:{t:'Fornecedores',f:[['nome','Nome','text'],['telefone','Telefone','text']]},
  funcionarios:{t:'Funcionários',f:[['nome','Nome','text'],['cpf','CPF (11 dígitos)','text'],['telefone','Telefone','text']]},
  promocoes:{t:'Promoções',f:[['nome','Nome','text'],['data_inicio','Início','date'],['data_fim','Fim','date']]},
  'funcionario-cargos':{t:'Cargos por período',f:[['funcionario_id','Funcionário','sel','funcionarios'],['cargo_id','Cargo','sel','cargos'],['data_inicio','Início','date'],['data_fim','Fim (vazio = atual)','date']]},
  cupons:{t:'Cupons',f:[['codigo','Código','text'],['tipo','Tipo (valor/percentual)','text'],['valor','Valor','number'],['validade_inicio','Início','date'],['validade_fim','Fim','date']]},
};
// ============================================================
// 3. MENU LATERAL E NAVEGAÇÃO
// ============================================================
const MENU = [['dash','Dashboard'],['pedidos','Pedidos'],['rel','Relatórios'],['vinc','Receitas e combos'],...Object.entries(CRUD).map(([k,v])=>[k,v.t])];
const ICONES = {dash:'⌂',pedidos:'▤',novo:'＋',rel:'▥',vinc:'⇄',clientes:'♙',enderecos:'⌖',categorias:'▦',produtos:'☰',combos:'◫',ingredientes:'◉',fornecedores:'▣',funcionarios:'♧',promocoes:'✦','funcionario-cargos':'♧',cupons:'◇'};
$('#nav').innerHTML = MENU.map(([k,t],i)=>`${i===5?'<div class="nav-divider"></div>':''}<button data-k="${k}" title="${t}" aria-label="${t}"><span class="nav-icon" aria-hidden="true">${ICONES[k]||'•'}</span><span class="nav-label">${t}</span></button>`).join('');
$('#nav').onclick = e => { const b=e.target.closest('button[data-k]'); if(b) ir(b.dataset.k); };
// A ação principal acompanha a seção aberta, sem botões globais de novo pedido.
const NOMES_ACAO = {clientes:'Adicionar cliente',enderecos:'Adicionar endereço',categorias:'Nova categoria',produtos:'Adicionar produto',combos:'Novo combo',ingredientes:'Adicionar ingrediente',fornecedores:'Adicionar fornecedor',funcionarios:'Adicionar funcionário',promocoes:'Nova promoção','funcionario-cargos':'Vincular cargo',cupons:'Novo cupom',pedidos:'Novo pedido'};

// ===== CONFIGURARACAOCONTEXTUAL =====
// Mostra o botão de cadastro somente nas telas que precisam dele.
function configurarAcaoContextual(k){
  const b=$('#context-action'); if(!b) return;
  b.hidden=!NOMES_ACAO[k];
  if(!NOMES_ACAO[k]) {b.onclick=null;return;}
  b.textContent='＋ '+NOMES_ACAO[k];
  b.onclick=()=>{
    if(k==='pedidos'){ir('novo');return;}
    const form=$('#f');if(!form)return;
    form.hidden=false;
    form.scrollIntoView({behavior:'smooth',block:'start'});
    const first=form.querySelector('input,select');if(first)first.focus({preventScroll:true});
  };
}

// ===== IR =====
// Controla a navegação entre as telas sem recarregar a página.
async function ir(k){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
  telaAtual=k; $('#titulo').textContent = (MENU.find(m=>m[0]===k)||['',k])[1]; $('#msg').innerHTML=''; document.body.dataset.page=k; configurarAcaoContextual(k); 
  try{ await ({dash,pedidos,novo,rel,vinc}[k] || (()=>crud(k)))(k); }catch(e){ aviso(e.message,false); }
}

// ===== DASH =====
// Renderiza os indicadores e o resumo do dashboard.
async function dash(){
  const d = await api('dashboard');
  const stats = [
    ['Pedidos registrados', d.pedidos, '▤', 'yellow'],
    ['Produtos no cardápio', d.produtos, '☷', 'green'],
    ['Pedidos em preparo', d.em_preparo, '◷', 'pink'],
    ['Faturamento registrado', brl(d.faturamento), '＄', 'peach']
  ];
  $('#view').innerHTML = `<div class="kpi-band">${stats.map(([label,value,icon,color])=>`<article class="kpi ${color}"><span class="kpi-icon">${icon}</span><span class="kpi-copy"><small>${label}</small><strong>${esc(value)}</strong></span></article>`).join('')}</div>
  <div class="dashboard-grid"><section class="panel chart-panel"><div class="panel-head"><div><h3>Faturamento — últimos 6 meses</h3><p>Valores dos pedidos registrados</p></div><span class="panel-chip">Últimos 6 meses</span></div><div id="revenue-chart" class="chart-placeholder">Carregando histórico…</div></section>
  <section class="panel donut-panel"><div class="panel-head"><div><h3>Status dos pedidos</h3><p>Distribuição atual</p></div></div><div id="status-chart" class="donut-placeholder">Carregando…</div></section>
  <section class="panel orders-panel"><div class="panel-head"><div><h3>Pedidos recentes</h3><p>Últimas movimentações</p></div><button class="panel-link" id="see-orders" type="button">Ver pedidos →</button></div><div id="recent-orders">Carregando pedidos…</div></section>
  <section class="panel insight-panel"><div class="panel-head"><div><h3>Operação em números</h3><p>Indicadores em tempo real</p></div></div><div id="order-summary" class="summary-content">Carregando…</div></section></div>`;
  $('#see-orders').onclick = () => ir('pedidos');
  try {
    const orders = await api('pedidos');
    const recent = [...orders].sort((a,b)=>new Date(b.criado_em||0)-new Date(a.criado_em||0)).slice(0,6);
    $('#recent-orders').innerHTML = recent.length ? `<div class="wrap dashboard-table"><table><thead><tr><th>Pedido</th><th>Tipo</th><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>${recent.map(o=>`<tr><td><b>#${esc(o.id)}</b></td><td>${esc(o.tipo||'—')}</td><td>${esc(o.criado_em?new Date(o.criado_em).toLocaleDateString('pt-BR'):'—')}</td><td><span class="status-badge ${String(o.status_atual||'').includes('cancel')?'bad':String(o.status_atual||'').includes('entreg')?'good':'neutral'}">${esc(o.status_atual||'—')}</span></td><td><b>${brl(o.total||0)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-note">Nenhum pedido registrado ainda.</p>';
    const counts = {};
    for (const o of orders) { const k=o.status_atual||'Sem status'; counts[k]=(counts[k]||0)+1; }
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const palette=['#ff6a20','#a83f17','#ffc6a6','#ffe4d4','#8bcdb0','#bca7ed'];
    const total=orders.length;
    if (!total) $('#status-chart').innerHTML='<p class="empty-note">Os status aparecerão quando houver pedidos.</p>';
    else {
      let pos=0;const stops=entries.map(([k,n],i)=>{const from=pos;pos+=n/total*100;return `${palette[i%palette.length]} ${from}% ${pos}%`;}).join(',');
      $('#status-chart').innerHTML=`<div class="donut" style="background:conic-gradient(${stops})"><div class="donut-center"><strong>${total}</strong><small>pedidos</small></div></div><div class="legend">${entries.map(([k,n],i)=>`<div><i style="background:${palette[i%palette.length]}"></i><span>${esc(k)}</span><b>${n}</b></div>`).join('')}</div>`;
    }
    const now = new Date(); const months = Array.from({length:6},(_,i)=>{const date=new Date(now.getFullYear(),now.getMonth()-5+i,1);return {year:date.getFullYear(),month:date.getMonth(),label:date.toLocaleDateString('pt-BR',{month:'short'})};});
    const vals=months.map(m=>orders.reduce((sum,o)=>{const date=new Date(o.criado_em);return sum+(date.getFullYear()===m.year&&date.getMonth()===m.month?Number(o.total||0):0);},0));
    const max=Math.max(...vals,1); const W=700,H=270, pad=40,base=H-35,step=(W-2*pad)/5;
    const points=vals.map((v,i)=>`${pad+i*step},${base-(v/max)*(H-80)}`).join(' ');
    const grid=[0,.25,.5,.75,1].map(t=>{const y=base-t*(H-80);return `<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="#edf0ef"/><text x="${pad-9}" y="${y+4}" text-anchor="end" font-size="10" fill="#a1a1aa">${Math.round(max*t)}</text>`;}).join('');
    $('#revenue-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de faturamento mensal" preserveAspectRatio="xMidYMid meet">${grid}<polygon points="${pad},${base} ${points} ${W-pad},${base}" fill="#fff0e8" opacity=".7"/><polyline points="${points}" fill="none" stroke="#ff6a20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${vals.map((v,i)=>`<circle cx="${pad+i*step}" cy="${base-(v/max)*(H-80)}" r="4.5" fill="#ff6a20" stroke="white" stroke-width="2"><title>${months[i].label}: ${brl(v)}</title></circle><text x="${pad+i*step}" y="${H-12}" text-anchor="middle" font-size="12" fill="#737373">${months[i].label}</text>`).join('')}</svg>`;
    const finished=orders.filter(o=>String(o.status_atual||'').includes('entreg')).length;
    $('#order-summary').innerHTML=`<div class="summary-row"><span>Pedidos registrados</span><strong>${total}</strong></div><div class="summary-row"><span>Concluídos / entregues</span><strong>${finished}</strong></div><div class="summary-row"><span>Em preparo</span><strong>${d.em_preparo}</strong></div><div class="summary-row"><span>Produtos no cardápio</span><strong>${d.produtos}</strong></div><div class="progress-track"><span style="width:${total?finished/total*100:0}%"></span></div><p class="summary-caption">${total?Math.round(finished/total*100):0}% dos pedidos concluídos</p>`;
  } catch(e) {
    for(const id of ['revenue-chart','status-chart','recent-orders','order-summary']) {const el=document.getElementById(id);if(el)el.innerHTML='<p class="empty-note">Não foi possível carregar estes dados.</p>';}
    aviso('Indicadores básicos carregados. Detalhes de pedidos: '+e.message,false);
  }
}

// ===== CRUD =====
// Lista, cadastra, edita e exclui os registros das telas de gestão.
async function crud(k){
  const {f} = CRUD[k]; const data = await api(k); let editId = null;
  const opts = {}; for(const x of f) if(x[2]==='sel') opts[x[3]] = await api(x[3]);
  const campo = ([n,l,t,r]) => t==='sel' ? `<label>${l}<select name="${n}" required>${opts[r].map(o=>`<option value="${o.id}">${esc(o.nome||o.id)}</option>`).join('')}</select></label>`
    : t==='bool' ? `<label>${l}<select name="${n}"><option value="true">Sim</option><option value="false">Não</option></select></label>`
    : `<label>${l}<input name="${n}" type="${t}" ${t==='number'?'step="0.01"':''} ${n==='email'||n==='telefone'||n==='cep'?'':'required'}></label>`;
  $('#view').innerHTML = `<div class="section-intro"><div><h2>Gerenciar ${esc(CRUD[k].t.toLowerCase())}</h2><p>Consulte os registros e utilize o botão acima para adicionar um novo.</p></div></div><form id="f" hidden>${f.map(campo).join('')}<button class="btn">Salvar</button><button type="button" class="btn sec" id="cancel">Limpar</button></form>`+
    tabela(['id',...f.map(x=>x[0])], data, r=>`<button class="btn sm" data-e="${r.id}">Editar</button> <button class="btn sm sec" data-d="${r.id}">Excluir</button>`);
  const form = $('#f');
  $('#cancel').onclick = () => { form.reset(); editId=null; form.hidden=true; };
  form.onsubmit = async e => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(form));
    for(const x of f){ if(x[2]==='bool') body[x[0]] = body[x[0]]==='true'; }
    try{ await api(k+(editId?'/'+editId:''), editId?'PUT':'POST', body); aviso('Registro salvo.'); await crud(k); }catch(err){ aviso(err.message,false); }
  };
  $('#view').onclick = async e => {
    const b = e.target;
    if(b.dataset.e){ const r = data.find(x=>x.id==b.dataset.e); editId = r.id; form.hidden=false; for(const [n] of f) if(form[n]) form[n].value = r[n] ?? ''; form.scrollIntoView(); }
    if(b.dataset.d){
      const registro = data.find(x=>String(x.id)===String(b.dataset.d));
      const nome = registro?.nome || registro?.codigo || `#${b.dataset.d}`;
      let enderecoExclusao = k+'/'+b.dataset.d;
      try {
        // Consulta o backend: nenhum vínculo é removido sem prévia e confirmação.
        const impacto = await api(`${enderecoExclusao}/impacto-exclusao`);
        const detalhes = impacto.dependencias.map(x => `• ${x.tabela}: ${x.quantidade} registro(s)`).join('\n');
        if (impacto.modo === 'bloqueado') {
          aviso(`Não é possível excluir ${nome}: existem referências em histórico (${impacto.historico_protegido.join(', ')}).`, false);
          return;
        }
        const desativar = impacto.modo === 'desativar';
        const mensagem = desativar
          ? `${nome} já aparece em pedidos. Para preservar o histórico, ele será DESATIVADO, não apagado.\n\nConfirmar?`
          : `Excluir ${nome}${detalhes ? ' e os vínculos abaixo' : ''}?\n\n${detalhes}\n\nEsta ação não pode ser desfeita. Os históricos de pedidos serão preservados.`;
        if (!confirm(mensagem)) return;
        const resultado = await api(enderecoExclusao+'?confirmar_cascata=true', 'DELETE');
        await crud(k);
        aviso(resultado.mensagem || `${nome} excluído com sucesso.`);
      } catch(err) {
        aviso(err.message,false);
      }
    }
  };
}
const STATUS=['recebido','em preparo','pronto','saiu para entrega','entregue/retirado','cancelado'];
let pedidosCache=[];

// ===== EXPORTARCSV =====
// Prepara a exportação dos dados da tabela.
function exportarCSV(registros){
  const cols=['id','criado_em','cliente','atendente','tipo','status_atual','total'];
  const linhas=[cols.join(';'),...registros.map(r=>cols.map(c=>'"'+String(r[c]??'').replaceAll('"','""')+'"').join(';'))];
  const blob=new Blob(['\ufeff'+linhas.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pedidos-brasa-burger.csv';a.click();URL.revokeObjectURL(url);
}

// ===== PEDIDOS =====
// Lista os pedidos e suas ações.
async function pedidos(){
  const d = await api('pedidos'); pedidosCache=d;
  const counts={}; STATUS.forEach(x=>counts[x]=0); d.forEach(o=>counts[o.status_atual]=(counts[o.status_atual]||0)+1);
  const receita=d.filter(o=>o.status_atual!=='cancelado').reduce((n,o)=>n+Number(o.total||0),0);
  const pending=(counts['recebido']||0)+(counts['em preparo']||0);
  $('#view').innerHTML=`<div class="page-intro"><div><div class="eyebrow">GESTÃO DE PEDIDOS</div><h2>Todos os pedidos</h2><p>Acompanhe, filtre e gerencie cada atendimento.</p></div><div class="page-actions"><button class="btn sec" id="export-orders">↓ Exportar CSV</button></div></div>
  <div class="order-kpis">
  ${[['Total de pedidos',d.length,'▤','sand'],['Faturamento',brl(receita),'＄','mint'],['Pendentes',pending,'◷','cream'],['Concluídos',counts['entregue/retirado']||0,'✓','mint'],['Cancelados',counts.cancelado||0,'×','rose']].map(([l,v,i,c])=>`<article class="order-kpi"><div><small>${l}</small><strong>${v}</strong></div><span class="order-kpi-icon ${c}">${i}</span></article>`).join('')}
  </div><section class="panel order-board"><div class="filter-bar"><label class="search-field"><span>⌕</span><input id="order-search" placeholder="Buscar por pedido, cliente ou atendente..." aria-label="Buscar pedidos"></label><select id="order-type" aria-label="Tipo"><option value="">Todos os tipos</option><option value="local">Local</option><option value="retirada">Retirada</option><option value="delivery">Delivery</option></select><button class="btn sec" id="refresh-orders">↻ Atualizar</button></div>
  <div class="status-tabs" id="order-tabs"></div><div id="orders-table"></div><div id="hist" class="history-panel"></div></section>`;
  let filtro='todos';
  const render=()=>{
    const q=$('#order-search').value.toLowerCase().trim(),tipo=$('#order-type').value;
    const filtered=d.filter(o=>(filtro==='todos'||o.status_atual===filtro)&&(!tipo||o.tipo===tipo)&&(!q||[o.id,o.cliente,o.atendente,o.tipo].some(v=>String(v||'').toLowerCase().includes(q))));
    $('#order-tabs').innerHTML=[['todos','Todos',d.length],['recebido','Recebidos',counts.recebido||0],['em preparo','Em preparo',counts['em preparo']||0],['pronto','Prontos',counts.pronto||0],['entregue/retirado','Concluídos',counts['entregue/retirado']||0],['cancelado','Cancelados',counts.cancelado||0]].map(([key,label,n])=>`<button class="tab ${filtro===key?'active':''}" data-filter="${esc(key)}">${label} <span>${n}</span></button>`).join('');
    $('#orders-table').innerHTML=filtered.length?`<div class="wrap"><table class="orders-table"><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>TIPO</th><th>ATENDENTE</th><th>STATUS</th><th>TOTAL</th><th>DATA E HORA</th><th>AÇÕES</th></tr></thead><tbody>${filtered.map(o=>`<tr><td><b>#${String(o.id).padStart(4,'0')}</b></td><td><div class="customer-cell"><span class="customer-avatar">${esc(String(o.cliente||'C').charAt(0).toUpperCase())}</span><span>${esc(o.cliente||'Balcão')}</span></div></td><td>${esc(o.tipo||'—')}</td><td>${esc(o.atendente||'—')}</td><td><span class="status-badge ${statusClass(o.status_atual)}">● ${esc(o.status_atual||'—')}</span></td><td><b>${brl(o.total)}</b></td><td>${dt(o.criado_em)}</td><td><div class="actions-cell"><select aria-label="Alterar status" data-s="${o.id}">${STATUS.map(x=>`<option value="${x}" ${x===o.status_atual?'selected':''}>${x}</option>`).join('')}</select><button class="btn sm sec" data-h="${o.id}">Histórico</button><button class="btn sm sec" data-a="${o.id}">Avaliar</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Nenhum pedido encontrado para esses filtros.</div>';
    $('#orders-table').dataset.filtered=filtered.length;
  };
  render();
  $('#order-search').oninput=render;$('#order-type').onchange=render;
  $('#order-tabs').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filtro=b.dataset.filter;render();}};
  $('#refresh-orders').onclick=()=>ir('pedidos');
  $('#export-orders').onclick=()=>exportarCSV(d);
  $('#orders-table').onchange=async e=>{const b=e.target.closest('[data-s]');if(!b)return;try{await api(`pedidos/${b.dataset.s}/status`,'PUT',{status:b.value});aviso('Status atualizado e registrado no histórico.');await pedidos();}catch(err){aviso(err.message,false);await pedidos();}};
  $('#orders-table').onclick=async e=>{
    const h=e.target.closest('[data-h]'),a=e.target.closest('[data-a]');
    if(h){try{const history=await api(`pedidos/${h.dataset.h}/historico`);$('#hist').innerHTML=`<div class="panel-head"><h3>Histórico do pedido #${esc(h.dataset.h)}</h3><button class="btn sm sec" id="close-history">Fechar</button></div>`+tabela(['status','alterado_em'],history.map(x=>({...x,alterado_em:dt(x.alterado_em)})));$('#close-history').onclick=()=>$('#hist').innerHTML='';$('#hist').scrollIntoView({behavior:'smooth',block:'nearest'});}catch(err){aviso(err.message,false);}}
    if(a){const nota=prompt('Nota de 1 a 5:');if(!nota)return;const comentario=prompt('Comentário (opcional):')||null;try{await api(`pedidos/${a.dataset.a}/avaliacao`,'POST',{nota:Number(nota),comentario});aviso('Avaliação registrada.');}catch(err){aviso(err.message,false);}}
  };
}

// ===== NOVO =====
// Exibe o formulário para criar um pedido.
async function novo(){
  const [cl,fu,me,pr,co,va,ad,ed] = await Promise.all(['clientes','funcionarios','mesas','produtos','combos','variacoes','adicionais','enderecos'].map(x=>api(x)));
  const sel = (n,l,a,lbl,vazio) => `<label>${l}<select name="${n}">${vazio?'<option value="">— nenhum —</option>':''}${a.map(o=>`<option value="${o.id}">${esc(lbl(o))}</option>`).join('')}</select></label>`;
  const itens = [{}]; // itens do pedido
  $('#view').innerHTML = `<div class="section-intro"><h2>Novo pedido</h2><p>Preencha os dados e registre o pedido no sistema.</p><button type="button" class="btn sec" id="back-orders">← Voltar aos pedidos</button></div><form id="p">
   ${sel('cliente_id','Cliente (opcional no balcão)',cl,o=>o.nome,1)}${sel('atendente_id','Atendente',fu,o=>o.nome)}
   <label>Canal<select name="canal"><option>balcao</option><option>telefone</option><option>aplicativo</option></select></label>
   <label>Tipo<select name="tipo"><option>local</option><option>retirada</option><option>delivery</option></select></label>
   ${sel('mesa_id','Mesa (consumo local)',me,o=>'Mesa '+o.numero,1)}${sel('endereco_id','Endereço (delivery)',ed,o=>o.logradouro+', '+o.numero,1)}
   ${sel('entregador_id','Entregador (delivery)',fu,o=>o.nome,1)}
   <label>Taxa de entrega<input name="taxa_entrega" type="number" step="0.01" value="0"></label><label>Cupom<input name="cupom_codigo"></label>
   <fieldset style="grid-column:1/-1"><legend>Itens</legend><div id="its"></div><button type="button" class="btn sm" id="addI">+ Item</button></fieldset>
   <fieldset style="grid-column:1/-1"><legend>Pagamentos (soma deve igualar o total)</legend><div id="pgs"></div><button type="button" class="btn sm" id="addP">+ Forma</button></fieldset>
   <button class="btn">Registrar pedido</button></form>`;
  $('#back-orders').onclick=()=>ir('pedidos');
  const opt = (a,l)=>a.map(o=>`<option value="${o.id}">${esc(l(o))}</option>`).join('');
  const linhaItem = () => `<div class="cards" style="margin:6px 0"><label>Item<select class="k">${opt(pr,o=>'Produto: '+o.nome+' '+brl(o.preco_base))}${opt(co,o=>'Combo: '+o.nome+' '+brl(o.preco))}</select></label>
   <label>Qtd<input class="q" type="number" min="1" value="1"></label><label>Variação<select class="v"><option value="">—</option>${opt(va,o=>`${o.nome} (prod ${o.produto_id}, +${o.acrescimo})`)}</select></label>
   <label>Adicionais<select class="a" multiple>${opt(ad,o=>`${o.nome} +${o.preco}`)}</select></label><label>Observação<input class="o"></label></div>`;
  const linhaPg = () => `<div class="cards" style="margin:6px 0"><label>Forma<select class="f"><option>dinheiro</option><option>credito</option><option>debito</option><option>pix</option></select></label><label>Valor<input class="vl" type="number" step="0.01" min="0.01" required></label></div>`;
  $('#its').innerHTML = linhaItem(); $('#pgs').innerHTML = linhaPg();
  $('#addI').onclick = () => $('#its').insertAdjacentHTML('beforeend', linhaItem());
  $('#addP').onclick = () => $('#pgs').insertAdjacentHTML('beforeend', linhaPg());
  $('#p').onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = x => f[x].value ? Number(f[x].value) : null;
    const itensB = [...document.querySelectorAll('#its .cards')].map(d=>{
      const txt = d.querySelector('.k').selectedOptions[0].textContent.startsWith('Combo'); const id = Number(d.querySelector('.k').value);
      return {produto_id: txt?null:id, combo_id: txt?id:null, quantidade:Number(d.querySelector('.q').value),
        variacao_id: d.querySelector('.v').value?Number(d.querySelector('.v').value):null,
        adicionais:[...d.querySelector('.a').selectedOptions].map(o=>Number(o.value)), observacao:d.querySelector('.o').value||null};
    });
    const body = {cliente_id:n('cliente_id'),atendente_id:n('atendente_id'),canal:f.canal.value,tipo:f.tipo.value,mesa_id:n('mesa_id'),
      endereco_id:n('endereco_id'),entregador_id:n('entregador_id'),taxa_entrega:f.taxa_entrega.value||'0',cupom_codigo:f.cupom_codigo.value||null,
      itens:itensB, pagamentos:[...document.querySelectorAll('#pgs .cards')].map(d=>({forma:d.querySelector('.f').value,valor:d.querySelector('.vl').value}))};
    try{ const r = await api('pedidos','POST',body); aviso(`Pedido ${r.id} registrado. Total: ${brl(r.total)}`); }catch(err){ aviso(err.message,false); }
  };
}

// ===== REL =====
// Exibe os relatórios gerados pela API.
async function rel(){
  const cl = await api('clientes');
  $('#view').innerHTML = `<form id="r"><label>Início<input type="date" name="i"></label><label>Fim<input type="date" name="f"></label>
   <label>Cliente<select name="c">${cl.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
   <div><button class="btn sm" data-r="v">Mais vendidos</button> <button class="btn sm" data-r="c">Consumo de ingredientes</button>
   <button class="btn sm" data-r="e">Estoque</button> <button class="btn sm" data-r="h">Histórico do cliente</button></div></form><div id="out"></div>`;
  $('#r').onsubmit = e => e.preventDefault();
  $('#r').onclick = async e => {
    const t = e.target.dataset.r; if(!t) return; const f = $('#r');
    const q = `?${f.i.value?'inicio='+f.i.value:''}&${f.f.value?'fim='+f.f.value:''}`;
    try{ const u = {v:'relatorios/mais-vendidos'+q,c:'relatorios/consumo-ingredientes'+q,e:'relatorios/estoque',h:'relatorios/historico-cliente/'+f.c.value}[t];
      const d = await api(u); $('#out').innerHTML = tabela(d.length?Object.keys(d[0]):[],d.map(r=>({...r,criado_em:dt(r.criado_em)}))); }catch(err){ aviso(err.message,false); }
  };
}
const VIN = {
  'produto-ingrediente':['Receita: ingredientes por produto','produtos','ingredientes','quantidade','Quantidade usada'],
  'combo-produto':['Produtos de cada combo','combos','produtos','quantidade','Quantidade'],
  'produto-adicional':['Adicionais aceitos por produto','produtos','adicionais',null,null],
  'promocao-produto':['Produtos em promoção','promocoes','produtos','preco_promocional','Preço promocional']};
const KEYS = {'produto-ingrediente':['produto_id','ingrediente_id'],'combo-produto':['combo_id','produto_id'],'produto-adicional':['produto_id','adicional_id'],'promocao-produto':['promocao_id','produto_id']};

// ===== VINC =====
// Gerencia as relações entre produtos, ingredientes e combos.
async function vinc(){
  $('#view').innerHTML = `<label>Relacionamento<select id="vs">${Object.entries(VIN).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></label><div id="vb"></div>`;
  const draw = async () => {
    const k = $('#vs').value, [,ra,rb,ex,exl] = VIN[k], [ka,kb] = KEYS[k];
    const [A,B,L] = await Promise.all([api(ra),api(rb),api('vinculos/'+k)]);
    const nome = (arr,id)=>{const o=arr.find(x=>x.id==id);return o?(o.nome||o.numero):id;};
    const op = arr => arr.map(o=>`<option value="${o.id}">${esc(o.nome||o.numero)}</option>`).join('');
    $('#vb').innerHTML = `<form id="vf"><label>${ra}<select name="${ka}">${op(A)}</select></label><label>${rb}<select name="${kb}">${op(B)}</select></label>
      ${ex?`<label>${exl}<input name="${ex}" type="number" step="0.001" required></label>`:''}<button class="btn">Vincular</button></form>`+
      tabela([ra,rb,...(ex?[ex]:[])], L.map(r=>({[ra]:nome(A,r[ka]),[rb]:nome(B,r[kb]),...(ex?{[ex]:r[ex]}:{}),_a:r[ka],_b:r[kb]})),
        r=>`<button class="btn sm sec" data-ra="${r._a}" data-rb="${r._b}">Remover</button>`);
    $('#vf').onsubmit = async e => { e.preventDefault(); try{ await api('vinculos/'+k,'POST',Object.fromEntries(new FormData(e.target))); aviso('Vínculo salvo.'); draw(); }catch(err){ aviso(err.message,false); } };
    $('#vb').onclick = async e => { if(e.target.dataset.ra && confirm('Remover vínculo?')){ try{ await api('vinculos/'+k+'/remover','POST',{[ka]:e.target.dataset.ra,[kb]:e.target.dataset.rb}); aviso('Vínculo removido.'); draw(); }catch(err){ aviso(err.message,false); } } };
  };
  $('#vs').onchange = draw; await draw();
}
document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
ir('dash');
