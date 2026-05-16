# Template Next.js (TypeScript + Tailwind)

Este projeto é um **template base** criado com Next.js para acelerar o desenvolvimento de aplicações modernas utilizando boas práticas desde o início.

A proposta é ter uma base pronta com estrutura organizada, componentes reutilizáveis, autenticação, rotas protegidas, modais, tabelas, services e utilitários comuns para evolução em novos projetos. O template deve permanecer genérico e fácil de adaptar para diferentes domínios.

---

## Stack utilizada

* Next.js com App Router
* TypeScript com `strict`
* Tailwind CSS
* React Bootstrap para modais
* React Select para selects
* React Icons para ícones
* PostgreSQL via `pg`
* Nodemailer para envio de e-mails
* ESLint

---

## Funcionalidades da aplicação

O template inclui uma base funcional para aplicações administrativas e sistemas internos, mantendo os fluxos genéricos para reaproveitamento:

* Autenticação por e-mail e senha com sessão via cookie.
* Validação de sessão por JWT em rotas protegidas.
* Redirecionamento automático para páginas protegidas e públicas.
* Recuperação de senha com envio de código por e-mail.
* Rate limit em rotas sensíveis, como login e recuperação de senha.
* Layout interno com sidebar e navegação protegida.
* Tela inicial interna para acesso rápido às áreas principais.
* Gestão base de usuários, perfis e vínculos de acesso.
* Gestão base de entidades organizacionais reutilizáveis.
* Tela de configurações gerais para parâmetros da aplicação.
* Tela de minha conta para manutenção dos dados do usuário autenticado.
* Rotas de API com resposta padronizada em `sucesso`, `msg` e `dados`.
* Cliente utilitário para chamadas do frontend para a API interna.
* Modais reutilizáveis de confirmação, resposta e carregamento.
* Componentes reutilizáveis de botão, input, select e tabela de dados.
* Utilitários para validações, autenticação, permissões, JWT, criptografia e respostas de API.
* Service de banco de dados centralizado.
* Service de e-mail centralizado.

Essas funcionalidades servem como ponto de partida. Regras específicas de negócio devem ser adicionadas pela aplicação final, não diretamente no template.

---

## Criação do projeto

Este template foi criado com o comando:

```bash
npx create-next-app@latest template-next
```

Configurações:

* TypeScript
* ESLint
* App Router
* Estrutura com `src/`
* Alias de importação (`@/*`)
* Tailwind CSS
* AGENTS.md

---

## Dependências de UI

O padrão visual do template é Tailwind CSS. Use classes utilitárias do Tailwind para páginas, layouts e componentes reutilizáveis.

O `react-bootstrap` deve ser mantido para modais, especialmente os componentes em `src/components/modals`, que seguem o padrão de uso de `react-bootstrap/Modal`.

---

## Configuração do Tailwind

O Tailwind é processado pela configuração do PostCSS em `postcss.config.mjs` e usado nos estilos globais da aplicação.

Os estilos globais ficam em:

```text
src/app/cssGlobal.css
```

---

## Estrutura inicial

```text
template-next/
├── database/
├── src/
│   ├── app/
│   │   ├── (app)/       # páginas internas protegidas
│   │   ├── api/         # API interna do Next.js
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── cssGlobal.css
│   ├── components/      # componentes reutilizáveis
│   ├── services/        # integrações e clientes externos
│   ├── utils/           # funções auxiliares
│   └── proxy.ts         # proteção de rotas
├── AGENTS.md
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## Como rodar o projeto

Instale as dependências:

```bash
npm install
```

Rode o ambiente de desenvolvimento:

```bash
npm run dev
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

Outros comandos úteis:

```bash
npm run lint
npm run build
```

---

## Objetivo do template

Este template foi criado com foco em:

* Desenvolvimento rápido com funcionalidades base já estruturadas.
* Organização por responsabilidades.
* Reutilização de componentes, services e utils.
* Estilização padronizada com Tailwind CSS.
* Modais reutilizáveis com React Bootstrap.
* Contratos consistentes entre frontend e API.
* Segurança inicial para autenticação, sessão e rotas protegidas.
* Escalabilidade para pequenos e médios projetos.
