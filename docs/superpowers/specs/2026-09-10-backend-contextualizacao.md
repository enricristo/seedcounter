# Backend — contextualização antes de integrar

Lido em 10/09/2026, sem alterar nada. O outro agente esgotou a cota e volta de
madrugada; este documento existe para a integração começar informada.

---

## 1. Onde o trabalho está

```
seedcounter_git/
├─ backend/            FastAPI, Docker, storage (R2 / MinIO / mock)   ← fora do repo do frontend
├─ e2e_tests/          118 testes caixa-preta
├─ .agents/            ORIGINAL_REQUEST.md e os relatórios dos agentes
└─ seedcounter/        o frontend — e aqui há MUDANÇA NÃO COMMITADA:
     M  src/lib/db.ts                  esquema v5, tabela telemetryQueue
     ?? src/lib/auth/gis-client.ts     wrapper do Google Identity Services
     ?? src/lib/telemetry/             outbox offline
     ?? src/lib/analytics/             GTM / GA4
```

**Risco imediato:** os dois agentes trabalham na **mesma árvore de trabalho**.
Quando o outro voltar, o primeiro passo dele deveria ser mover isso para um
branch (`feat/backend-integration`) antes de qualquer outra coisa. Do meu lado,
não vou commitar nem tocar nesses arquivos.

A mudança em `db.ts` é aditiva (v5 só acrescenta a tabela) e segue o padrão do
v4. Não conflita com nada meu.

---

## 2. A decisão FastAPI + R2 contra Supabase

**Concordo, e por um motivo que a tabela comparativa subestima.**

O frontend é *offline-first*: o dado do laboratório mora no IndexedDB da
máquina e nunca sai. Isso não é limitação — é a postura de privacidade que faz
sentido para laudo de semente, que tem nome de produtor, lote, safra e
resultado comercial. Backend em Python que o laboratório controla mantém isso
sob a governança dele. Supabase colocaria dado de laudo em infraestrutura de
terceiro por padrão, e aí LGPD deixa de ser um detalhe.

Os outros argumentos (custo de egress, YOLO nativo, afinidade com o stack) são
verdadeiros, mas secundários a este.

---

## 3. O achado que precisa ser resolvido ANTES de domínio público

### A autenticação não existe

`backend/app/core/security.py`, função `get_current_user_id`:

```python
payload = jwt.decode(token, options={"verify_signature": False})
```

O JWT é **decodificado sem verificar a assinatura**. Qualquer pessoa monta um
JWT com o `sub` que quiser e é autenticada como aquele usuário. Não precisa de
chave nenhuma.

E há dois atalhos além disso:

```python
if token.startswith("valid_gis_token_"):        # token de teste aceito em produção
    return token.replace("valid_gis_token_", "user_")

if len(token) >= 8 and token.replace("-","").replace("_","").isalnum():
    return f"user_{token[:32]}"                  # QUALQUER string alfanumérica autentica
```

`Authorization: Bearer abcdefgh` → autenticado como `user_abcdefgh`.

`GOOGLE_CLIENT_ID` existe em `config.py` e **nunca é usado** para verificar
nada.

### Por que "118/118 testes passando" não pegou isso

Os testes e2e usam `valid_gis_token_dr_nelson_123`. Eles verificam que **token
falso funciona** — e é exatamente esse o defeito. A suíte mediu a coisa errada
com 100% de sucesso. É o caso clássico de teste que passa pelo motivo errado, e
o mesmo que já me aconteceu na borracha e no corte por concavidade.

### Alcance hoje

| endpoint | exige usuário? | consequência se público |
|---|---|---|
| `GET/POST /auth/preferences` | "sim" (mas qualquer token vale) | ler e sobrescrever preferências de qualquer usuário |
| `POST /batch/process` | **não** | qualquer um dispara YOLO em lote — custo de computação |
| `POST /telemetry/presigned-url` | **não** | qualquer um obtém URL de upload — custo de storage |
| `GET /export/yolo` | **não** | qualquer um baixa o dataset de treino inteiro |
| CORS | `["*"]` por padrão | qualquer origem chama tudo |

**Enquanto rodar só em Docker local no laboratório, o risco é contido.** No
momento em que ganhar domínio público, nada disso pode estar assim.

### O que resolve

1. **Verificar o ID token do Google de verdade:**
   ```python
   from google.oauth2 import id_token
   from google.auth.transport import requests
   payload = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)
   ```
   Isso checa assinatura contra as chaves públicas do Google, audiência (`aud`)
   e expiração. É o que `GOOGLE_CLIENT_ID` existe para fazer.

2. **Tirar os atalhos do caminho de produção.** O `valid_gis_token_` e o
   fallback alfanumérico podem existir **só** atrás de `settings.TESTING`, e o
   teste que os usa deve afirmar que **em produção eles são recusados**.

3. **Auth nos endpoints de custo:** `/process`, `/presigned-url`, `/export`.
   R3 diz que o uso anônimo continua possível — no *frontend*. Disparar
   computação e storage no servidor de terceiros anonimamente é outra coisa.

4. **`CORS_ORIGINS` explícito** com o domínio quando ele existir.

5. **Limite de taxa** em `/process`, mesmo autenticado.

---

## 4. O que o frontend já tem, e está certo

`src/lib/auth/gis-client.ts` faz `parseJwtPayload` no cliente. **Isso está
certo** — o cliente só precisa ler nome e foto para mostrar; quem tem de
verificar é o servidor. O problema não está aqui.

A telemetria em outbox (`telemetryQueue` no Dexie) é o desenho correto para
offline-first: enfileira local, envia quando há rede, não bloqueia o canvas.

---

## 5. O que precisa ser decidido antes de integrar

- **Onde o laudo vai morar.** Hoje é PDF gerado no navegador. Com backend,
  sobe? Se subir, sobe com nome de produtor e resultado comercial — e aí volta
  a questão do §2. Recomendo: **o laudo continua local por padrão**, e subir é
  ação explícita da pessoa, não sincronização automática.
- **A preferência de bancada é o caso de uso certo para começar.** Espécie
  padrão, DPI, pesquisador — dado sem sensibilidade, e o ganho é real para quem
  usa todo dia.
- **`default_species: "Cattleya labiata"` e `default_researcher: "Dr. Nelson"`
  estão hardcoded** em `auth.py`. Devem vir de `.env` ou ficar vazios.

---

## 6. Resumo em uma frase

A arquitetura está certa; a autenticação está ausente e os testes provam a
ausência com 100% de sucesso. Nada disso impede o uso local; tudo isso impede o
domínio público.
