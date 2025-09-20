#!/usr/bin/env node
/**
 * pc-fingerprinter (CLI)
 *
 * Commands:
 *   create  -> Create and sign a fingerprint
 *   show    -> Display the fingerprint envelope (no signature check)
 *   verify  -> Verify signature and compare current hardware
 *
 * Examples:
 *   # Create (writes to system path by default)
 *   pc-fingerprinter create \
 *     --buyer "John Doe" \
 *     --purchase 2025-10-10 \
 *     --warrantyDays 90 \
 *     --partsFile ./parts.example.json \
 *     --privKey ~/keys/private.pem \
 *     --out /custom/path/fingerprint.json
 *
 *   # Show (pretty prints JSON)
 *   pc-fingerprint show --path /custom/path/fingerprint.json
 *
 *   # Verify (with a specific public key; prints mismatches)
 *   pc-fingerprint verify --pubKey ~/keys/public.pem --path /custom/path/fingerprint.json
 *
 * Exit codes:
 *   0 -> success
 *   1 -> fingerprint not found or invalid arguments
 *   2 -> signature invalid / verification failure
 */
const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const crypto = require("crypto");
const si = require("systeminformation");
const { machineIdSync } = require("node-machine-id");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

// ---------- CONFIG ----------
// Directory name used under system-level locations (no spaces/symbols)
const APP_DIR = "pcfingerprinter";
const FINGERPRINT_FILENAME = "fingerprint.json";

function defaultFingerprintPath() {
  const platform = os.platform();
  if (platform === "win32") {
    return path.join(
      process.env["PROGRAMDATA"] || "C:\\ProgramData",
      APP_DIR,
      FINGERPRINT_FILENAME
    );
  } else if (platform === "darwin") {
    return path.join(
      "/Library",
      "Application Support",
      APP_DIR,
      FINGERPRINT_FILENAME
    );
  } else {
    // linux/unix
    return path.join("/var", "lib", APP_DIR, FINGERPRINT_FILENAME);
  }
}

// Default public key location within the package (../assets/public.pem)
function defaultPublicKeyPath() {
  return path.resolve(__dirname, "..", "assets", "public.pem");
}

// ---------- Helpers ----------
async function collectHardwareSnapshot() {
  const id = machineIdSync({ original: true });
  const cpu = await si.cpu();
  const baseboard = await si.baseboard();
  const bios = await si.bios();
  const disk = await si.diskLayout();
  const net = await si.networkInterfaces();
  const mem = await si.mem();
  const osInfo = await si.osInfo();

  const primaryDisk = disk && disk.length ? disk[0] : null;
  const macs = net
    ? net
        .filter((n) => !n.internal)
        .map((n) => ({ iface: n.iface, mac: n.mac, ip4: n.ip4, ip6: n.ip6 }))
    : [];

  return {
    machineId: id,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed,
      physicalCores: cpu.physicalCores,
      cores: cpu.cores,
    },
    bios: {
      vendor: bios.vendor,
      version: bios.version,
      releaseDate: bios.releaseDate,
      serial: bios.serial,
    },
    baseboard: {
      manufacturer: baseboard.manufacturer,
      model: baseboard.model,
      serial: baseboard.serial,
    },
    disk: primaryDisk
      ? {
          vendor: primaryDisk.vendor,
          name: primaryDisk.name,
          size: primaryDisk.size,
          serial: primaryDisk.serial,
        }
      : null,
    net: macs,
    memoryGB: Math.round(mem.total / 1024 ** 3),
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
    },
    timestamp: new Date().toISOString(),
  };
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const out = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      out[k] = canonicalize(obj[k]);
    });
  return out;
}

function signPayload(privateKeyPem, payloadBuffer) {
  const sign = crypto.createSign("SHA256");
  sign.update(payloadBuffer);
  sign.end();
  return sign.sign(privateKeyPem).toString("base64");
}

function verifySignature(publicKeyPem, payloadBuffer, signatureB64) {
  const verify = crypto.createVerify("SHA256");
  verify.update(payloadBuffer);
  verify.end();
  return verify.verify(publicKeyPem, Buffer.from(signatureB64, "base64"));
}

function readPublicKey(customPath) {
  const guess =
    customPath || process.env.PC_FP_PUBLIC_KEY || defaultPublicKeyPath();
  if (!fs.existsSync(guess)) {
    throw new Error("Public key not found at " + guess);
  }
  return fs.readFileSync(guess, "utf8");
}

// ---------- CLI ----------
const argv = yargs(hideBin(process.argv))
  .scriptName("pc-fingerprinter")
  .usage(
    `
Usage:
  $0 <command> [options]

Commands:
  create   Create and sign a fingerprint
  show     Show fingerprint file contents (no verify)
  verify   Verify signature and compare current hardware

Global Options:
  --help               Show help
  --version            Show version
  --json               Print machine-readable JSON output (show/verify)
`
  )
  .command(
    "create",
    "Create and sign a fingerprint",
    (y) =>
      y
        .option("buyer", {
          type: "string",
          demandOption: true,
          describe: "Buyer full name",
        })
        .option("purchase", {
          type: "string",
          demandOption: true,
          describe: "Purchase date (YYYY-MM-DD)",
        })
        .option("warrantyDays", {
          type: "number",
          default: 90,
          describe: "Warranty length in days (default: 90)",
        })
        .option("partsFile", {
          type: "string",
          describe: "Optional JSON file with parts list/serials",
        })
        .option("privKey", {
          type: "string",
          demandOption: true,
          describe: "Path to RSA private key PEM used to sign",
        })
        .option("out", {
          type: "string",
          describe: "Fingerprint output path (default: system path)",
        })
        .example(
          '$0 create --buyer "Jane Doe" --purchase 2025-10-10 --warrantyDays 90 --partsFile parts.json --privKey ./private.pem',
          "Create and sign a fingerprint file"
        ),
    mainCreate
  )
  .command(
    "show",
    "Show fingerprint file contents (no verify)",
    (y) =>
      y
        .option("path", {
          type: "string",
          describe: "Path to fingerprint file (default: system path)",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON only",
        })
        .example("$0 show", "Show fingerprint from default system path")
        .example(
          "$0 show --path /custom/fingerprint.json",
          "Show fingerprint from custom path"
        ),
    mainShow
  )
  .command(
    "verify",
    "Verify signature and compare current hardware",
    (y) =>
      y
        .option("path", {
          type: "string",
          describe: "Path to fingerprint file (default: system path)",
        })
        .option("pubKey", {
          type: "string",
          describe:
            "Path to public key PEM (default: package assets/public.pem or $PC_FP_PUBLIC_KEY)",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Print JSON summary instead of human text",
        })
        .example(
          "$0 verify --pubKey ~/keys/public.pem",
          "Verify using a specific public key and default fingerprint path"
        )
        .example(
          "$0 verify --path /custom/fp.json --pubKey ./assets/public.pem",
          "Verify with custom paths"
        ),
    mainVerify
  )
  .strict()
  .help()
  .epilogue(
    "For more info, visit: https://github.com/your-org/pc-fingerprint"
  ).argv;

// ----- command implementations -----
async function mainCreate(args) {
  try {
    const outPath = args.out || defaultFingerprintPath();
    await fs.ensureDir(path.dirname(outPath));
    const hw = await collectHardwareSnapshot();

    let parts = null;
    if (args.partsFile) {
      try {
        parts = await fs.readJSON(args.partsFile);
      } catch (e) {
        console.warn("Could not read partsFile:", e.message);
      }
    }

    const purchaseDate = args.purchase;
    const warrantyDays = parseInt(args.warrantyDays || 90, 10);
    const expDate = new Date(purchaseDate);
    if (isNaN(expDate.getTime())) {
      console.error("Invalid --purchase date. Use YYYY-MM-DD.");
      process.exit(1);
    }
    expDate.setDate(expDate.getDate() + warrantyDays);

    const payload = canonicalize({
      meta: {
        app: "pc-fingerprint",
        createdAt: new Date().toISOString(),
        installer: os.userInfo().username,
      },
      buyer: {
        name: args.buyer,
        purchaseDate,
        warrantyDays,
        warrantyExpires: expDate.toISOString(),
      },
      parts: parts || null,
      hardwareSnapshot: hw,
    });

    const payloadJson = JSON.stringify(payload);
    if (!fs.existsSync(args.privKey)) {
      console.error("Private key not found at", args.privKey);
      process.exit(2);
    }
    const priv = fs.readFileSync(args.privKey, "utf8");
    const signature = signPayload(priv, Buffer.from(payloadJson, "utf8"));

    const envelope = { signer: "pc-fingerprint", payload, signature };
    await fs.writeFile(outPath, JSON.stringify(envelope, null, 2), {
      mode: 0o640,
    });
    console.log("Fingerprint written to", outPath);
    console.log(
      "IMPORTANT: Keep the private key offline. Store only the public key with the app."
    );
  } catch (err) {
    console.error("Create failed:", err.message);
    process.exit(1);
  }
}

async function mainShow(args) {
  try {
    const p = args.path || defaultFingerprintPath();
    if (!fs.existsSync(p)) {
      console.error("Fingerprint not found at", p);
      process.exit(1);
    }
    const envelope = await fs.readJSON(p);
    if (args.json) {
      console.log(JSON.stringify(envelope));
    } else {
      console.log("----- Fingerprint (envelope) -----\n");
      console.log(JSON.stringify(envelope, null, 2));
      console.log("\nPath:", p);
    }
  } catch (err) {
    console.error("Show failed:", err.message);
    process.exit(1);
  }
}

async function mainVerify(args) {
  try {
    const p = args.path || defaultFingerprintPath();
    if (!fs.existsSync(p)) {
      console.error("Fingerprint not found at", p);
      process.exit(1);
    }
    const envelope = await fs.readJSON(p);
    const publicKeyPem = readPublicKey(args.pubKey);
    const payloadJson = JSON.stringify(envelope.payload);
    const ok = verifySignature(
      publicKeyPem,
      Buffer.from(payloadJson, "utf8"),
      envelope.signature
    );

    const currentHw = await collectHardwareSnapshot();
    const savedHw = envelope.payload.hardwareSnapshot;
    const diffs = compareHardware(savedHw, currentHw);

    if (args.json) {
      console.log(
        JSON.stringify({
          signatureValid: ok,
          mismatches: diffs,
          mismatchesCount: diffs.length,
          buyer: envelope.payload.buyer || null,
          path: p,
        })
      );
    } else {
      console.log("Signature valid:", ok);
      console.log("\nHardware comparison summary:");
      console.log("Total mismatches:", diffs.length);
      if (diffs.length) diffs.forEach((d) => console.log("-", d));
      else console.log("No mismatches detected.");

      const buyer = envelope.payload.buyer || {};
      console.log(`\nBuyer: ${buyer.name || "N/A"}`);
      console.log(`Purchase date: ${buyer.purchaseDate || "N/A"}`);
      console.log(`Warranty expires: ${buyer.warrantyExpires || "N/A"}`);
      console.log("\nPath:", p);
    }

    if (!ok) process.exit(2);
  } catch (err) {
    console.error("Verify failed:", err.message);
    process.exit(1);
  }
}

// Simple comparator
function compareHardware(saved, current) {
  const mismatches = [];
  if (!saved || !current) return ["Missing snapshot or current data"];

  function check(label, a, b) {
    if ((a === undefined || a === null) && (b === undefined || b === null))
      return;
    if (typeof a === "object" || typeof b === "object") {
      if (JSON.stringify(a) !== JSON.stringify(b))
        mismatches.push(`${label} changed`);
    } else if (String(a) !== String(b)) {
      mismatches.push(`${label}: saved=${a} current=${b}`);
    }
  }

  check("machineId", saved.machineId, current.machineId);
  check(
    "cpu.brand",
    saved.cpu && saved.cpu.brand,
    current.cpu && current.cpu.brand
  );
  check(
    "cpu.physicalCores",
    saved.cpu && saved.cpu.physicalCores,
    current.cpu && current.cpu.physicalCores
  );
  check(
    "bios.serial",
    saved.bios && saved.bios.serial,
    current.bios && current.bios.serial
  );
  check(
    "baseboard.serial",
    saved.baseboard && saved.baseboard.serial,
    current.baseboard && current.baseboard.serial
  );
  check(
    "disk.serial",
    saved.disk && saved.disk.serial,
    current.disk && current.disk && current.disk.serial
  );

  const sMacs = (saved.net || [])
    .map((n) => n.mac)
    .sort()
    .join(",");
  const cMacs = (current.net || [])
    .map((n) => n.mac)
    .sort()
    .join(",");
  if (sMacs !== cMacs) mismatches.push("Network interfaces (MACs) changed");

  check("memoryGB", saved.memoryGB, current.memoryGB);
  return mismatches;
}
