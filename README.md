# Juntos+1

Una PWA de finanzas para parejas. En español, calibrada para Perú: soles y
dólares, tarjetas BCP, Yape, TEA, cuotas.

No pretende reemplazar al banco. Pretende responder dos preguntas que el banco
no responde: **cuánto nos queda de verdad este mes** y **quién pagó qué**.

> Proyecto personal, publicado por si le sirve a alguien más. Está hecho para
> el caso de uso de una pareja concreta y se nota: la interfaz está solo en
> español, el login exige Microsoft Entra ID y varios cálculos asumen
> convenciones peruanas. Nada de eso es difícil de cambiar, pero hoy es así.

---

## Qué hace

**Inicio.** Una cifra grande —lo que queda libre este mes— y debajo el ritmo
de gasto contra el que se puede sostener. El gráfico compara tu acumulado con
la diagonal de gastar parejo, con una marca en el día de hoy.

**Movimientos.** La lista completa, agrupada por día, con búsqueda, filtros
por tipo (variable, fijo, suscripción) y edición o borrado deslizando.

**Recurrentes y suscripciones.** Detecta cargos que se repiten a partir de tus
movimientos, avisa cuando cambia el precio, cuando falta un cobro y cuando hay
duplicados. Pausa un recurrente automáticamente si registras el pago antes de
tiempo, y lo reanuda solo al llegar la fecha.

**Nosotros.** Reparto por persona de lo que ya está asignado, y una cola de
movimientos sin autor para asignarlos rápido.

**Tarjeta de crédito.** Utilización, fecha límite, ciclo, TEA, simulador de
pago, estrategia de cuotas y proyección al cierre. Importa el PDF del estado
de cuenta del BCP y lo parsea en el navegador.

**Además:** presupuestos, metas de ahorro, patrimonio neto, recap anual,
notificaciones push con un resumen diario y tipo de cambio en vivo.

---

## Dónde viven tus datos

Conviene ser explícito, porque son datos financieros.

- Todo se guarda en **un archivo JSON en tu propio servidor**, en la ruta que
  indique `DATA_DIR`. No hay base de datos ni servicio de terceros.
- El acceso a la API está detrás de **Microsoft Entra ID**: cada petición
  valida el token contra las claves públicas de tu tenant.
- Los **PDF del banco se parsean en el navegador** con pdf.js. El archivo no
  se sube a ningún sitio.
- Las únicas llamadas externas son a Entra ID (login), a Microsoft Graph si
  usas la sincronización de correo, y a un proveedor de tipo de cambio.

Si despliegas esto, **el servidor es tuyo y los datos también**. También lo es
la responsabilidad de respaldarlos: `DATA_DIR` debería apuntar a un volumen
persistente, fuera del directorio de la aplicación, para que un despliegue no
lo pise.

---

## Stack

React 18 · TypeScript · Vite · PWA con Workbox · Express · Recharts · MSAL
(Microsoft Entra ID) · date-fns · Vitest.

Sin base de datos: un archivo JSON y un candado de escritura.

---

## Arrancarlo en local

Necesitas Node 20+ y un registro de aplicación en Microsoft Entra ID.

```bash
git clone https://github.com/jcastanedacano/juntos-plus.git
cd juntos-plus
npm install
cp .env.example .env
```

Edita `.env` con los identificadores de tu aplicación de Entra ID. Los cuatro
valores de Azure son obligatorios: sin ellos ni el servidor ni el frontend
arrancan, a propósito.

```bash
npm run dev     # frontend en http://localhost:3008
npm start       # API en http://localhost:3007
```

Otros comandos:

```bash
npm run build   # comprueba tipos y compila a dist/
npm test        # tests unitarios
npm run lint
```

### El registro en Entra ID

En el portal de Azure, **Entra ID → Registros de aplicaciones → Nueva**:

1. Tipo de cuenta: la que uses (una sola organización sirve).
2. Plataforma **SPA**, con URI de redirección `http://localhost:3008` para
   desarrollo y tu dominio para producción.
3. Copia el **Id. de aplicación** y el **Id. de directorio** a `.env`.

---

## Desplegarlo

Hay un workflow de GitHub Actions que despliega a Azure App Service en cada
push a `master`: compila en el runner, arma un paquete solo con lo necesario
para ejecutar, sube por zip deploy y no da el despliegue por bueno hasta que
`/healthz` responde 200.

Compila en el runner porque el plan Basic (1.75 GB) se queda sin memoria
compilando Vite en el propio App Service, y la caída se manifiesta como un
reinicio silencioso del contenedor.

Para usarlo necesitas credenciales federadas (OIDC) y estas variables de
repositorio:

| Variable | Para qué |
|---|---|
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Login OIDC |
| `AZURE_RESOURCE_GROUP`, `AZURE_WEBAPP_NAME` | Dónde desplegar |
| `APP_URL` | URL pública, para la comprobación de salud |

Y en la configuración de la App Service, las mismas variables de `.env.example`.

### Saber qué versión está desplegada

Cada build se sella con el SHA del commit. Un service worker sirve el HTML
desde su caché, así que el primer refresco tras un despliegue todavía muestra
la versión anterior; el sello permite notarlo:

```bash
curl -s https://tu-dominio.example/healthz
# {"status":"ok", …, "build":"054bddb","builtAt":"…"}
```

El mismo valor está en `<meta name="build">` del HTML servido.

---

## Notificaciones push (opcional)

```bash
npx web-push generate-vapid-keys
```

Pon el par de claves y un `VAPID_SUBJECT` con un correo real en el entorno.
Si falta cualquiera de los tres, los endpoints de push responden 503 y el
resto del servidor funciona igual.

---

## Licencia

MIT — ver [LICENSE](LICENSE).

---

Construido con [Claude Code](https://claude.com/claude-code).
