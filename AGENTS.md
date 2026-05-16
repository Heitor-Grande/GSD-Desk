# AGENTS.md

Orientações técnicas para agentes e desenvolvedores que forem trabalhar no **GSD Desk**.

## Objetivo do projeto

O GSD Desk é uma aplicação web para gerenciamento de tickets, solicitações e rotinas de suporte. A aplicação possui autenticação, recuperação de senha, área interna protegida, seleção de empresa de navegação, controle de permissões por perfil, controle administrativo por usuário, gestão de usuários, empresas, perfis, vínculos e configurações gerais.

Ao alterar este repositório, priorize soluções coerentes com o produto atual. Evite voltar a tratar o projeto como template genérico.

## Stack e comandos

- Next.js com App Router em `src/app`.
- TypeScript com `strict` habilitado.
- Tailwind CSS para UI.
- React Bootstrap apenas para modais.
- `react-select` para selects.
- `react-icons` para ícones.
- PostgreSQL via `pg`.
- Nodemailer para envio de e-mails.
- Alias de importação: `@/*` aponta para `src/*`.

Comandos principais:

```bash
npm run dev
npm run build
npm run lint
```

Antes de finalizar alterações relevantes, rode pelo menos `npm run lint`. Para mudanças estruturais, fluxo de API ou runtime, rode também `npm run build` quando viável.

## Estrutura esperada

Mantenha a organização por responsabilidade:

```text
src/
  app/                 Rotas, layouts, páginas e estilos globais
    (app)/             Telas internas protegidas
    api/               Rotas de API
  components/
    inputs/            Inputs, botões, selects e controles reutilizáveis
    layout/            Componentes de estrutura visual, como sidebar/navbar
    modals/            Modais reutilizáveis
    tables/            Componentes de tabela
  services/            Banco de dados, e-mail e integrações externas
  utils/               Autenticação, permissões, validações e helpers
  proxy.ts             Proteção de rotas
```

Se uma pasta ainda não existir, crie apenas quando houver código real para colocar nela.

## Diretrizes para componentes

- Componentes interativos devem usar `"use client"` no topo do arquivo.
- Prefira componentes pequenos, tipados e com props explícitas.
- Use Tailwind CSS para páginas, layouts e componentes reutilizáveis.
- Não use Bootstrap para novos componentes de UI. React Bootstrap deve ficar restrito aos modais.
- Use o alias `@/` para imports de arquivos dentro de `src`.
- Evite acoplar componentes reutilizáveis a uma rota específica.
- Mantenha nomes de funções, variáveis e componentes em português claro.
- Textos visíveis, mensagens de API, placeholders, metadados e comentários devem usar português correto com acentos.

## Modais

Os modais base ficam em `src/components/modals`.

Padrões:

- Usar `react-bootstrap/Modal`.
- Receber estado aberto/fechado por props, como `isOpen`, `show` ou `aberto`.
- Receber callbacks simples como `onClose`, `onCancel`, `onConfirm` ou `aoFechar`.
- Não buscar dados diretamente dentro de modais genéricos.
- Modais locais de uma tela podem concentrar o fluxo da própria tela.
- Para modais de formulário locais, renderize condicionalmente pelo componente pai.

Padrão desejado para modais de cadastro:

```tsx
{modalCadastroAberto && (
    <ModalCadastro
        aberto={modalCadastroAberto}
        idRegistro={idRegistroSelecionado}
        aoFechar={() => {
            setModalCadastroAberto(false);
            setIdRegistroSelecionado(null);
            void carregarRegistros();
        }}
    />
)}
```

Esse padrão evita que, após submit em modo edição, o pai limpe o id selecionado enquanto o modal ainda está montado e o formulário seja renderizado como novo cadastro antes de fechar.

Dentro do modal, prefira que a função `fecharModal...` apenas chame `aoFechar()`. Se precisar limpar estado local, use `onExited` do `react-bootstrap/Modal`.

## Rotas de API

- Funções de rotas da API, como `GET`, `POST`, `PUT`, `PATCH` e `DELETE`, devem concentrar sua execução dentro de um único bloco `try/catch`.
- Valide permissão, autenticação, regras básicas, corpo da requisição e chamadas ao banco dentro desse `try`.
- Centralize respostas de erro no `catch`, tratando casos conhecidos, como `23505` e `23503`, antes da resposta genérica.
- O erro do `catch` é `unknown`; use narrowing antes de acessar propriedades como `code`.
- Use `criarRespostaApi` em toda resposta de API.
- Não retorne formatos fora do contrato `{ sucesso, msg, dados }`.
- Não leia nem decodifique o cookie `app_session` diretamente quando `obterIdUsuarioAutenticado` atender ao caso.

Ordem recomendada para rotas protegidas:

1. `verificarPermissaoAPI`.
2. `obterIdUsuarioAutenticado`, quando a rota precisar do id do usuário.
3. `verificarUsuarioAdministrador`, quando a ação exigir admin.
4. Validação de empresa de navegação ou vínculo, quando a rota for de leitura filtrada por empresa.
5. Validação de query/body.
6. Consultas e alterações no banco.

Regras atuais importantes:

- `configuracoes` e `perfil` exigem usuário administrador após o permissionamento.
- Criação, edição e exclusão de `usuarios` exigem usuário administrador.
- Criação, edição e exclusão de `empresas` exigem usuário administrador.
- Criação, edição, exclusão e visualização de vínculos em `empresas/usuarios` exigem usuário administrador.
- Leitura de usuários usa `empresaNavegacaoId` e deve confirmar que a empresa pertence ao usuário autenticado com `verificarEmpresaPertenceAoUsuario`.
- Ao criar uma empresa, crie também o vínculo em `usuarios_empresas` para o usuário criador.
- Ao criar vínculo entre usuário e empresa, se o usuário vinculado ainda não possuir `empresa_padrao`, defina a empresa do vínculo como padrão.

## Frontend e chamadas de API

Use `src/utils/api.ts` para chamadas do front para o back. Não espalhe `fetch` diretamente em componentes, páginas ou hooks.

Exemplo:

```ts
const resposta = await requisitarAPI("/api/recurso", {
    method: "POST",
    body: dados,
});
```

Mesmo em consultas `GET`, mantenha o `method` explícito.

Toda função do front que fizer requisição ao back deve concentrar a chamada dentro de um único bloco `try/catch`. Se cair no `catch`, exiba a mensagem usando `ModalResposta`.

## Empresa de navegação

A sidebar é responsável por definir e atualizar `empresaNavegacaoId` no `localStorage`.

Padrões:

- A sidebar carrega as empresas vinculadas ao usuário.
- Se existir `empresaNavegacaoId` válido no `localStorage`, ele deve ser respeitado.
- Se não existir, use a empresa padrão do usuário ou a primeira empresa vinculada.
- Ao trocar a empresa de navegação, atualize o `localStorage` e recarregue a página.
- Quando houver apenas uma empresa, o seletor deve ficar desabilitado e fixo nessa empresa.
- Telas que dependem de empresa de navegação devem enviar `empresaNavegacaoId` para a API.

## Autenticação e Proxy

O arquivo `src/proxy.ts` valida o cookie `app_session` antes de liberar rotas protegidas. Use `validarJWT` de `src/utils/jwt.ts` para validar assinatura e expiração do token.

O JWT de sessão deve incluir `idUsuario` e `ativo`. O proxy usa o payload validado para liberar apenas usuários com `ativo` igual a `true`, evitando consulta ao banco a cada requisição protegida.

Quando uma rota de API precisar do id do usuário logado, use `obterIdUsuarioAutenticado` de `src/utils/autenticacao.ts`.

Mantenha rotas públicas explícitas dentro do proxy. Para APIs protegidas sem JWT válido, retorne resposta padronizada com status `401`; para páginas protegidas, redirecione para `/`.

## Rate limit

Use `src/utils/rateLimit.ts` para limitar tentativas em rotas sensíveis por IP, como login, recuperação de senha, validação de código e alteração de senha.

Padrão:

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

- Aplique o rate limit no início do `try`, antes de consultas ao banco, envio de e-mail ou validação de credenciais.
- Use um `identificador` específico para cada fluxo.
- O util atual guarda tentativas em memória do processo. Para produção com múltiplas instâncias, substitua por armazenamento compartilhado.
- Mantenha status `429` quando o limite for excedido.

## Utils

Todos os utils ficam em `src/utils`. Antes de criar um novo util, verifique se a função pertence a algum arquivo existente.

### `api.ts`

- `requisitarAPI`: cliente padrão do frontend para chamadas à API interna.
- Exige `method` explícito.
- Serializa `body` como JSON.
- Lê a resposta no contrato `{ sucesso, msg, dados }`.
- Lança `Error` com `msg` da API quando a resposta não for `ok`.

### `autenticacao.ts`

- `obterIdUsuarioAutenticado`: obtém o id do usuário autenticado a partir do cookie `app_session`.
- Use em rotas de API quando precisar identificar o usuário logado.

### `criptografia.ts`

- `criarHash`: cria hash e salt para senhas.
- `validarHash`: valida senha em texto puro contra hash e salt salvos.
- Use em fluxos de cadastro, alteração de senha e login.

### `criptografiaReversivel.ts`

- `criptografarValor`: criptografa valores que precisam ser recuperados depois.
- `descriptografarValor`: descriptografa valores salvos com `criptografarValor`.
- Use para configurações sensíveis editáveis, como SMTP.
- Depende de `JWT_SECRET_REVERSIVEL`.

### `empresaUsuario.ts`

- `verificarEmpresaPertenceAoUsuario`: retorna `true` quando a empresa informada está vinculada ao usuário autenticado.
- Recebe `request` e `idEmpresa`.
- Use em rotas que precisam validar leitura ou navegação por empresa do usuário autenticado.

### `jwt.ts`

- `criarJWT`: cria o JWT de sessão.
- `validarJWT`: valida assinatura e expiração do JWT.
- `obterPayloadJWT`: obtém payload do JWT de sessão.
- `criarJWTRecuperacaoSenha`: cria JWT temporário para recuperação de senha.
- `obterPayloadRecuperacaoSenhaJWT`: valida e lê payload do fluxo de recuperação de senha.
- Depende de `JWT_SECRET` e das variáveis de validade.

### `permissoes.ts`

- `verificarPermissaoAPI`: valida se o usuário autenticado está ativo, possui perfil ativo e tem permissão para o recurso/ação.
- Retorna `null` quando permitido ou uma resposta padronizada quando bloqueado.
- Deve ser a primeira validação de autorização em rotas protegidas por permissão.

### `rateLimit.ts`

- `obterIpRequisicao`: extrai IP provável da requisição.
- `verificarRateLimitPorIp`: controla tentativas por IP em memória.
- Use em login e recuperação de senha.

### `respostaApi.ts`

- `criarRespostaApi`: cria respostas JSON padronizadas no contrato:

```ts
{
    sucesso: boolean;
    msg: string;
    dados: unknown | null;
}
```

Use em todas as rotas de API.

### `usuarioAdmin.ts`

- `verificarUsuarioAdministrador`: verifica o campo `"isAdmin"` da tabela `usuarios`.
- Recebe o id do usuário.
- Retorna `true` apenas quando o usuário existe e é admin.
- Use após `obterIdUsuarioAutenticado` em rotas que exigem administrador.

### `validacoes.ts`

- `validarStringComConteudo`: confirma se um valor desconhecido é string preenchida.
- `validarEmail`: valida formato básico de e-mail.
- `normalizarCampoOpcional`: transforma campos opcionais vazios em `null`.
- Use antes de aplicar `trim()`, `toLowerCase()` ou salvar dados.

## Services

Services ficam em `src/services`.

- `database.ts`: centraliza a conexão PostgreSQL e expõe `consultarBancoDados`.
- `email.ts`: centraliza envio de e-mails.

Não coloque estado React dentro de services. Não importe componentes dentro de services.

## Páginas e layout

- Rotas ficam em `src/app`.
- `src/app/layout.tsx` mantém configurações globais.
- `src/app/(app)/layout.tsx` mantém estrutura da área interna.
- Estilos globais ficam em `src/app/cssGlobal.css`.
- Telas com `TabelaDados` devem seguir o padrão de `src/app/(app)/usuarios/page.tsx`: cabeçalho simples, ação principal com `Botao`, carregamento via `requisitarAPI`, erros em `ModalResposta` e tabela pelo componente `TabelaDados`.

## Estilo e TypeScript

- Mantenha `strict` sem relaxar configurações do TypeScript.
- Prefira tipos e interfaces explícitos para props e dados de API.
- Evite `any`; use tipos específicos, `unknown` com narrowing ou generics.
- Não adicione bibliotecas novas sem necessidade clara.
- Comentários devem explicar decisões ou trechos não óbvios, não repetir o que o código já diz.
- Funções e componentes devem possuir comentários curtos em formato JSDoc explicando seu uso quando forem reutilizáveis ou relevantes para o fluxo.

## Padrão de cores

Use a paleta da sidebar como referência visual:

- Fundo principal: `#f4f7fb`.
- Superfícies claras, cards e formulários: `#ffffff`.
- Bordas claras: `#dce3ec`.
- Texto principal em telas claras: `#172033` ou `#273142`.
- Texto secundário: `#6c757d`.
- Sidebar e navegação interna: `#111827`.
- Texto principal sobre fundo escuro: `#e5edf8`.
- Texto secundário sobre fundo escuro: `#94a3b8`.
- Ação primária: `#0d6efd`.
- Ícones na sidebar: `#60a5fa`.
- Hover/ativo em navegação escura: `rgba(255, 255, 255, 0.09)`.
- Divisórias em navegação escura: `rgba(255, 255, 255, 0.08)` ou `rgba(255, 255, 255, 0.1)`.

Ao criar novas telas internas, mantenha fundos claros com conteúdo em cards brancos e use a sidebar escura como âncora visual.

## Cuidados ao editar

- Não reverta alterações existentes sem pedido explícito.
- Leia os arquivos ao redor antes de mudar padrões.
- Mantenha alterações pequenas e coesas.
- Atualize este arquivo quando a arquitetura, regras de autorização ou utils mudarem.
- Se alterar comportamento visível ou fluxo principal, considere atualizar também o `README.md`.
