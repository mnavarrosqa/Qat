# Ambientes y perfiles de credenciales

Qat separa dos conceptos que en QA suelen cambiar de manera independiente:

- **Ambiente**: dónde se prueba (`qa`, `staging`, `dev`, etc.). Define principalmente la URL y el contexto de ejecución.
- **Perfil**: con qué identidad se prueba (`admin`, `customer`, `readonly`, etc.). Define usuario y password.

La combinación se puede pensar como `ambiente/perfil`: `qa/admin`, `qa/customer`, `staging/admin`.

Esto permite tener varios ambientes y, al mismo tiempo, varios usuarios dentro de un mismo ambiente sin repetir URLs ni editar credenciales manualmente para cada ejecución.

## Configuración recomendada

Copiá el ejemplo local:

```bash
mkdir -p .qat
cp .qat/environments.example.json .qat/environments.json
```

`.qat/environments.json` está ignorado por Git y puede contener las credenciales locales de prueba.

Ejemplo:

```json
{
  "environments": {
    "qa": {
      "baseUrl": "https://qa.example.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": { "user": "qa.user@example.com", "password": "secret" },
        "admin": { "user": "qa.admin@example.com", "password": "secret" },
        "customer": { "user": "customer@example.com", "password": "secret" }
      }
    },
    "staging": {
      "baseUrl": "https://staging.example.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": { "user": "staging.qa@example.com", "password": "secret" },
        "admin": { "user": "staging.admin@example.com", "password": "secret" }
      }
    }
  }
}
```

En `.env` sólo seleccionás qué combinación querés usar:

```env
QAT_ENVIRONMENTS_FILE=.qat/environments.json
QAT_ENV=qa
QAT_PROFILE=admin
```

## Comandos

Ver todos los ambientes y perfiles disponibles:

```bash
npm run qat -- env list
```

Ver la selección activa sin mostrar secretos:

```bash
npm run qat -- env show
```

Cambiar de ambiente y perfil:

```bash
npm run qat -- env use qa admin
npm run qat -- env use qa customer
npm run qat -- env use staging qa-user
```

`env use` actualiza `QAT_ENV` y `QAT_PROFILE` en `.env`. La password nunca se imprime.

## Perfil por defecto

`defaultProfile` indica la identidad habitual de un ambiente. Es útil cuando la mayoría de las pruebas se hacen con el mismo rol y sólo algunos casos requieren otra cuenta.

Ejemplo conceptual:

```text
qa/qa-user      <- default
qa/admin
qa/customer
qa/readonly
```

## Un solo ambiente con muchos usuarios

También es válido tener únicamente `qa` y varios perfiles:

```text
qa/admin
qa/basic-user
qa/customer-a
qa/customer-b
qa/readonly
```

La URL pertenece al ambiente; las credenciales pertenecen a cada perfil. Esto evita crear falsos ambientes como `qa-admin`, `qa-customer-a` y `qa-customer-b` cuando todos apuntan al mismo sistema.

## Varios ambientes con perfiles equivalentes

Podés repetir nombres lógicos de perfil en diferentes ambientes:

```text
qa/admin
staging/admin
qa/customer
staging/customer
```

Las cuentas reales pueden ser diferentes. Por ejemplo, `qa/admin` puede usar `admin.qa@example.com` y `staging/admin` usar `admin.stg@example.com`. Para Qat ambos representan el mismo rol lógico en contextos diferentes.

## Ejecutar el mismo escenario con distintos roles

Para probar permisos o comportamiento por rol, mantené el ambiente y cambiá sólo el perfil:

```bash
npm run qat -- env use qa admin
# ejecutar escenario

npm run qat -- env use qa customer
# repetir escenario
```

Esto deja explícito qué variable estás cambiando: la identidad, no el ambiente.

## Repetir una prueba en otro ambiente

Si querés repetir una validación en staging, cambiá la combinación completa:

```bash
npm run qat -- env use staging admin
npm run qat -- env show
```

`env show` sirve como control rápido antes de ejecutar pruebas o publicar resultados.

## Convenciones recomendadas

Usá nombres de ambiente cortos y estables, por ejemplo `dev`, `qa`, `staging` y `prod-readonly`. Para perfiles, preferí el rol funcional (`admin`, `customer`, `readonly`, `manager`) en vez del nombre real de una persona. Esto hace que los comandos y futuros pedidos en lenguaje natural sean más claros.

Si necesitás varias cuentas del mismo rol, podés diferenciarlas:

```text
qa/customer-a
qa/customer-b
qa/customer-no-orders
qa/customer-premium
```

## Modo simple / compatibilidad

Si `.qat/environments.json` no existe, Qat sigue soportando el formato anterior:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.example.com
QAT_USER=usuario
QAT_PASSWORD=password
```

No hace falta migrar inmediatamente. El archivo de perfiles es recomendable cuando aparece el segundo ambiente o la segunda identidad de prueba.

## Seguridad

- `.qat/environments.json` está ignorado por Git.
- `.env` también está ignorado por Git.
- `doctor` y `env show` sólo indican si hay credenciales configuradas; no muestran passwords/tokens.
- Las credenciales de prueba no se envían al LLM.
- No copies passwords en tickets, casos de prueba, prompts ni evidencias.
- `.qat/environments.example.json` contiene únicamente valores ficticios y sí se versiona.

## Lenguaje natural

Actualmente la selección se hace con `env use`. La evolución prevista es aceptar pedidos como:

```text
usa QA como admin
cambia a staging como customer
mostrame qué ambiente y usuario de prueba estoy usando
```

La resolución de ambiente/perfil debe hacerse localmente siempre que sea posible para no gastar tokens y, sobre todo, para mantener las credenciales fuera del LLM.
