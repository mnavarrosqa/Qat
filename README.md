# Qat

Qat es un harness para QA manual pensado para usarse principalmente con **lenguaje natural**. Lee tickets Jira, genera casos, los sincroniza con Xray o genera archivos importables, y publica resultados/evidencias.

Funciona **sin API de Claude**: usa Claude CLI cuando la empresa ya provee acceso de esa forma.

## Estado actual

Versión **0.7.0**.

> Para instalación y uso paso a paso consultá [`docs/MANUAL.md`](docs/MANUAL.md).

## Instalación rápida

Requisitos: Node.js 18+, Claude CLI instalado/autenticado y acceso a Jira Cloud.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm run setup
```

Primero verifica Node.js 18+, npm, las dependencias del proyecto y Claude CLI. Si faltan paquetes o Claude, ofrece instalarlos y vuelve a comprobarlos antes de continuar. Podés rechazar la instalación; el setup termina sin guardar configuración. Si falta Node.js/npm, instalalos desde https://nodejs.org antes de ejecutar `npm run setup`. La instalación de Claude usa el [paquete oficial](https://code.claude.com/docs/en/installation).

El asistente crea `.env` y pregunta por la URL de Jira, email, token, comando de Claude, uso de Xray, proyecto de destino y modo API o exportación. También permite configurar el ambiente, la URL de la aplicación y el usuario de pruebas; si ya existe un archivo de ambientes, permite seleccionar un ambiente y perfil existentes.

Los tokens y contraseñas se ingresan sin mostrarse en pantalla. Enter conserva los valores actuales y Ctrl+C cancela sin guardar. La configuración se guarda con permisos de lectura/escritura sólo para tu usuario. No hace falta copiar ni editar `.env` a mano.

Luego validá las conexiones con `npm run doctor`.

`.env` está ignorado por Git. Nunca guardes passwords/tokens reales en el repositorio.

## Xray con o sin API

### Xray Cloud API nativa

```env
XRAY_ENABLED=true
XRAY_MODE=api
XRAY_CLIENT_ID=tu_client_id
XRAY_CLIENT_SECRET=tu_client_secret
```

Qat autentica contra Xray Cloud, usa la API GraphQL para buscar Tests existentes y crear Tests Manuales con sus pasos. Los Tests creados se vinculan al ticket Jira origen.

Validá la conexión sin mostrar secretos:

```bash
npm run doctor
```

### Sin acceso API

```env
XRAY_ENABLED=true
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

El mismo pedido funciona en ambos casos:

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

En modo export genera, por ejemplo:

```text
artifacts/QA-123-xray-import.csv
```

## Hablale a Qat

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
npm run qat -- "genera los casos de QA-123 y guárdalos"
npm run qat -- "crea los tests de QA-123 en Xray"
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

No necesitás escribir exactamente esas frases. Qat intenta reconocer pedidos comunes localmente para ahorrar tokens y usa Claude como fallback para interpretar instrucciones más libres.

Claude interpreta **qué querés hacer**; el código de Qat ejecuta las operaciones reales contra Jira/Xray o genera los artifacts correspondientes.

## Ambientes y perfiles

Qat separa **ambiente** de **perfil de credenciales**.

Un ambiente representa dónde probás (`qa`, `staging`, `dev`) y un perfil con qué identidad (`admin`, `customer`, `readonly`). Esto permite varios ambientes o un único ambiente con muchos usuarios/passwords sin duplicar URLs.

Configuración recomendada:

```bash
mkdir -p .qat
cp .qat/environments.example.json .qat/environments.json
```

En `.env` sólo queda la selección activa:

```env
QAT_ENVIRONMENTS_FILE=.qat/environments.json
QAT_ENV=qa
QAT_PROFILE=admin
```

Comandos:

```bash
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- env use staging qa-user
```

Qat nunca imprime la password. Si no existe `.qat/environments.json`, sigue funcionando el formato anterior con `QAT_BASE_URL`, `QAT_USER` y `QAT_PASSWORD`.

Guía completa: [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md).

## Flujo diario

1. Elegí ambiente/perfil si necesitás cambiar de contexto.
2. Pedí que analice el ticket y genere casos.
3. Revisá casos, cobertura y ambigüedades.
4. Pedí crear los tests en Xray.
5. Con API Cloud nativa se crean/sincronizan; sin API se genera el archivo importable.
6. Ejecutá las pruebas manuales.
7. Registrá PASS/FAIL/BLOCKED/TODO y evidencia.
8. Publicá el Test Execution cuando corresponda.

Los Test Execution completos todavía usan `execution.json`:

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

## Doctor

```bash
npm run doctor
```

`doctor` muestra el ambiente/perfil activos y valida Claude, Jira y Xray. En `XRAY_MODE=api` intenta autenticar contra Xray Cloud y, si no puede, recomienda `XRAY_MODE=export`. Nunca imprime passwords, tokens, client IDs ni secrets.

## Comandos clásicos

```bash
npm run setup
npm run doctor
npm test
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- generate QA-123 [--save]
npm run qat -- xray-sync QA-123 [--dry-run] [--save]
npm run qat -- execute QA-123 execution.json [--dry-run]
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## Seguridad y tokens

- interpretación local cuando es posible;
- Claude como fallback;
- contexto del ticket limitado por `TOKEN_BUDGET`;
- caché de generación;
- `.env` y `.qat/environments.json` ignorados por Git;
- secretos, passwords y evidencias fuera del LLM;
- Xray Cloud usa token temporal obtenido desde `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET`;
- `--dry-run` para inspeccionar cambios antes de escribir.

## Estructura

```text
src/
  cli.js
  setup.js
  natural.js
  config.js
  environments.js
  jira.js
  llm.js
  prompts.js
  cache.js
  xray.js
  xray-cloud.js
  execution.js
.qat/
  environments.example.json
test/
examples/
docs/
  MANUAL.md
  ENVIRONMENTS.md
artifacts/
evidence/
```

## Limitaciones v0.7

- Test Execution completo todavía usa JSON;
- el adapter nativo Xray Cloud crea Tests y evita duplicados, pero la actualización completa de pasos de Tests existentes todavía está pendiente;
- selección de ambientes/perfiles por lenguaje natural queda pendiente;
- Jira Server/Data Center necesitará adapter;
- Xray puede tener custom fields/configuraciones distintas según instalación;
- Test Runs nativos de Xray siguen pendientes.

## Roadmap inmediato

1. actualizar pasos de Tests existentes vía Xray Cloud;
2. cambio de ambiente/perfil por lenguaje natural;
3. resultados y evidencias completamente por lenguaje natural;
4. Test Runs nativos de Xray;
5. perfiles configurables de importación CSV/JSON;
6. Test Plans y suites;
7. optimización continua del consumo de tokens.

## Documentación

- [`docs/MANUAL.md`](docs/MANUAL.md): instalación, setup, configuración, flujo diario, seguridad y troubleshooting.
- [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md): múltiples ambientes y perfiles de credenciales.
- [`.env.example`](.env.example): configuración de referencia.
- [`.qat/environments.example.json`](.qat/environments.example.json): ejemplo de ambientes y usuarios de prueba.
- [`examples/execution.example.json`](examples/execution.example.json): ejemplo de Test Execution.

### Probar un ticket

```bash
npm run qat -- "probemos el ticket AGDCF-1234"
```

El pedido ejecuta directamente las pruebas con Playwright headless y publica PASS/FAIL/BLOCKED en Jira, incluyendo capturas disponibles como adjuntos enlazados. Lee descripción y comentarios; cubre el happy path y las verificaciones explícitas del ticket. Para generar casos sin ejecutar, pedí «genera casos de AGDCF-1234». Si hace falta login o 2FA, Qat abre Chromium visible, espera que te conectes y retoma en headless. No requiere Xray para la segunda opción. Para instalar el navegador: `npx playwright install chromium`. Ver alcance y limitaciones en [el manual](docs/MANUAL.md#probar-un-ticket-de-forma-interactiva).

### Conversar con QAT sin repetir comandos

Una vez instalado el comando con `npm link` desde la carpeta del proyecto, ejecutá `qat` desde cualquier carpeta. El comando usa la configuración y guarda los archivos en ese proyecto.

```text
qat> probemos el ticket AGDCF-1234
```

La ejecución comienza directamente. Al terminar podés pedir otro ticket. Escribí `salir` o presioná Ctrl+C para cerrar. También funciona `qat probemos el ticket AGDCF-1234` para un único pedido. El texto sin prefijo se escribe dentro de QAT, no directamente en la terminal del sistema.

El comando «probá AGDCF-1234» autoriza el flujo de prueba y publicación en ese ticket. Para conservar resultados y evidencias sólo en esta Mac, usá «probá AGDCF-1234 sin publicar». La publicación incluye cobertura, bloqueos y errores de captura o adjuntos; nunca presenta un bloqueo como PASS. Los pedidos de login/2FA pueden requerir intervención.

### Verificaciones y diagnóstico de ejecución

El ejecutor asigna identificadores a los resultados esperados de cada paso (`step-1`, etc.) y al resultado final (`result`). PASS requiere comprobar todos ellos; una respuesta `done` del modelo no basta. El informe local conserva los casos generados, la cobertura por resultado, las observaciones y el historial de verificaciones.

Además de texto exacto, admite valor de campos, controles habilitados/deshabilitados, selección de checkbox, visibilidad y URL exacta. Los elementos ambiguos no se eligen automáticamente para declarar éxito. Las verificaciones tienen una espera acotada para permitir actualizaciones de la página.

Una diferencia observada se informa como FAIL. Los bloqueos distinguen cobertura incompleta, límite de pasos, precondiciones o capacidades faltantes, respuesta inválida del modelo, elementos no disponibles, autenticación y errores de ejecución. El detalle se guarda en `category` dentro del informe local.

La cobertura corresponde a los casos generados: requiere revisión humana para confirmar que representan todos los requisitos del ticket. La interpretación de cada requisito y su correspondencia con la comprobación sigue dependiendo del modelo. La persistencia debe verificarse volviendo al registro; un mensaje de guardado por sí solo no la demuestra. La integración con Test Runs nativos de Xray sigue pendiente.

Cuando el ticket no indica dónde probar, Qat debe descubrir el flujo desde el ambiente configurado usando menús, módulos y búsqueda interna. La generación de casos no considera una ruta ausente como una ambigüedad funcional. Si el ejecutor propone bloquear por navegación, recibe hasta dos oportunidades adicionales para explorar; el límite total de pasos sigue vigente. Si no encuentra el flujo, registra `navigation_not_found` y conserva las acciones intentadas en el historial. La exploración depende de los controles accesibles disponibles en la aplicación.

### Credenciales y login automático

Al entrar al flujo de autenticación, Qat intenta completar un formulario estándar de usuario/email y contraseña con las credenciales activas. No envía estos valores al modelo. Si el formulario es ambiguo, el login falla o requiere 2FA, solicita intervención manual.

Por defecto sólo completa credenciales en el origen del ambiente configurado. Si tu login está en otro dominio, configurá explícitamente los orígenes de confianza en `QAT_LOGIN_ORIGINS` (URLs separadas por comas). No agregues dominios que no correspondan a tu proveedor de identidad. Los flujos SSO de varios pasos siguen siendo manuales. Si existe un archivo de ambientes, sus perfiles determinan las credenciales activas en lugar del fallback de `.env`.

### Recuperación de interacciones

Las acciones del modelo se validan antes de ejecutarse. Una respuesta incompleta devuelve instrucciones de corrección y permite continuar; tres respuestas inválidas terminan con un diagnóstico específico. Las referencias de controles son exclusivas de cada observación: una referencia vieja no puede apuntar accidentalmente a otro botón después de un cambio de pantalla. El historial de errores conserva la acción y el control intentados, sin guardar los valores ingresados. Los controles observados incluyen estado deshabilitado, expansión y contexto disponible de formulario, menú o diálogo.
