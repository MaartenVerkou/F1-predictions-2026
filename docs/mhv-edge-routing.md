# MHV Edge Routing

The shared MHV edge lives on `mhv-server` and routes public HTTP(S) traffic through the central Caddy container.

## Live Layout

- Caddy container: `mhv-caddy`
- Caddy config: `/srv/edge/current/Caddyfile`
- Shared Docker network: `mhv-web`
- Public ports: `80`, `443`, and `443/udp`

## DNS Pattern

Use one broad Cloudflare wildcard for first-level MHV subdomains:

```text
A  *  46.224.235.219  Proxied
```

Keep explicit DNS records where Cloudflare requires them for the zone apex or other non-wildcard services, such as `mhvmade.com`.

Cloudflare Universal SSL covers `mhvmade.com` and first-level names like `kinara.mhvmade.com` or `f1-preview-123.mhvmade.com`. Avoid deeper app hostnames such as `kinara.apps.mhvmade.com` unless a separate certificate strategy is configured.

## Current Public Routes

- `mhvmade.com` and `www.mhvmade.com` route to the MHV portfolio.
- `apps.mhvmade.com` routes to the apps overview; `/server/` routes to Portainer.
- `kinara.mhvmade.com` routes to Kinara.
- `wheelofknowledge.com` and `www.wheelofknowledge.com` route to the F1 app.
- `f1.mhvmade.com` and `wok.mhvmade.com` redirect to `wheelofknowledge.com`.

## Future Preview Routes

Codex-generated preview environments should use first-level MHV hostnames:

```text
https://f1-preview-<run-id>.mhvmade.com
https://kinara-preview-<run-id>.mhvmade.com
```

Caddy routes should remain explicit for known apps and active preview runs. Unknown wildcard hostnames should fail closed instead of being forwarded to a default app.
