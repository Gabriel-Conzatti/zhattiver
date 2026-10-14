# Matriz de Requisitos

Fonte: Prompt de implementação `Prompt_Lynk_Copilot.md` + Parte 4 (RN-001 a RN-087) + Parte 5 (MP-001 a MP-006).

Estados:

- ⬜ pendente — ainda não implementado.
- 🟨 implementado — código existe, sem verificação executada.
- ✅ verificado — código existe e foi testado (teste automatizado ou verificação manual documentada).

## Permissões (MP)

| ID | Regra | Estado | Onde |
|---|---|---|---|
| MP-001 | Acesso por produto | 🟨 | `backend/app/core/authz.py` + `user_products` + rotas de leads/oportunidades |
| MP-002 | Oportunidades próprias | 🟨 | filtro em `/opportunities`, `sales` e drawer |
| MP-003 | Desempenho individual protegido | 🟨 | `/me/production`, `/me/bonus` gated por role/grants |
| MP-004 | Bônus é privado (nem admin substituto acessa entre vendedores) | 🟨 | `/me/bonus` só do próprio; grant `bonus.view_others*` bloqueado |
| MP-005 | Acesso temporário com vigência | 🟨 | `PermissionGrant` + rotas admin/grants |
| MP-006 | Auditoria de concessões | 🟨 | `AuditLog` em create/revoke de grants |

## Regras de Negócio (RN)

### Dias úteis e horários

| ID | Regra | Estado | Onde |
|---|---|---|---|
| RN-001 | Dias úteis = seg–sex, feriados nacionais excluídos | 🟨 | `backend/app/core/calendar.py` |
| RN-002 | Calendário de feriados versionado | 🟨 | modelo `Holiday` |
| RN-003 | Meta operacional fecha às 19h | 🟨 | `LYNK_DAILY_METAS_CLOSE_HOUR`, `compute_daily_goals` |
| RN-004 | Histórico até 23h59:59.999999 | 🟨 | `compute_daily_goals` usa `end_of_day_utc` |

### Metas diárias

| ID | Regra | Estado |
|---|---|---|
| RN-005 | Meta de prospecção configurável por vendedor | ✅ (gestão administrativa com vigência, histórico, auditoria e testes backend/frontend) |
| RN-006 | Primeiro contato registrado por "Copiar mensagem" | 🟨 |
| RN-007 | Contagem única por ciclo | 🟨 |
| RN-008 | Excedente não compensa dia seguinte | 🟨 |

### Agendamentos

| ID | Regra | Estado |
|---|---|---|
| RN-009 | Destaque entre 5 e 7 dias úteis antes da vigência | 🟨 |
| RN-010 | Data não confirmada permanece exigível com marcação visual | 🟨 |
| RN-011 | Limite de abordagem = 2 dias antes (unidade útil por decisão provisória) | 🟨 |
| RN-012 | Item não trabalhado vira "Resolver agendamento" | 🟨 |
| RN-013 | Resolução exige justificativa + nova data + reagendamento | 🟨 |
| RN-014 | Meta = 100% dos exigíveis (contato + resolução) | 🟨 |
| RN-015 | Sem agendamentos: 0/0 concluída, sem penalidade | 🟨 |

### Follow-ups

| ID | Regra | Estado |
|---|---|---|
| RN-016 | Geração automática 24h corridas + próximo dia útil | 🟨 |
| RN-017 | Exemplo canônico coberto por teste | 🟨 |
| RN-018 | Próxima ação existente inibe follow-up automático | 🟨 |
| RN-019 | Lista de atualizações relevantes | 🟨 |
| RN-020 | Follow-up atrasado permanece, sem duplicar | 🟨 |
| RN-021 | Meta = 100% previstos + atrasados abertos | 🟨 |
| RN-022 | Tipos de próxima ação configuráveis | ✅ (API e tela administrativa; criação, desativação e reativação testadas) |

### Funil / mensagens

| ID | Regra | Estado |
|---|---|---|
| RN-023 | Funis, etapas, ordem, mensagens configuráveis | ✅ (API e tela administrativa com isolamento multiempresa testado) |
| RN-024 | Movimentação livre entre etapas permitidas | 🟨 |
| RN-025 | Encerramento (ganho/perda) a partir de qualquer etapa | 🟨 |
| RN-026..RN-029 | Mensagens com variáveis, fallback e registro por cópia | 🟨 |

### Vendas / produção

| ID | Regra | Estado |
|---|---|---|
| RN-030 | Venda pelo funil | 🟨 |
| RN-031 | Venda direta | 🟨 |
| RN-032 | Campos obrigatórios | 🟨 |
| RN-033 | Comissão = prêmio líquido × percentual | 🟨 |
| RN-034 | Prazo de edição pelo vendedor até 23h59 próximo dia útil | 🟨 |
| RN-035 | Permissão especial para editar após prazo | 🟨 |
| RN-036..RN-037 | Validação administrativa da venda | ✅ (Playwright valida a transição de pendente para validada) |
| RN-038 | Somente vendas validadas compõem produção, metas e bônus | ✅ (filtro centralizado e teste de integração por estado, tenant, produto e competência) |
| RN-039..RN-042 | Cancelamento antes/depois do pagamento do bônus | 🟨 |

### Metas mensais / bônus

| ID | Regra | Estado |
|---|---|---|
| RN-043..RN-051 | Metas com vigência, faixas, bônus fixo/percentual, parcela, estados administrativos | ✅ (gestão administrativa, vigências sem sobreposição, apuração, aprovação, pagamento e cancelamento auditado testados) |
| RN-052 | Tipos de cliente configuráveis | 🟨 |

### Perda / reciclagem

| ID | Regra | Estado |
|---|---|---|
| RN-053..RN-055 | Motivo + justificativa obrigatórios | 🟨 (motivos configuráveis via API/tela; fluxo de perda já implementado) |
| RN-056..RN-059 | Reagendamento preservando histórico | 🟨 |

### Cross-sell

| ID | Regra | Estado |
|---|---|---|
| RN-060..RN-064 | Pré-listas administrativas com controle | 🟨 |

### Responsabilidade / transferências

| ID | Regra | Estado |
|---|---|---|
| RN-065..RN-069 | Transferências e ausências, sem retornar acesso automaticamente | 🟨 |

### Permissões / arquivamento / duplicidades

| ID | Regra | Estado |
|---|---|---|
| RN-070 | Perfis padrão (admin, vendedor, SDR) | 🟨 |
| RN-071 | Permissões individuais | 🟨 |
| RN-072 | Dados financeiros restritos | ✅ (vendas, bônus e relatórios cobertos por perfil e isolamento multiempresa) |
| RN-073..RN-075 | Arquivamento em vez de exclusão | 🟨 (catálogos administrativos cobertos com arquivamento e restauração) |
| RN-076..RN-078 | Duplicidade por telefone normalizado | 🟨 |

### Auditoria / notificações / histórico

| ID | Regra | Estado |
|---|---|---|
| RN-079..RN-080 | Auditoria de ações relevantes | 🟨 (consulta administrativa paginada, filtrável e isolada por organização; cobertura de autorização adicionada) |
| RN-081..RN-085 | Notificações internas | 🟨 |
| RN-086..RN-087 | Preservação histórica e linha do tempo | 🟨 |

## Telas por perfil (mapeamento)

### Vendedor

- Dashboard, Prospecção, Agendamentos, Funil, Perfil (via avatar) — perfil e troca de senha verificados.

### SDR

- Dashboard, Prospecção, Agendamentos, Importações, Perfil — perfil e troca de senha verificados.

### Administrador

- Dashboard, Comercial (Prospecção/Agendamentos/Funil/Cross-Sell), Gestão (Produção/Metas/Bônus/Equipe/Ausências), Relatórios, Configurações, Auditoria e Perfil.

## Critérios de aceite mínimos

Ver `Prompt_Lynk_Copilot.md` seção 21. Cada caso será coberto por teste automatizado nas etapas seguintes.

## Evidência de segurança

- RN-072: `backend/tests/test_authorization_boundaries.py` verifica que SDR não lista
  nem detalha vendas ou oportunidades, vendedor não acessa venda de outro vendedor,
  valores de comissão não aparecem na listagem do vendedor, bônus próprio sem concessão
  não expõe valor, listagem administrativa de bônus é isolada por organização e outra
  organização recebe `404` ao buscar venda. O relatório financeiro é exclusivo de
  administrador, agrega somente vendas validadas e não cruza organizações. Notificações
  não carregam valores financeiros e são isoladas pelo destinatário.
