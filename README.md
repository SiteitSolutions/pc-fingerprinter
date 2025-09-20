<p align="center">
  <img src="https://raw.githubusercontent.com/your-org/pc-fingerprint/main/logo.png" width="150" alt="PC Fingerprint Logo"/>
</p>

<h1 align="center">PC Fingerprint CLI</h1>

<p align="center">
  🔒 Generate and verify hardware fingerprints for custom PC builds with signed warranty info.
  <br/>
  <br/>
  <a href="https://www.npmjs.com/package/@your-scope/pc-fingerprint"><img src="https://img.shields.io/npm/v/%40your-scope/pc-fingerprint?color=brightgreen&style=flat-square" alt="NPM Version"/></a>
  <a href="https://github.com/your-org/pc-fingerprint/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/your-org/pc-fingerprint/ci.yml?style=flat-square" alt="CI"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"/></a>
</p>

---

## ✨ Features

- 🔑 **Cryptographic Signatures** — fingerprints are signed with your private key, verified with your public key.
- 🖥 **Hardware Snapshot** — CPU, board, BIOS, disk serial, MACs, RAM size, OS info.
- 📑 **Warranty Metadata** — buyer name, purchase date, warranty period + expiry.
- 🧩 **Parts List Support** — include `parts.json` with component serials.
- 🗂 **Persistent Storage** — writes to system paths (`%PROGRAMDATA%`, `/Library/Application Support`, `/var/lib`).
- ⚡ **Simple CLI** — `create`, `show`, `verify` with JSON output option.
- 🌍 **Cross Platform** — Windows, macOS, Linux.

---

## 🚀 Quick Start

### 1) Install (global CLI)

```bash
npm i -g @your-scope/pc-fingerprint
pc-fingerprint --help
```

> If you use **asdf**/**nvm**, ensure your global npm bin is on PATH (see Troubleshooting).

### 2) Keys

```bash
# Private key (keep safe, OFFLINE)
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:4096

# Public key (distribute with the app / use for verification)
openssl rsa -pubout -in private.pem -out public.pem
```

### 3) Create a fingerprint (on the client PC)

```bash
pc-fingerprint create   --buyer "Jane Doe"   --purchase 2025-09-18   --warrantyDays 90   --partsFile ./parts.example.json   --privKey /secure/offline/private.pem
```

### 4) Show / Verify

```bash
pc-fingerprint show
pc-fingerprint verify --pubKey /path/to/public.pem
```

Use `--json` to get machine‑readable output.

---

## 🧰 CLI Usage (help)

```text
Usage:
  pc-fingerprint <command> [options]

Commands:
  create   Create and sign a fingerprint
  show     Show fingerprint file contents (no verify)
  verify   Verify signature and compare current hardware

Global Options:
  --help      Show help
  --version   Show version
  --json      Print machine-readable JSON output (show/verify)

create options:
  --buyer <string>           Buyer full name (required)
  --purchase <YYYY-MM-DD>    Purchase date (required)
  --warrantyDays <number>    Warranty length in days (default: 90)
  --partsFile <path>         Optional JSON file with parts list/serials
  --privKey <path>           Path to RSA private key PEM (required)
  --out <path>               Output path (default: system path)

show options:
  --path <path>              Path to fingerprint (default: system path)
  --json                     Print JSON-only

verify options:
  --path <path>              Path to fingerprint (default: system path)
  --pubKey <path>            Public key PEM (default: assets/public.pem or $PC_FP_PUBLIC_KEY)
  --json                     Print JSON summary
```

---

## 📂 Paths

Fingerprint default location (created on first `create`):

| OS      | Path                                                           |
|---------|----------------------------------------------------------------|
| Windows | `C:\ProgramData\pcfingerprint\fingerprint.json`             |
| macOS   | `/Library/Application Support/pcfingerprint/fingerprint.json`  |
| Linux   | `/var/lib/pcfingerprint/fingerprint.json`                      |

Public key default (when `--pubKey` not provided):

```
<package_root>/assets/public.pem
or override via env: PC_FP_PUBLIC_KEY=/path/to/public.pem
```

---

## 🏷️ Publishing to npm

### 0) Prep `package.json`

```json
{
  "name": "@your-scope/pc-fingerprint",
  "version": "1.0.0",
  "description": "Generate and verify signed hardware fingerprints for custom PC builds.",
  "license": "MIT",
  "bin": { "pc-fingerprint": "src/index.js" },
  "files": ["src", "assets", "README.md", "LICENSE", "parts.example.json"],
  "type": "commonjs",
  "engines": { "node": ">=18" },
  "dependencies": {
    "fs-extra": "^11.2.0",
    "node-machine-id": "^1.1.12",
    "systeminformation": "^5.25.11",
    "yargs": "^17.7.2"
  }
}
```

Ensure the CLI has a shebang and is executable:
```bash
sed -n '1p' src/index.js   # should show: #!/usr/bin/env node
chmod +x src/index.js
```

### 1) Dry-run locally
```bash
npm pack                      # creates ./your-scope-pc-fingerprint-1.0.0.tgz
npm i -g ./your-scope-pc-fingerprint-1.0.0.tgz
pc-fingerprint --help
```

### 2) Log in & publish
```bash
npm login
npm publish --access public
```

### 3) Version bumps
```bash
npm version patch    # or minor | major
git push --follow-tags
npm publish
```

> If you use a scoped name (e.g. `@your-scope/...`), you must publish with `--access public`.

---

## 🧩 Using as a Library (optional)

```js
const { verifyFingerprint } = require('@your-scope/pc-fingerprint'); // if you export helpers later
```

> This CLI is primarily designed for command‑line use, but the structure allows you to export internal helpers if you choose.

---

## 🔒 Security Notes

- Fingerprints are **tamper‑evident**, not tamper‑proof. Admins can always delete files.
- Keep your **private key offline**; never publish it or commit it to the repo.
- Prefer **TLC SSD** for creators (endurance). If you need stronger integrity, consider server‑side copies or TPM‑based sealing.

---

## ❗️ Troubleshooting

**Command not found after install**
- You’re likely missing the global npm bin on your `PATH`.
- On npm v10, find prefix then add `/bin`:
  ```bash
  npm prefix -g
  # e.g. /Users/you/.asdf/installs/nodejs/23.8.0
  export PATH="$(npm prefix -g)/bin:$PATH"
  ```
- For **asdf** users:
  ```bash
  asdf reshim nodejs
  ```
- Refresh Zsh command cache:
  ```bash
  hash -r
  ```

**Public key not found**
- Pass `--pubKey /path/to/public.pem` or set `PC_FP_PUBLIC_KEY=/path/to/public.pem`.

---

## 🤝 Contributing

1. Open an issue describing your idea or bug.
2. Fork the repo and create a feature branch.
3. Run tests / lint, open a PR with a clear description.

---

## 📜 License

PC Fingerprint CLI is [MIT licensed](./LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/your-handle">YourName</a>
</p>
