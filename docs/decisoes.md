# Decisões e hipóteses provisórias

Cada linha registra: **requisito** (documento) → **decisão técnica** → **hipótese operacional** (quando aplicável). Hipóteses precisam ser confirmadas pela operação antes do uso em produção.

## Estrutura e execução

| Tema | Decisão | Justificativa |
|---|---|---|
| Stack backend | Flask 3 + SQLAlchemy 2 + Alembic + Pydantic v2 + Flask-Login + Flask-Session (Redis) + Celery 5 + Gunicorn | Exigido pelo prompt (seção 3). |
| Stack frontend | React 18 + TS 5 + Vite 6 + Tailwind 4 + React Router + TanStack Query 5 + React Hook Form 7 + Zod 3 + Lucide React | Vite, Vitest e Tailwind foram elevados às primeiras versões sem os CVEs conhecidos encontrados em 2026-10-13; a arquitetura exigida foi preservada. |
| Multi-tenant | Coluna `organization_id` em todas as tabelas de negócio, derivada da sessão; nunca aceita do cliente | Prompt seção 5. |
| Dinheiro | `NUMERIC(14, 2)` no banco, `Decimal` em Python, número em string na API | Evita perda de precisão. |
| Fuso | Instantes em UTC (`TIMESTAMPTZ`), regras comerciais e apresentação em `America/Sao_Paulo` | Prompt seção 5. |
| Senhas | Argon2id via `argon2-cffi` | Prompt seção 18. |
| Sessão | Cookie opaco `HttpOnly`, `SameSite=Lax`, `Secure` em produção; dados armazenados no Redis via Flask-Session | Prompt seção 18. |
| CSRF | Token duplo (cookie + header `X-CSRF-Token`) em todas as mutações autenticadas | Prompt seção 18. |
| Proteção do login | Contadores distribuídos no Redis por conta e IP, com identificadores em HMAC; falha fechada se o Redis estiver indisponível | Evita força bruta em múltiplas instâncias sem registrar e-mail/IP em claro nas chaves. |

## Regras comerciais

| Lacuna do prompt | Padrão provisório | Justificativa |
|---|---|---|
| RN-011 "2 dias antes" — úteis ou corridos? | **Dias úteis** (coerência com RN-001). Configurável por organização. | Prompt seção 20. |
| Distribuição de agendamentos | Atribuição explícita a vendedor elegível; itens sem responsável ficam para distribuição administrativa | Prompt seção 20. |
| Negociações simultâneas no mesmo lead/produto | **Bloqueadas** na V1. Entre produtos: permitido | Prompt seção 20. |
| Base do calendário de agendamentos | Agrupar por **vigência**, com rótulo explícito; calendário de contato é filtro adicional | Prompt seção 20. |
| Primeiro contato por ciclo | **Contagem única** por ciclo comercial vinculado à origem. Reciclagem não vira prospecção fria | RN-007. |
| Alteração de venda validada dentro do prazo (RN-034) | Cria **revisão pendente**; produção considera a última versão validada até nova aprovação | Prompt seção 20. |
| Competência da venda | Mês da **data de fechamento**; entrada na produção oficial apenas após validação | Prompt seção 20. |
| Tarefa em dia não útil (agendada manualmente) | Avisa na UI; se continuar aberta, entra como pendência na próxima rotina útil | Prompt seção 20. |
| Eventos após 19h | Preservados no histórico; **não reabrem** meta encerrada; nova exigência entra na próxima rotina útil | RN-003/RN-004. |
| Bônus sem valores/base definidos | Mecanismo + telas implementados; **apuração exige** configuração válida vigente | Prompt seção 20. |
| Valor fixo da faixa de bônus | É valor **por negócio validado**: total = valor da faixa × quantidade de negócios; limite inferior inclusivo e superior exclusivo | Confirmação da operação em 15/10/2026. |
| Mudança de meta/faixa dentro do mês | Vigência por **competência mensal**, sem sobreposição; alteração passa a valer no mês seguinte | Prompt seção 20. |
| Bônus previsto em fim de semana/feriado | Previsão permanece **dia 20**; pagamento real é registro à parte, marcado quando efetivado | Prompt seção 20. |
| Crédito em substituições | **Atividade** = executor; **produção** = vendedor definido no registro da venda, preservado mesmo após transferências | Prompt seção 20. |
| Meta durante ausência | Meta de prospecção **não** é transferida; qualquer isenção/redução deve ser configuração administrativa explícita | Prompt seção 20. |
| Função de sinistros acumulável | Manter o perfil comercial (`vendedor` ou `sdr`) e anexar `claims.read`/`claims.manage`; administrador possui operação implícita | Evita perfis combinatórios e preserva as permissões comerciais existentes. |
| Catálogos do sinistro | Ramo e seguradora usam IDs de catálogos da organização; o sinistro preserva também o nome como fotografia histórica | Permite configuração e integridade sem reescrever o histórico quando um catálogo muda. |
| Oficinas referenciadas | Oficina pertence à organização e se relaciona N:N com seguradoras; só pode ser escolhida para seguradora vinculada | Impede indicação de oficina não referenciada pela seguradora do sinistro. |

## Escolhas visuais

- Fundo base `#050B1F`, superfície `#0B1836`, borda `#1E2A4A`, texto primário `#E9F2FF`, texto secundário `#8DA1C8`.
- Cores de marca: `#00CBFF` (ciano), `#0079FF` (azul), `#FF8900` (laranja). Estados: `#22C55E` sucesso, `#F5A524` atenção, `#EF4444` erro.
- Botão primário: gradiente ciano→azul; ação/atenção: laranja. Estado desabilitado com opacidade e cursor não permitido.
- Componentes acessíveis: foco visível `outline` ciano `2px`, contraste mínimo AA.

## Pendências para revisão de negócio

1. Confirmar que RN-011 será tratada em dias úteis por padrão.
2. Confirmar base do calendário de agendamentos = vigência.
3. Definir base financeira da bonificação (por prêmio líquido ou parcela) antes de qualquer apuração real.
4. Confirmar procedimento em cancelamento pós-pagamento (pagamento histórico preservado).
5. Confirmar política de negociações simultâneas para produtos diferentes (permitidas por padrão).
