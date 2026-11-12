import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { useAuth } from "../../context/AuthProvider";
import { useUi } from "../../context/UiProvider";
import { PasswordField } from "../auth/AuthScreens";
import { passwordProblem } from "../../lib/passwords";

/** Cambiar la contraseña propia (funciona sin internet). */
export function MyPasswordCard() {
    const { changeOwnPassword, sessionUser } = useAuth();
    const { showToast } = useUi();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");

    if (!sessionUser || sessionUser.isGuest) return null;

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        const problem = passwordProblem(next, confirm);
        if (problem) return setError(problem);
        const res = await changeOwnPassword(current, next);
        if (res.error) return setError(res.error);
        setCurrent("");
        setNext("");
        setConfirm("");
        showToast("Tu contraseña fue actualizada", "success");
    };

    return (
        <form className="card stack" onSubmit={submit}>
            <h2 className="card-title">
                <KeyRound size={20} /> Mi contraseña
            </h2>
            <PasswordField value={current} onChange={setCurrent} placeholder="Contraseña actual" />
            <PasswordField value={next} onChange={setNext} placeholder="Nueva contraseña" autoComplete="new-password" />
            <PasswordField value={confirm} onChange={setConfirm} placeholder="Repite la nueva" autoComplete="new-password" />
            {error && <div className="login__error">{error}</div>}
            <button className="btn btn--primary" type="submit" disabled={!current || !next}>
                <Save size={18} /> Cambiar mi contraseña
            </button>
        </form>
    );
}
