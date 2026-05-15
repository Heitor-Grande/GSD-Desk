# Template Next.js (TypeScript + Tailwind)

Este projeto é um **template base** criado com Next.js para acelerar o desenvolvimento de aplicações modernas utilizando boas práticas desde o início.

A proposta é ter uma base pronta com estrutura organizada, componentes reutilizáveis e estilização utilizando Tailwind CSS como padrão visual. O `react-bootstrap` permanece no projeto para componentes de modal, mantendo os modais reutilizáveis já previstos no template.

---

## Stack utilizada

* Next.js
* TypeScript
* Tailwind CSS
* React Bootstrap para modais
* ESLint

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
├── public/
├── src/
│   ├── app/
│   │   ├── api/          # API interna do Next.js
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── cssGlobal.css
│   ├── components/       # componentes reutilizáveis
│   ├── services/         # integração com APIs
│   ├── hooks/            # hooks customizados
│   └── utils/            # funções auxiliares
├── AGENTS.md
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## Como rodar o projeto

```bash
npm run dev
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

---

## Objetivo do template

Este template foi criado com foco em:

* Desenvolvimento rápido com componentes prontos
* Organização de código
* Reutilização de componentes
* Estilização padronizada com Tailwind CSS
* Modais reutilizáveis com React Bootstrap
* Escalabilidade para pequenos e médios projetos
