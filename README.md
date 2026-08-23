# 🌱 Contador de Sementes (SeedCounter)

**Contagem, classificação e morfometria de sementes no navegador, sem enviar dados para a nuvem.**

[App estável](https://seedcounter.vercel.app) · [Versão de teste](https://seedcounter-teste.vercel.app) · [Site do projeto](https://enricristo.github.io/seedcounter/)

## Visão geral

Ferramenta desenvolvida para o **GPEOrq / GPSEM — Laboratório de Sementes e Tecido Vegetal da Unoeste**, voltada à contagem e análise de viabilidade de sementes, incluindo sementes de orquídea em escala milimétrica.

Todo o processamento acontece localmente no navegador.

## Recursos

- Captura por câmera ou importação de imagens
- Calibração espacial por DPI, referência física, micrômetro ou µm/px manual
- Contagem e classificação manual-assistida
- Detecção por IA e detecção assistida
- Morfometria, estatística e modo longitudinal
- Exportação em CSV, JSON, PDF, imagem anotada e YOLO
- PWA com uso offline

## Uso

### Produção

- **Estável:** https://seedcounter.vercel.app
- **Teste:** https://seedcounter-teste.vercel.app

### Local

```bash
git clone https://github.com/enricristo/seedcounter.git
cd seedcounter
npm install
npm run dev
```

## Privacidade

- Os dados ficam no navegador via IndexedDB.
- A inferência de IA roda localmente.
- Se existir configuração opcional de IA no ambiente, ela deve ser tratada como sensível e restrita por domínio/uso.

## Estrutura

```text
src/
docs/
public/
```

## Contribuindo

Veja `CONTRIBUTING.md` para o fluxo de branches e as boas práticas do projeto.

## Autoria

- Desenvolvimento: Enrico S. Ambrosio
- Orientação: Prof. Dr. Nelson Barbosa Machado Neto
- Validação: Mayara de Oliveira Vidotto Figueiredo

## Licença

MIT
