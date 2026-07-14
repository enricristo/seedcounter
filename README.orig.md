# Contador de Sementes - Edição Pesquisa Acadêmica

Uma ferramenta **100% Client-Side** para contagem manual-assistida de sementes e análises em placas de cultura, desenvolvida com foco em segurança de dados de pesquisa, usabilidade e agilidade no laboratório.

## Funcionalidades
- **Marcação Visual Inteligente:** Diferencie sementes viáveis (clique esquerdo) de inviáveis/detritos (shift + clique ou clique direito).
- **Sem Backend / Nuvem Privada:** O "banco de dados" utiliza a capacidade da própria máquina do pesquisador (Local Storage do navegador) garantindo privacidade acadêmica absoluta de experimentos não publicados.
- **Exportação Multiformato:** PDF/Imagem anotada, dados brutos georreferenciados (JSON) e planilha agregada para análise estatística (R, Excel, Python).
- **Trabalho em Lotes (Queue):** Importe dezenas de placas de uma vez e avance rapidamente registrando estatísticas contínuas usando "Salvar e Próxima".

---

## Como Fazer o Deploy (Colocar em Prática no Laboratório)

### 1. Implantação na Web (Para a equipe inteira)
A forma mais recomendada para acesso fácil via qualquer computador do laboratório. Por não usar servidor ou banco de dados em nuvem, ferramentas como a Vercel hospedam este site livremente de forma **gratuita para sempre**.

1. **Baixe o projeto:** Utilize o menu de opções ("Settings > Export as ZIP") do AI Studio para baixar os arquivos.
2. Crie uma conta no [Vercel](https://vercel.com) ou [Netlify](https://netlify.com).
3. Na Vercel, clique em **Add New... -> Project**.
4. Não precisa conectar com o GitHub se não quiser. Basta clicar na aba **Upload** e arrastar a sua pasta inteira (extraída do `.zip`) para dentro.
5. O sistema fará o _build_ automático (`npm run build`) e fornecerá um link público seguro (ex: `contador-sementes.vercel.app`), pronto para acesso de qualquer outro computador ou tablet.

### 2. Implantação Local / Sem Internet (Offline Seguro)
Se o computador conectado aos microscópios e câmeras do laboratório não tiver internet:

1. Instale o [Node.js](https://nodejs.org/) na máquina.
2. Com um pendrive, coloque a pasta inteira deste projeto nesse computador.
3. Abra o terminal (Prompt de Comando) na pasta do projeto e instale uma única vez instalando os pacotes requeridos:
   ```bash
   npm install
   ```
4. Para abrir o contador no dia a dia, execute:
   ```bash
   npm run dev
   ```
5. Basta acessar o link `http://localhost:3000` ou (ou o IP que for mostrado no console) diretamente no navegador (Google Chrome, Firefox, etc). O sistema rodará super leve.

### 3. Gerando um Aplicativo "Desktop" Executável (.exe)
Caso o usuário precise utilizar a solução fora de um navegador genérico (que possa ser fechado por engano) você pode transformar essa ferramenta em uma janela independente do Windows/Mac usando o [Nativefier](https://github.com/nativefier/nativefier) ou serviços similares.

Rodando a solução localmente via Node (`npm run dev`), abra outro terminal e digite:
```bash
npx nativefier --name "SeedCounter" "http://localhost:3000"
```
Uma pasta chamada `SeedCounter-win32-x64` será criada contendo o executável. 

---

### Manutenção dos Dados

A aba **Histórico** salva informações via sessão (no banco Web local) e via importação/exportação de JSON puro. Para fazer *backup* de todas contagens realizadas, lembre os pesquisadores de ao fim da semana clicarem em **"Exportar Tabela Completa (CSV)"** na área do histórico.
