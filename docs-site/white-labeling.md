---
title: "White Labeling"
description: "Customize Overlay branding for your organization."
---

# White Labeling

Overlay supports full white-label customization: logo, colors, domain, and email templates.

## Configuration

Add to `overlay.config.json`:

```json
{
  "whiteLabel": {
    "appName": "Company AI",
    "logoUrl": "/assets/logo.svg",
    "faviconUrl": "/assets/favicon.svg",
    "primaryColor": "#0A0A0A",
    "accentColor": "#3B82F6",
    "fontFamily": "Inter, system-ui, sans-serif",
    "meta": {
      "title": "Company AI — Enterprise Assistant",
      "description": "AI-powered assistant for your team"
    }
  }
}
```

## Assets

Place custom assets in `public/assets/`:

```
public/
  assets/
    logo.svg
    logo-dark.svg
    favicon.svg
    login-bg.jpg
```

## Custom Domain

1. Point your domain to the Overlay server
2. Set `NEXT_PUBLIC_APP_URL=https://ai.yourcompany.com`
3. Configure TLS (Caddy/NGINX handles this automatically)

## Email Templates

Override default emails by creating files in `templates/email/`:

```
templates/
  email/
    welcome.html
    password-reset.html
    invite.html
```

Templates use Handlebars syntax:

```html
<h1>Welcome to {{appName}}</h1>
<p>Hi {{user.firstName}},</p>
<p>Your account is ready.</p>
```

## Keycloak Theme

For Keycloak auth, create a custom theme:

```bash
# Copy default theme
cp -r keycloak/themes/keycloak keycloak/themes/overlay
# Customize CSS and HTML
# Set as default in Keycloak realm settings
```
