# Implantação e Uso Offline (Contador de Sementes)

A aplicação foi projetada para ser extremamente leve, não requerendo servidor (backend) ou banco de dados em nuvem. Todos os dados são processados e armazenados localmente no seu navegador.

Existem duas formas principais de utilizar esta aplicação em produção:

## 1. Uso na Web (Gratuito e Público)

Como o sistema é 100% frontend estático (apenas HTML, JS e CSS), você pode hospedá-lo em qualquer serviço gratuito de sites estáticos.

**Onde hospedar gratuitamente:**
- **GitHub Pages:** Faça o upload dos arquivos da pasta `dist` para um repositório no GitHub e ative o Pages.
- **Vercel / Netlify:** Crie uma conta gratuita, arraste e solte a pasta `dist` e a sua aplicação estará online em segundos.
- **Render.com / Firebase Hosting:** Também são ótimas alternativas.

Para gerar a pasta `dist` otimizada para produção:
```bash
npm run build
```

---

## 2. Uso Local / Offline (Sem Internet)

Se você preferir executar o sistema nos computadores do laboratório, sem depender de internet, siga este método:

### Pré-requisitos
Ter o [Node.js](https://nodejs.org/) instalado no computador onde a aplicação será executada.

### Como Iniciar

1. Faça o download da pasta do projeto.
2. Abra um terminal dentro da pasta do projeto.
3. Instale as dependências executando:
   ```bash
   npm install
   ```
4. Sempre que for usar a aplicação, execute o comando:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000` ou `http://localhost:5173` no navegador de sua preferência.

### Transformando em Aplicativo de Desktop (Opcional)

Caso deseje transformar a ferramenta em um programa clicável (.exe ou .app) que abre na sua própria janela sem depender do Chrome:

Uma ferramenta excelente e rápida para isso é o **Nativefier**.
Após instalar o Node.js, você pode rodar o aplicativo localmente com `npm run dev` e, em outro terminal, rodar:

```bash
npx nativefier --name "SeedCounter" "http://localhost:3000"
```
Isso vai criar uma pasta contendo um executável do seu aplicativo, independente de navegador!
