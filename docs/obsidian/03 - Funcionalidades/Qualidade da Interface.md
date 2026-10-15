# Qualidade da Interface

## Objetivo

Manter todos os controles visuais funcionais, acessíveis e contidos no viewport em
desktop e dispositivos móveis.

## Regras de interface

- Ícones interativos possuem nome acessível, tooltip e destino ou ação real.
- Controles sem ação disponível para o perfil não são renderizados.
- A página não pode produzir rolagem horizontal em viewport de 390 px.
- Navegações extensas podem rolar dentro do próprio componente.
- Textos de interface explicam o comportamento sem expor códigos internos de requisitos.

## Correções de 2026-10-13

- Remoção da busca global sem implementação.
- Botão de nova venda restrito ao perfil vendedor.
- Menu administrativo responsivo com drawer e backdrop no celular.
- Cabeçalhos de vendedor e SDR reorganizados para telas pequenas.
- Cards administrativos e do SDR conectados aos módulos correspondentes quando existe
  uma tela de detalhe.
- Correção da colisão Tailwind entre o tamanho `text-base` e o token de cor `base`, que
  deixava títulos quase invisíveis.
- Cache HTTP do navegador desabilitado para impedir restauração visual de sessão após
  logout.
- Remoção de métricas fictícias e textos técnicos de RN/MP da experiência do usuário.

## Validação

- Vitest para os controles do cabeçalho.
- Playwright em viewport `390 × 844` para admin, vendedor e SDR.
- Auditoria manual de largura nas 23 rotas autenticadas.

## Ajuste de marca e navegação — 2026-10-15

- Cabeçalhos autenticados exibem somente a logo e o nome `Lynk` em tamanho reduzido,
  abaixo do símbolo.
- O bloco da marca é um link para a dashboard inicial do perfil atual.
- O menu administrativo mantém o mesmo comportamento em desktop e mobile, sem exibir
  o rótulo redundante do perfil junto à marca.
