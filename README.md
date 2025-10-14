<p align="center">
  <img width="150" alt="image" src="https://github.com/user-attachments/assets/ef8046a0-caea-4bb3-acfd-ca21592498e5" />
</p>

<h1 align="center">@siteit_solutions/PC Fingerprinter CLI</h1>

<p align="center">
  🔒 Generate and verify hardware fingerprints for custom PC builds with signed warranty info.
  <br/>
  <br/>
  <a href="https://www.npmjs.com/package/@siteit_solutions/pc-fingerprinter"><img src="https://img.shields.io/npm/v/@siteit_solutions/pc-fingerprinter?color=brightgreen&style=flat-square" alt="NPM Version"/></a>
  <a href="https://github.com/SiteitSolutions/pc-fingerprinter/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SiteItSolutions/pc-fingerprinter/ci.yml?style=flat-square" alt="CI"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"/></a>
</p>

---

## ✨ Features

- 🔑 **Cryptographic Signatures** — fingerprints are signed with your private key, verified using your public key.
- 🖥 **Hardware Snapshot** — Captures stable machine info: CPU, motherboard, BIOS, disk serials, MAC addresses, RAM size, OS.
- 📑 **Warranty Metadata** — Includes buyer name, purchase date, warranty period & expiry.
- 🧩 **Parts List Support** — Include `parts.json` with component serials, if available.
- 🗂 **Persistent Storage** — Defaults to system paths (`%PROGRAMDATA%`, `/Library/Application Support`, `/var/lib`).
- ⚡ **Simple CLI** — Commands: `create`, `show`, `verify`.
- 🌍 **Cross Platform** — Works on Windows, macOS, Linux.

---

## 🚀 Quick Start

### 1) Install globally

```bash
npm i -g @siteit_solutions/pc-fingerprinter
pc-fingerprinter --help
```

### 2) Generate keys

```bash
# Private key (keep safe, OFFLINE)
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:4096

# Public key (for verification)
openssl rsa -pubout -in private.pem -out public.pem
```

### 3) Create a fingerprint (on client system)

```bash
pc-fingerprinter create   --buyer "Jane Doe"   --purchase 2025-09-18   --warrantyDays 90   --partsFile ./parts.example.json   --privKey /secure/offline/private.pem
```

### 4) Show / Verify

```bash
pc-fingerprinter show
pc-fingerprinter verify --pubKey /path/to/public.pem
```

Use `--json` with `show` or `verify` for machine-readable output.

---

## 🧰 CLI Usage (help)

```text
Usage:
  pc-fingerprinter <command> [options]

Commands:
  create   Create and sign a fingerprint
  show     Show fingerprint file contents (no signature verification)
  verify   Verify signature and compare current hardware

Global Options:
  --help      Show help
  --version   Show version
  --json      Print machine‑readable JSON output (show/verify)

create options:
  --buyer <string>           Buyer full name (required)
  --purchase <YYYY-MM-DD>    Purchase date (required)
  --warrantyDays <number>    Warranty length in days (default: 90)
  --partsFile <path>         Optional JSON file with parts list/serials
  --privKey <path>           Path to RSA private key PEM (required)
  --out <path>               Output path (default: system fingerprint path)

show options:
  --path <path>              Path to fingerprint file (default: system fingerprint path)
  --json                     Print JSON‑only

verify options:
  --path <path>              Path to fingerprint file (default: system fingerprint path)
  --pubKey <path>            Public key PEM to use (default: bundled or via $PC_FP_PUBLIC_KEY)
  --json                     Print JSON summary instead of human output
```

---

## 📂 Default Paths

| OS      | Fingerprint File Location                                     |
| ------- | ------------------------------------------------------------- |
| Windows | `C:\ProgramData\pcfingerprint\fingerprint.json`               |
| macOS   | `/Library/Application Support/pcfingerprint/fingerprint.json` |
| Linux   | `/var/lib/pcfingerprint/fingerprint.json`                     |

**Default public key location** (if `--pubKey` not provided):

```
<package_root>/assets/public.pem
or override via environment variable: PC_FP_PUBLIC_KEY=/path/to/public.pem
```

---

## 🔒 Security & Best Practices

- The fingerprint file is **tamper-evident**, not undeletable. Users with admin/root can still remove it.
- Always keep your **private key offline**. Distribute only your public key.
- Make sure parts.json (if used) has accurate serials.
- Use `--json` mode for scripts or remote verification.

---

## 🤝 Contributing

1. Open an issue describing an idea or bug.
2. Fork the repo & create a feature branch.
3. Make changes, run tests/lint, open a pull request.

---

## 📜 License

@siteit_solutions/pc-fingerprinter is [MIT licensed](./LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/SiteItSolutions">SiteIT Solutions</a>
</p>
