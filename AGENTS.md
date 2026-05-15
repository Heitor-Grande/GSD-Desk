# AGENTS.md

Orientacoes para agentes e desenvolvedores que forem trabalhar neste template.

## Objetivo do projeto

Este repositorio e um template padrao para iniciar novas aplicacoes com Next.js, TypeScript e Bootstrap. Ele deve funcionar como uma base reutilizavel, com estrutura, componentes, modais, hooks, services e utils prontos para evolucao em novos projetos.

Ao alterar este repositorio, priorize solucoes genericas e reaproveitaveis. Evite incluir regras de negocio especificas de uma aplicacao final diretamente no template.

## Stack e comandos

- Next.js com App Router em `src/app`.
- TypeScript com `strict` habilitado.
- Bootstrap e React Bootstrap para UI.
- `react-select` para selects.
- `react-icons` para icones.
- Alias de importacao: `@/*` aponta para `src/*`.

Comandos principais:

```bash
npm run dev
npm run build
npm run lint
```

Antes de finalizar alteracoes relevantes, rode pelo menos `npm run lint`. Para mudancas estruturais ou de runtime, rode tambem `npm run build`.

## Estrutura esperada

Mantenha a organizacao por responsabilidade:

```text
src/
  app/                 Rotas, layouts, paginas e estilos globais
  components/
    inputs/            Inputs, botoes, selects e controles reutilizaveis
    layout/            Componentes de estrutura visual, como sidebar/navbar
    modals/            Modais prontos para uso em qualquer aplicacao
  hooks/               Hooks customizados reutilizaveis
  services/            Clientes HTTP e integracoes com APIs
  utils/               Funcoes puras, formatadores, validadores e helpers
```

Se uma pasta ainda nao existir, crie apenas quando houver codigo real para colocar nela.

## Diretrizes para novos componentes

- Componentes interativos devem usar `"use client"` no topo do arquivo.
- Prefira componentes pequenos, tipados e com props explicitas.
- Use React Bootstrap quando o componente representar UI Bootstrap.
- Use o alias `@/` para imports de arquivos dentro de `src`.
- Evite acoplar componentes reutilizaveis a uma rota especifica.
- Evite textos, estilos ou comportamentos de um dominio especifico dentro de componentes base.
- Mantenha nomes de arquivos consistentes com o padrao atual do projeto.

## Modais

Os modais base ficam em `src/components/modals`.

Padroes desejados:

- Usar `react-bootstrap/Modal`.
- Receber estado aberto/fechado por props, como `isOpen` ou `show`.
- Receber callbacks por props, como `onClose`, `onCancel` e `onConfirm`.
- Nao buscar dados diretamente dentro do modal.
- Nao executar regra de negocio especifica dentro do modal.
- Manter modais genericos, por exemplo: confirmacao, resposta, loading, formulario generico.

Quando criar um novo modal, pense nele como algo que possa ser usado por qualquer aplicacao criada a partir deste template.

Para modais locais de uma tela ou modulo, concentre a regra de negocio dentro do proprio modal. O componente pai deve passar apenas props de controle como `aberto` e `aoFechar`, evitando callbacks como `aoSalvar` quando a acao pertence ao fluxo do modal.

## Hooks

Hooks reutilizaveis ficam em `src/hooks`.

Padroes desejados:

- Nomear hooks com prefixo `use`, por exemplo `useLoading`.
- Encapsular estado e comportamento reutilizavel.
- Nao misturar UI dentro de hooks.
- Evitar dependencia de telas especificas.
- Retornar uma API simples e previsivel.

Exemplos de bons candidatos para hooks do template:

- controle de loading;
- controle de modal;
- debounce;
- paginacao;
- formularios simples;
- chamadas assincronas padronizadas.

## Services

Services devem ficar em `src/services`.

Use esta camada para centralizar integracoes externas e chamadas HTTP. Nao espalhe `fetch`, configuracoes de headers ou tratamento padrao de erro por componentes de tela.

Padroes desejados:

- Separar clientes genericos de services especificos.
- Manter URL base, headers e tratamento comum em um ponto central.
- Retornar dados tipados.
- Nao colocar estado React dentro de services.
- Nao importar componentes dentro de services.

Quando o template precisar de um cliente HTTP base, prefira algo simples e facil de substituir pela aplicacao final.

## Rotas de API

- Funcoes de rotas da API, como `GET`, `POST`, `PUT`, `PATCH` e `DELETE`, devem concentrar sua execucao dentro de um unico bloco `try/catch`.
- Valide o corpo da requisicao, regras basicas e chamadas ao banco dentro desse `try`.
- Centralize as respostas de erro no `catch`, tratando casos conhecidos, como violacao de unicidade, antes da resposta generica.
- Evite multiplos `try/catch` dentro da mesma funcao de rota, salvo quando houver uma justificativa tecnica clara.

## Rate limit

Use `src/utils/rateLimit.ts` para limitar tentativas em rotas sensiveis por IP, como login, recuperacao de senha, validacao de codigo e alteracao de senha.

Padrao desejado:

```ts
const respostaRateLimit = verificarRateLimitPorIp({
    request: request,
    identificador: "login",
    limite: 5,
    janelaMs: 15 * 60 * 1000,
});

if (respostaRateLimit) {
    return respostaRateLimit;
}
```

- Aplique o rate limit no inicio do `try`, antes de consultas ao banco, envio de e-mail ou validacao de credenciais.
- Use um `identificador` especifico para cada fluxo, por exemplo `login`, `recuperacao-senha-envio`, `recuperacao-senha-codigo` e `recuperacao-senha-alteracao`.
- O util atual guarda tentativas em memoria do processo. Ele atende ao template e ao desenvolvimento local, mas para producao com multiplas instancias, serverless ou balanceamento de carga, substitua por um armazenamento compartilhado, como Redis, banco de dados ou servico gerenciado de rate limit.
- Mantenha a resposta padronizada pelo contrato da API, usando status `429` quando o limite for excedido.

## Consultas à API no Frontend

Use `src/utils/api.ts` para chamadas do front para o back. Nao espalhe `fetch` diretamente em componentes, paginas ou hooks.

Exemplo:

```ts
const resposta = await requisitarAPI("/api/recurso", {
    method: "POST",
    body: dados,
});
```

Mesmo em consultas `GET`, mantenha o `method` explicito para padronizar a leitura do codigo.

Toda funcao do front que fizer requisicao ao back deve concentrar a chamada dentro de um unico bloco `try/catch`. Se cair no `catch`, exiba a mensagem usando `ModalResposta`.

## Respostas de API

Toda resposta de rota de API deve seguir o contrato:

```ts
{
    sucesso: boolean;
    msg: string;
    dados: unknown | null;
}
```

Use `src/utils/respostaApi.ts` para criar respostas padronizadas no back. O campo `dados` e obrigatorio e deve ser enviado como `null` quando nao houver conteudo para retornar.

## Autenticacao e Proxy

O arquivo `src/proxy.ts` valida o cookie `app_session` antes de liberar rotas protegidas. Use `validarJWT` de `src/utils/jwt.ts` para validar assinatura e expiracao do token.

O JWT de sessao deve incluir `idUsuario` e `ativo`. O proxy usa o payload validado para liberar apenas usuarios com `ativo` igual a `true`, evitando consulta ao banco a cada requisicao protegida.

Quando uma rota de API precisar do id do usuario logado, use `obterIdUsuarioAutenticado` de `src/utils/autenticacao.ts`. Nao leia nem decodifique o cookie `app_session` diretamente dentro da rota quando essa funcao atender ao caso.

Mantenha rotas publicas explicitas dentro do proxy. Para APIs protegidas sem JWT valido, retorne resposta padronizada com status `401`; para paginas protegidas, redirecione para `/`.

## Utils

Utils devem ficar em `src/utils`.

Use esta pasta para funcoes puras e independentes de React, como:

- formatacao de datas, numeros e textos;
- validacoes;
- manipulacao de strings;
- conversoes;
- helpers pequenos e testaveis.

Evite colocar regras de negocio extensas em `utils`. Se a funcao depender de contexto de dominio, ela provavelmente pertence a um service, hook ou modulo especifico da aplicacao final.

O arquivo `src/utils/validacoes.ts` centraliza validacoes e normalizacoes comuns:

- `validarStringComConteudo`: use para confirmar que um valor desconhecido e uma string preenchida antes de aplicar `trim()`, `toLowerCase()` ou salvar dados obrigatorios.
- `validarEmail`: use para validar o formato basico de e-mails em login, cadastro e recuperacao de senha.
- `normalizarCampoOpcional`: use para campos opcionais que devem virar `null` quando nao preenchidos, como telefone, documento, complemento ou observacao.

Antes de criar uma nova validacao, verifique se ela pertence a esse arquivo ou se e uma regra especifica do modulo.

## Paginas e layout

- Rotas ficam em `src/app`.
- `src/app/layout.tsx` deve manter configuracoes globais e estrutura comum.
- Estilos globais ficam em `src/app/cssGlobal.css`.
- Evite transformar `page.tsx` em catalogo permanente de exemplos. Exemplos podem existir temporariamente, mas o template deve iniciar limpo e facil de adaptar.
- Telas que usarem `TabelaDados` devem seguir o padrao de montagem de `src/app/(app)/usuarios/page.tsx`: cabecalho simples com titulo, descricao e acao principal com `Botao`; carregamento via `requisitarAPI`; erros exibidos com `ModalResposta`; e tabela renderizada pelo componente `TabelaDados`.

## Estilo e TypeScript

- Mantenha `strict` sem relaxar configuracoes do TypeScript.
- Prefira tipos e interfaces explicitos para props.
- Evite `any`; use tipos especificos ou generics quando necessario.
- Nao adicione bibliotecas novas sem necessidade clara para o template.
- Preserve o padrao visual Bootstrap ja adotado.
- Mantenha portugues correto em textos visiveis, mensagens de API, placeholders, metadados e comentarios. Use acentos e grafia correta, por exemplo: `aplicação`, `usuário`, `não`, `possível`, `requisição`, `sessão`.
- Comentarios devem explicar decisoes ou trechos nao obvios, nao repetir o que o codigo ja diz.
- Funcoes e componentes devem possuir comentarios explicando seu uso e sua utilidade no template. Prefira comentarios curtos em formato JSDoc acima da funcao ou componente.
- Nomes de funcoes devem ser escritos em portugues e deixar claro o que a funcao faz. Evite nomes genericos como `handle`, `process`, `execute` ou abreviacoes sem contexto.

## Padrao de cores

Use a paleta da sidebar como referencia visual da aplicacao:

- Fundo principal da aplicacao: `#f4f7fb`.
- Superficies claras, cards e formularios: `#ffffff`.
- Bordas claras: `#dce3ec`.
- Texto principal em telas claras: `#172033` ou `#273142`.
- Texto secundario: `#6c757d`.
- Sidebar e areas de navegacao internas: `#111827`.
- Texto principal sobre fundo escuro: `#e5edf8`.
- Texto secundario sobre fundo escuro: `#94a3b8`.
- Destaque/acao primaria: `#0d6efd`.
- Destaque de icones na sidebar: `#60a5fa`.
- Hover/ativo em navegacao escura: `rgba(255, 255, 255, 0.09)`.
- Divisorias em navegacao escura: `rgba(255, 255, 255, 0.08)` ou `rgba(255, 255, 255, 0.1)`.

Ao criar novas telas internas, mantenha fundos claros com conteudo em cards brancos e use a sidebar escura como ancora visual. Evite criar uma nova paleta dominante sem necessidade.

## Criterios para aceitar mudancas no template

Uma mudanca e adequada para este repositorio quando:

- ajuda novos projetos a comecarem mais rapido;
- reduz repeticao comum entre aplicacoes;
- melhora a organizacao base;
- permanece generica o suficiente para varios dominios;
- nao obriga uma aplicacao final a seguir uma regra de negocio especifica.

Uma mudanca provavelmente nao pertence ao template quando:

- depende de um cliente, produto ou dominio especifico;
- adiciona fluxo de negocio fechado;
- adiciona dependencia pesada sem uso amplo;
- torna a base mais dificil de remover ou adaptar.

## Cuidados ao editar

- Nao reverta alteracoes existentes sem pedido explicito.
- Leia os arquivos ao redor antes de mudar padroes.
- Mantenha alteracoes pequenas e coesas.
- Atualize este arquivo quando a arquitetura base mudar.
- Se criar componentes, hooks, services ou utils reutilizaveis, considere atualizar o `README.md` com exemplos de uso.
