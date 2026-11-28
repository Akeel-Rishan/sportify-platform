# infra/nginx

## Step 13 authority-preserving proxy example

Use this location only inside vetted TLS virtual hosts. Restrict the upstream listener to trusted infrastructure, reject unsupported hosts at the default server and configure probe Host explicitly.

```nginx
location /api/v1/ {
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Forwarded "";
    proxy_set_header X-Forwarded-Host "";
    proxy_set_header X-Forwarded-Proto "";
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Original-Host "";
    proxy_set_header CF-Connecting-IP "";
    proxy_set_header X-Tenant "";
    proxy_set_header X-Tenant-ID "";
    proxy_set_header X-Tenant-Public-ID "";
    proxy_set_header X-Tenant-Slug "";
    proxy_pass http://sportify_api;
}
```

Define `sportify_api` on the private network. Test the full edge locally or in staging before using it. This example preserves Host without supplying a hostname fallback. The API still rejects competing tenant selector headers and trusts the immediate socket peer for source limits. [Application trust and deployment gates](../../Docs/security/host-and-proxy-trust.md)
