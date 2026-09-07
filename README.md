# Qat

Qat es un harness para QA manual pensado para usarse principalmente con **lenguaje natural**. Lee tickets Jira, genera casos, los sincroniza con Xray y publica resultados/evidencias.

Funciona **sin API de Claude**: usa Claude CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.4.0**.

## Instalación

Requisitos: Node.js 18+, Claude CLI instalado/autenticado y acceso a Jira Cloud.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

Editá `.env` con Jira/Xray y, si hace falta, ambiente/usuario de prueba.

```env
LLM_PROVIDER=claude-cli
CLAUDE_COMMAND=claude
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token

XRAY_ENABLED=true
XRAY_TEST_ISSUE_TYPE=Test
XRAY_EXECUTION_ISSUE_TYPE=Test Execution
XRAY_LINK_TYPE=Tests
XRAY_EXECUTION_LINK_TYPE=Tests

QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

`.env` está ignorado por Git. Nunca guardes passwords/tokens reales en el repositorio. Las credenciales de prueba no se incluyen en los prompts enviados a Claude.

## Uso recomendado: hablale a Qat

No hace falta memorizar comandos internos.

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
```

```bash
npm run qat -- "genera los casos de QA-123 y guárdalos"
```

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

Para revisar sin modificar Jira:

```bash
npm run qat -- "sube los tests de QA-123 a Xray sin modificar"
```

También podés pedir:

```bash
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

Qat primero intenta entender pedidos comunes localmente para no gastar tokens. Si el pedido es más libre, Claude interpreta la intención y devuelve una acción estructurada. Claude **no ejecuta Jira directamente**: el código de Qat valida la acción y usa sus funciones de Jira/Xray.

## Ambientes y credenciales

Mantenemos un ambiente activo por `.env`:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

Para staging cambiás esos cuatro valores. `QAT_USER` y `QAT_PASSWORD` son opcionales.

Verificá la configuración sin mostrar secretos:

```bash
npm run doctor
```

## Flujo simple

1. Pedí: `"analiza QA-123 y genera casos de prueba"`.
2. Revisá los casos.
3. Pedí: `"sube los tests de QA-123 a Xray sin modificar"`.
4. Si está bien: `"crea los tests de QA-123 en Xray"`.
5. Ejecutá las pruebas.
6. Registrá resultados/evidencias.

Para Test Executions completos todavía se conserva el archivo `execution.json` porque evita interpretar ambiguamente estados y evidencias:

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

Estados: `PASS`, `FAIL`, `BLOCKED`, `TODO`.

## Comandos clásicos

El lenguaje natural es una capa sobre operaciones determinísticas. Los comandos clásicos siguen disponibles para scripts/CI y debugging:

```bash
npm run doctor
npm run qat -- generate QA-123 [--save]
npm run qat -- xray-sync QA-123 [--dry-run] [--save]
npm run qat -- execute QA-123 execution.json [--dry-run]
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## Claude CLI

Qat no necesita una API key de Anthropic.

```bash
claude --version
```

Si la empresa usa otro wrapper:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Tokens

- pedidos naturales comunes se reconocen localmente cuando es posible;
- Claude se usa como fallback para interpretar pedidos libres;
- sólo se envían campos útiles del ticket;
- `TOKEN_BUDGET` limita contexto;
- respuestas de generación se cachean;
- evidencias y passwords no se envían al LLM.

## Seguridad

- `.env` ignorado por Git;
- passwords/tokens no se imprimen;
- Claude interpreta intención pero no tiene acceso directo a las funciones Jira/Xray;
- las acciones reales pasan por código controlado de Qat;
- `--dry-run` sigue disponible para operaciones sensibles.

## Estructura

```text
src/
  cli.js
  natural.js
  config.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
  execution.js
test/
examples/
artifacts/
evidence/
```

## Limitaciones actuales

- lenguaje natural cubre generación, Xray sync, comentarios y evidencias; Test Execution completo todavía usa JSON;
- Jira Cloud REST API v3; Server/Data Center necesitará adapter;
- Xray puede tener custom fields/nombres distintos según instalación;
- actualizar Test Runs nativos de Xray sigue pendiente.

## Próximos pasos

- llevar también Test Executions/resultados a lenguaje natural;
- modo conversacional interactivo `qat`;
- Test Runs nativos de Xray;
- detección automática de campos Xray;
- Test Plans/suites;
- seguir reduciendo llamadas al LLM y consumo de tokens.
