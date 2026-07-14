# SeedCounter — Contador de Sementes (Pesquisa)

[![Status](https://img.shields.io/badge/status-active-brightgreen)](https://vercel.com) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Uma ferramenta 100% client-side para contagem manual-assistida de sementes em imagens de placas de cultura, projetada para privacidade de dados de pesquisa, facilidade de uso no laboratório e exportação de resultados para análise.

---

Índice
- Visão geral
- Funcionalidades
- Instalação (desenvolvimento)
- Uso (rápido)
- Deploy (opções seguras)
- Dados e backup
- Contribuição
- Licença

---

Visão geral

SeedCounter é uma aplicação que permite marcar e contar sementes em imagens, diferenciando itens viáveis de detritos, com opções de exportação em CSV/JSON/PDF para posterior análise estatística.

Funcionalidades principais
- Marcação visual: marca sementes viáveis e inviáveis com cliques (suporte a teclas modificadoras).
- Totalmente client-side: todas as operações e dados ficam no navegador por padrão (Local Storage). Sem backend por padrão.
- Exportação: CSV, JSON, imagens anotadas e PDF.
- Fluxo em lotes: suporte a importação de múltiplas placas e avançar em fila.
- Backup/Importação: exportação e importação de histórico em JSON.

Instalação (desenvolvimento)

Requisitos
- Node.js 18+ e npm instalados

Passos
1. Clone o repositório

```bash
git clone https://github.com/enricristo/seedcounter.git
cd seedcounter
```

2. Instale dependências

```bash
npm install
```

3. Rodar em modo de desenvolvimento

```bash
npm run dev
```

Acesse em http://localhost:3000

Uso (rápido)

1. Abra a imagem da placa no aplicativo.
2. Marque sementes viáveis com clique esquerdo.
3. Marque detritos/inviáveis com Shift+clique ou clique direito.
4. Use “Exportar” para salvar CSV/JSON/Imagem anotada.

Deploy (opções seguras — não alteram o deploy atual no Vercel)

- Vercel: recomendado para compartilhar internamente no laboratório. Se o projeto já está conectado e funcionando no Vercel, não é preciso alterar nada aqui — manter o deploy atual.
- GitHub Pages: adiciona uma pasta `docs/` com conteúdo estático (pré-visualização). Neste branch as mudanças ficam em `docs-upgrade` e não afetam o deploy do Vercel até que o PR seja mesclado e as configurações de Pages sejam aplicadas.
- Deploy offline: para ambientes sem internet, executar `npm run build` e servir os arquivos estáticos localmente (ou empacotar via Nativefier para um executável).

Dados e backup

- Histórico e contagens são salvos localmente. Para backup, use a funcionalidade de exportar JSON/CSV e armazene em local seguro.

Contribuição

Contribuições são bem-vindas. Para contribuir:
1. Fork + clone
2. Crie uma branch com uma mudança por PR (`feature/descrição`)
3. Abra PR descrevendo o que foi alterado

Licença

MIT — ver arquivo LICENSE

Contato

Para dúvidas ou suporte: abra uma issue no repositório ou envie e-mail ao mantenedor.
