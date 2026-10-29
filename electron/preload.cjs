const { contextBridge, ipcRenderer } = require("electron");

/** Suscribe a un canal y devuelve una función para cancelar la suscripción. */
function listen(channel, handler) {
    const wrapped = (_event, ...args) => handler(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld("electron", {
    isDesktop: true,
    getVersion: () => ipcRenderer.invoke("get-version"),
    print: (options) => ipcRenderer.send("print", options || {}),
    saveBackup: (files) => ipcRenderer.invoke("save-backup", files),
    openBackups: () => ipcRenderer.send("open-backups"),
    checkForUpdates: () => ipcRenderer.send("check-for-updates"),
    startDownload: () => ipcRenderer.send("start-download"),
    quitAndInstall: () => ipcRenderer.send("quit-and-install"),
    onUpdateStatus: (cb) => listen("update-status", cb),
    onUpdateProgress: (cb) => listen("update-progress", cb),
});
