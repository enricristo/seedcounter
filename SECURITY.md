# Security Policy — Contador de Sementes

## Reporting a Vulnerability

If you discover a security vulnerability, **please report it responsibly** and do not open a public issue.

### How to Report

1. **Email**: Contact the maintainers privately (not GitHub issues)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. **Response**: We will investigate and provide a security update within 7-14 days

---

## Security Guidelines

### Secrets & API Keys

- ⚠️ **GEMINI_API_KEY** is embedded in the JavaScript bundle (client-side)
  - This is **intentional** and safe **only if**:
    - ✅ Key is restricted by domain/usage in Google AI Studio
    - ✅ Usage quota is limited (e.g., 100 requests/day)
    - ❌ Never use unrestricted keys with sensitive access

- ✅ `.env` files are **never committed** (see `.gitignore`)
- ✅ Use `.env.example` as a template
- ✅ For production, rotate keys regularly

### Dependency Security

- Run regular audits: `npm audit`
- Fix vulnerabilities: `npm audit fix`
- Review outdated: `npm outdated`
- CI/CD checks critical vulnerabilities

### Docker Image Security

- Use Alpine-based images (minimal attack surface)
- No root user in runtime images
- Scan images: `docker scout cves seedcounter:latest`
- Never push images with embedded secrets to public registries

### Development Environment

- Keep Docker Desktop updated
- Use `.dockerignore` to exclude sensitive files
- Don't commit `.env` or `.env.*` files
- Review Docker logs for suspicious activity

---

## Supported Versions

| Version | Status | Updates Until |
|---------|--------|---|
| 0.1.x   | Current | Ongoing |
| < 0.1   | Deprecated | No longer supported |

---

## Contact

- **Maintainer**: GPEOrq Lab (Unoeste)
- **Security Contact**: [Configure in GitHub Settings → Security → Private vulnerability reporting]
