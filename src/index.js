#!/usr/bin/env node
/**
 * pc-fingerprinter
 *
 * Usage:
 *  Create fingerprint:
 *    node pc-fingerprinter create --buyer "John Doe" --purchase 2025-09-01 --warrantyDays 90 --partsFile parts.json --privKey ./private.pem
 *
 *  Read / verify:
 *    node pc-fingerprinter show
 *
 *  Verify and compare to current hardware:
 *    node pc-fingerprinter verify
 *
 *  Remove app (helper) but leave fingerprint: just delete app folder; fingerprint file remains
 *
 * Notes:
 *  - Creation requires path to the RSA private key (PEM) for signing.
 *  - Verification uses the public key embedded in the app (public.pem).
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
// App name - change to your brand
const APP_NAME = "PC-Fingerprinter";

// OS-specific fingerprint paths (change if you'd like)
const FINGERPRINT_FILENAME = "fingerprint.json"; // signed envelope: {payload: {...}, signature: "...", signer: "yourcompany"}
function defaultFingerprintPath() {
  const platform = os.platform();
  if (platform === "win32") {
    return path.join(
      process.env["PROGRAMDATA"] || "C:\\ProgramData",
      APP_NAME,
      FINGERPRINT_FILENAME
    );
  } else if (platform === "darwin") {
    return path.join(
      "/Library",
      "Application Support",
      APP_NAME,
      FINGERPRINT_FILENAME
    );
  } else {
    // linux/unix
    return path.join("/var", "lib", APP_NAME, FINGERPRINT_FILENAME);
  }
}

// Default public key location inside your app installation (used to verify)
const PUBLIC_KEY_PATH = path.join(__dirname, "public.pem");

// ---------- Helpers ----------
async function collectHardwareSnapshot() {
  // best-effort collection: many fields may be undefined depending on platform/privileges
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

  // choose a subset of attributes that are useful and relatively stable
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
  // deterministic JSON: sort keys recursively
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

function readPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_PATH))
    throw new Error("Missing public key at " + PUBLIC_KEY_PATH);
  return fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
}

// ---------- CLI ----------

const argv = yargs(hideBin(process.argv))
  .command(
    "create",
    "Create and sign a fingerprint",
    (y) =>
      y
        .option("buyer", { type: "string", demandOption: true })
        .option("purchase", {
          type: "string",
          demandOption: true,
          description: "purchase date YYYY-MM-DD",
        })
        .option("warrantyDays", { type: "number", default: 90 })
        .option("partsFile", {
          type: "string",
          description: "Optional JSON file with parts list/serials",
        })
        .option("privKey", {
          type: "string",
          demandOption: true,
          description: "Path to RSA private key PEM used to sign",
        })
        .option("out", {
          type: "string",
          description: "Fingerprint output path",
        }),
    mainCreate
  )
  .command(
    "show",
    "Show fingerprint file contents (no verify)",
    (y) => y.option("path", { type: "string" }),
    mainShow
  )
  .command(
    "verify",
    "Verify signature and compare current hardware",
    (y) => y.option("path", { type: "string" }),
    mainVerify
  )
  .demandCommand(1, "Please provide a command")
  .help().argv;

// ----- command implementations -----
async function mainCreate(args) {
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
  expDate.setDate(expDate.getDate() + warrantyDays);

  const payload = canonicalize({
    meta: {
      app: APP_NAME,
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
  // sign with provided private key
  if (!fs.existsSync(args.privKey)) {
    console.error("Private key not found at", args.privKey);
    process.exit(2);
  }
  const priv = fs.readFileSync(args.privKey, "utf8");
  const signature = signPayload(priv, Buffer.from(payloadJson, "utf8"));

  const envelope = {
    signer: "PC-Fingerprinter", // Replace with your company name
    payload,
    signature,
  };

  // write out JSON
  await fs.writeFile(outPath, JSON.stringify(envelope, null, 2), {
    mode: 0o640,
  });
  console.log("Fingerprint written to", outPath);
  console.log(
    "IMPORTANT: Keep the private key offline. Public key is stored in app for verification."
  );
}

async function mainShow(args) {
  const p = args.path || defaultFingerprintPath();
  if (!fs.existsSync(p)) {
    console.error("Fingerprint not found at", p);
    process.exit(1);
  }
  const envelope = await fs.readJSON(p);
  console.log("----- Fingerprint (envelope) -----\n");
  console.log(JSON.stringify(envelope, null, 2));
}

async function mainVerify(args) {
  const p = args.path || defaultFingerprintPath();
  if (!fs.existsSync(p)) {
    console.error("Fingerprint not found at", p);
    process.exit(1);
  }
  const envelope = await fs.readJSON(p);
  const publicKey = readPublicKey();
  const payloadJson = JSON.stringify(envelope.payload);
  const ok = verifySignature(
    publicKey,
    Buffer.from(payloadJson, "utf8"),
    envelope.signature
  );
  console.log("Signature valid:", ok);

  if (!ok) {
    console.error("Signature invalid — possible tamper or wrong public key.");
    process.exit(2);
  }

  // Compare current hardware to snapshot
  const currentHw = await collectHardwareSnapshot();
  const savedHw = envelope.payload.hardwareSnapshot;

  const diffs = compareHardware(savedHw, currentHw);
  console.log("\nHardware comparison summary:");
  console.log("Total mismatches:", diffs.length);
  if (diffs.length) {
    diffs.forEach((d) => console.log("-", d));
  } else {
    console.log("No mismatches detected.");
  }

  const buyer = envelope.payload.buyer || {};
  console.log(`\nBuyer: ${buyer.name || "N/A"}`);
  console.log(`Purchase date: ${buyer.purchaseDate || "N/A"}`);
  console.log(`Warranty expires: ${buyer.warrantyExpires || "N/A"}`);
}

// Simple comparator: check key fields and return array of human strings describing differences
function compareHardware(saved, current) {
  const mismatches = [];
  if (!saved || !current) return ["Missing snapshot or current data"];

  function check(pathLabel, a, b) {
    if ((a === undefined || a === null) && (b === undefined || b === null))
      return;
    if (typeof a === "object" || typeof b === "object") {
      // quick deep-compare on JSON string
      if (JSON.stringify(a) !== JSON.stringify(b))
        mismatches.push(`${pathLabel} changed`);
    } else {
      if (String(a) !== String(b))
        mismatches.push(`${pathLabel}: saved=${a} current=${b}`);
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
  // MAC addresses comparison
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
