<p align="center">
  <img src="https://raw.githubusercontent.com/your-org/pc-fingerprint/main/logo.png" width="150" alt="PC Fingerprint Logo"/>
</p>

<h1 align="center">PC Fingerprint CLI</h1>

<p align="center">
  🔒 Generate and verify hardware fingerprints for custom PC builds with signed warranty info.
  <br/>
  <br/>
  <a href="https://www.npmjs.com/package/pc-fingerprint"><img src="https://img.shields.io/npm/v/pc-fingerprint?color=brightgreen&style=flat-square" alt="NPM Version"/></a>
  <a href="https://github.com/your-org/pc-fingerprint/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/your-org/pc-fingerprint/ci.yml?style=flat-square" alt="CI"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"/></a>
</p>

---

## ✨ Features

- 🔑 **Cryptographic Signatures** — fingerprints are signed with your private key, tamper-evident with public verification.  
- 🖥 **Hardware Snapshot** — captures CPU, motherboard, BIOS, disk, network MACs, RAM size, OS info.  
- 📑 **Warranty Metadata** — store buyer name, purchase date, warranty length, expiration.  
- 🧩 **Parts List Support** — include detailed `parts.json` with component serials.  
- 🗂 **Persistent Storage** — fingerprints are written to system-level paths (e.g. `%PROGRAMDATA%` or `/var/lib`).  
- ⚡ **Simple CLI** — one command to create, one to verify, one to show.  
- 🌍 **Cross Platform** — works on Windows, macOS, and Linux.  

---

## 🚀 Quick Start

### 1. Install

```bash
git clone https://github.com/your-org/pc-fingerprint.git
cd pc-fingerprint
npm install
```

### 2. Generate RSA Keypair

```bash
# Private key (keep safe, offline!)
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:4096

# Public key (distribute with app)
openssl rsa -pubout -in private.pem -out public.pem
```

### 3. Create a Fingerprint

```bash
node pc-fingerprint.js create   --buyer "Jane Doe"   --purchase 2025-09-18   --warrantyDays 90   --partsFile ./parts.example.json   --privKey ./private.pem
```

This writes a signed `fingerprint.json` into a system directory (e.g., `C:\ProgramData\pcfingerprint\` on Windows).

### 4. Show Fingerprint

```bash
node pc-fingerprint.js show
```

### 5. Verify Fingerprint

```bash
node pc-fingerprint.js verify
```

The tool will:
- Verify the cryptographic signature using `public.pem`
- Compare saved hardware to current hardware
- Report mismatches (e.g. swapped parts)
- Display buyer and warranty info

---

## 📂 Example Parts File

A simple JSON file to track component serials:

```json
{
  "parts": [
    { "item": "GPU", "model": "XFX RX 9060 XT", "serial": "GPU123456" },
    { "item": "SSD", "model": "WD SN770 1TB", "serial": "SSD987654" }
  ]
}
```

See [`parts.example.json`](./parts.example.json) for reference.

---

## 🛠 Architecture

- **Node.js CLI** — written with `yargs`, `systeminformation`, and `node-machine-id`.  
- **Fingerprint File** — JSON envelope:
  ```json
  {
    "signer": "YourCompany",
    "payload": { ...hardware + warranty... },
    "signature": "base64-signature"
  }
  ```
- **Verification** — payload is canonicalized JSON, signed with SHA256+RSA. Public key included with app.  

---

## 🔒 Security Notes

- The fingerprint file is **tamper-evident**, not tamper-proof. Admins can still delete it.  
- Always keep your **private key offline**. Only the public key is bundled with the app.  
- For stronger security, consider server-side storage of fingerprints or TPM integration.  

---

## 📦 Installation Paths

| OS      | Fingerprint File Location                     |
|---------|-----------------------------------------------|
| Windows | `%PROGRAMDATA%\pcfingerprint\fingerprint.json` |
| macOS   | `/Library/Application Support/pcfingerprint/`  |
| Linux   | `/var/lib/pcfingerprint/fingerprint.json`      |

The CLI can be deleted after setup; the fingerprint file remains for later verification.

---

## 🧪 Development

Run lint and tests:

```bash
npm run lint
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Open an issue describing your idea or bug.
2. Fork the repo and create a feature branch.
3. Open a pull request with a clear description.

---

## 📜 License

PC Fingerprint CLI is [MIT licensed](./LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/your-handle">YourName</a>
</p>
