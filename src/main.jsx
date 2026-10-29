import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UiProvider } from "./context/UiProvider";
import ScrollTopButton from "./components/ScrollTopButton";
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";
import "./styles/print.css";

// Service worker solo en la versión web; en Electron la app ya viene empaquetada.
if (!window.electron && "serviceWorker" in navigator && import.meta.env.PROD) {
    import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <UiProvider>
            <App />
            <ScrollTopButton />
        </UiProvider>
    </React.StrictMode>
);
