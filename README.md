# Qat

Qat es un harness simple para ayudar a QA manuales a convertir tickets en planes/casos de prueba, sincronizarlos con Xray y publicar resultados/evidencias nuevamente en Jira.

Está pensado para funcionar **sin API de Claude**: usa `claude` por CLI cuando la empresa ya provee acceso de esa forma. La arquitectura queda abierta a otros proveedores.

## Estado actual

Versión **0.2.0**.

Incluye:

- lectura de tickets Jira Cloud;
- generación de casos con Claude CLI;
- salida Markdown para revisión humana;
- salida JSON estructurada para Xray;
- creación y actualización idempotente de issues tipo `Test`;
- link automático entre ticket origen y Test;
- comentarios de resultados en Jira;
- adjuntos de evidencias;
- caché local y presupuesto de contexto para reducir tokens;
- modo `--dry-run` para probar el sync sin modificar Jira.

## Requisitos

- Node.js 18+
- Claude CLI instalado y autenticado (`claude --version`)
- Jira Cloud accesible por REST
- Xray instalado/configurado en Jira para usar `xray-sync`

> La v0.2 usa Jira REST API v3. Jira Server/Data Center necesitará un adapter específico en una versión posterior.

## Instalación

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

Editá `.env` con tus credenciales/configuración.

## Configuración mínima

```env
LLM_PROVIDER=claude-cli
CLAUDE_COMMAND=claude

JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token

XRAY_ENABLED=true
XRAY_TEST_ISSUE_TYPE=Test
XRAY_LINK_TYPE=Tests

TOKEN_BUDGET=12000
```

No subas `.env` al repositorio.

### Proyecto de Tests

Por defecto, Qat crea los Tests en el mismo proyecto que el ticket origen.

Para guardarlos en otro proyecto:

```env
XRAY_PROJECT_KEY=QA
```

### Campo Test Type de Xray

Algunas instalaciones de Xray exponen `Test Type` como un custom field de Jira. Si necesitás completarlo:

```env
XRAY_TEST_TYPE_FIELD=customfield_12345
XRAY_TEST_TYPE_VALUE=Manual
```

Si no hace falta, dejá `XRAY_TEST_TYPE_FIELD` vacío.

### Tipo de link

Qat usa por defecto:

```env
XRAY_LINK_TYPE=Tests
```

Si tu Jira/Xray usa otro nombre para el link entre requisito y Test, reemplazalo por el nombre exacto configurado en Jira.

## Uso rápido

Verificar instalación:

```bash
npm run doctor
```

Ejecutar tests internos del proyecto:

```bash
npm test
```

### Generar casos para revisión

```bash
npm run qat -- generate QA-123
```

Guardar Markdown en `artifacts/`:

```bash
npm run qat -- generate QA-123 --save
```

### Probar qué enviaría a Xray

Este es el comando recomendado antes del primer sync:

```bash
npm run qat -- xray-sync QA-123 --dry-run --save
```

Claude devuelve casos estructurados y Qat muestra qué issues crearía o actualizaría, pero **no modifica Jira**.

El JSON generado queda en:

```text
artifacts/QA-123-xray.json
```

### Crear o actualizar Tests en Xray

Cuando el dry-run se vea correcto:

```bash
npm run qat -- xray-sync QA-123
```

Para cada caso Qat:

1. genera un ID estable, por ejemplo `TC-001`;
2. busca un Test previo asociado al ticket + ID;
3. si existe, lo actualiza;
4. si no existe, crea un issue tipo `Test`;
5. agrega el link entre el ticket origen y el Test.

Esto evita duplicar Tests al repetir el comando.

Qat identifica los Tests con labels similares a:

```text
qat
qat-source-qa-123
qat-case-tc-001
```

### Publicar resultados

```bash
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
```

### Adjuntar evidencia

```bash
npm run qat -- evidence QA-123 ./evidence/login.png
```

### Ayuda

```bash
npm run qat -- --help
```

## Claude por CLI

Qat no necesita una API key de Anthropic cuando `LLM_PROVIDER=claude-cli`. Ejecuta el comando configurado en `CLAUDE_COMMAND` y envía el prompt por stdin.

Comprobación rápida:

```bash
claude --version
printf "Respondé solamente OK" | claude
```

Si tu instalación corporativa usa otro wrapper:

```env
CLAUDE_COMMAND=mi-claude-corporativo
```

## Flujo recomendado

1. QA toma un ticket Jira.
2. `qat generate ABC-123` genera una versión legible de los casos.
3. QA revisa requisitos, cobertura y ambigüedades.
4. `qat xray-sync ABC-123 --dry-run --save` prepara el sync.
5. QA revisa el JSON.
6. `qat xray-sync ABC-123` crea/actualiza Tests.
7. QA ejecuta las pruebas.
8. `qat comment` publica el resumen del resultado.
9. `qat evidence` adjunta capturas, logs u otras evidencias.

## Optimización de tokens

La estrategia inicial es deliberadamente simple:

- enviar sólo campos útiles del ticket;
- truncar contexto según `TOKEN_BUDGET`;
- cachear respuestas por ticket + prompt;
- reutilizar resultados previos;
- separar generación, sincronización y reporte;
- evitar enviar evidencias binarias al LLM;
- usar IDs estables para no regenerar trabajo innecesariamente.

En versiones posteriores se puede evaluar EnGram, Ponytail u otra capa de memoria/compresión si reduce costo y latencia sin volver frágil el flujo.

## Estructura

```text
src/
  cli.js
  config.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
test/
  xray.test.js
artifacts/
evidence/
```

## Seguridad

- `.env` está ignorado por Git.
- Qat no imprime tokens en consola.
- Las credenciales de Jira sólo se envían al host configurado.
- Las evidencias se adjuntan directamente a Jira y no pasan por Claude.
- `--dry-run` permite inspeccionar el resultado antes de modificar Jira/Xray.

## Limitaciones v0.2

- Xray cambia algunos custom fields según instalación; por eso `Test Type` es configurable.
- El nombre del issue type (`Test`) y del link (`Tests`) también puede variar.
- Los pasos se guardan inicialmente en la descripción del Test. El próximo adapter específico de Xray podrá escribir directamente en los campos nativos de pasos cuando se detecte/configure su esquema.
- La integración actual apunta a Jira Cloud.

## Próximos pasos

- detectar automáticamente metadata/campos de Xray;
- escribir pasos directamente en el modelo nativo de Xray;
- Test Executions y Test Plans;
- registrar resultados Pass/Fail por Test;
- adjuntar evidencias a Test Executions;
- importar suites existentes;
- adapters adicionales para Jira Server/Data Center;
- mejorar la memoria/caché para reducir todavía más tokens.
