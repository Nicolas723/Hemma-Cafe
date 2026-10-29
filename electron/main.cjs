// Proceso principal de Electron 22 (última versión compatible con Windows 7 de 32 bits).
const { app, BrowserWindow, ipcMain, session, Menu, shell } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const isDev = process.argv.includes("--dev");
let mainWindow = null;

// Una sola instancia: si se abre otra vez, se enfoca la ventana existente
// (evita dos cajas escribiendo en la misma base local).
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });
}

function send(channel, ...args) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}

function createWindow() {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
        callback(permission === "notifications" || permission === "persistent-storage");
    });

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false,
        backgroundColor: "#f7fbea",
        title: "Hemma POS",
        icon: path.join(__dirname, isDev ? "../public/icono.ico" : "../dist/icono.ico"),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
        },
    });

    if (!isDev) Menu.setApplicationMenu(null);
    mainWindow.once("ready-to-show", () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    // Los enlaces externos se abren en el navegador, no dentro de la caja.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    // Revisa actualizaciones al iniciar (sin descargar). Si no hay internet, falla en silencio.
    if (!isDev) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 15000);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-version", () => app.getVersion());

// ── Copias de seguridad: Documentos\Hemma POS\Copias de seguridad ─────────
const fs = require("fs");
const backupDir = () => path.join(app.getPath("documents"), "Hemma POS", "Copias de seguridad");
const KEEP_BACKUPS = 10; // copias completas (cada una = .json + .xlsx)

ipcMain.handle("save-backup", async (_event, files = []) => {
    const dir = backupDir();
    await fs.promises.mkdir(dir, { recursive: true });
    for (const f of files) {
        const name = path.basename(String(f.name || "")); // nunca rutas: solo el nombre
        if (!/^Hemma-copia_[\w-]+\.(json|xlsx)$/.test(name)) continue;
        await fs.promises.writeFile(path.join(dir, name), Buffer.from(f.data));
    }
    // Conserva solo las más recientes.
    const all = (await fs.promises.readdir(dir)).filter((n) => n.startsWith("Hemma-copia_")).sort().reverse();
    const stamps = [...new Set(all.map((n) => n.replace(/\.(json|xlsx)$/, "")))];
    for (const old of stamps.slice(KEEP_BACKUPS)) {
        for (const ext of [".json", ".xlsx"]) await fs.promises.rm(path.join(dir, old + ext), { force: true });
    }
    return dir;
});
ipcMain.on("open-backups", async () => {
    await fs.promises.mkdir(backupDir(), { recursive: true });
    shell.openPath(backupDir());
});

// Impresión del recibo. silent=true imprime directo en la impresora predeterminada.
ipcMain.on("print", (event, options = {}) => {
    event.sender.print({ silent: Boolean(options.silent), printBackground: false, margins: { marginType: "none" } }, (ok, reason) => {
        if (!ok && reason !== "cancelled") console.error("Error al imprimir:", reason);
    });
});

// ── Actualizaciones (GitHub Releases) ─────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on("checking-for-update", () => send("update-status", "checking"));
autoUpdater.on("update-available", (info) => send("update-status", "available", info.version));
autoUpdater.on("update-not-available", () => send("update-status", "not-available"));
autoUpdater.on("error", (err) => send("update-status", "error", err?.message));
autoUpdater.on("download-progress", (p) => send("update-progress", p.percent));
autoUpdater.on("update-downloaded", () => send("update-status", "downloaded"));

ipcMain.on("check-for-updates", () => autoUpdater.checkForUpdates().catch((err) => send("update-status", "error", err?.message)));
ipcMain.on("start-download", () => autoUpdater.downloadUpdate().catch((err) => send("update-status", "error", err?.message)));
ipcMain.on("quit-and-install", () => autoUpdater.quitAndInstall());
