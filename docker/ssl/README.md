# SSL

Acá van los certificados que nginx sirve en `docker-compose.prod.yml`
(`fullchain.pem` + `privkey.pem`). **Nunca se commitean** — ni siquiera el
self-signed de prueba: es la misma regla de siempre para credenciales, y una
key "de ejemplo" que queda en el historial de git deja de ser privada para
siempre. Por eso `docker/ssl/*.pem` está en `.gitignore`.

## Desarrollo / pruebas locales del stack completo

```bash
make ssl-generate
```

Genera un self-signed válido por 1 año para `localhost`/`127.0.0.1`. El
navegador lo va a marcar como inseguro (es autofirmado) — para probarlo con
`curl` hace falta `-k`:

```bash
curl -k https://localhost/health
```

`make docker-up-prod` lo genera solo si todavía no existe, así que
`docker-compose.prod.yml` levanta sin pasos manuales.

## Producción de verdad

Reemplazá `fullchain.pem`/`privkey.pem` por certificados reales antes de
exponer esto a internet. Opciones típicas:

- [Let's Encrypt](https://letsencrypt.org/) vía `certbot` (gratis, se
  renueva solo).
- El certificado que te dé tu proveedor de hosting/CDN.

Los nombres de archivo tienen que ser exactamente esos dos — `nginx.conf`
los referencia así (`/etc/nginx/ssl/fullchain.pem` y
`/etc/nginx/ssl/privkey.pem` dentro del contenedor).
