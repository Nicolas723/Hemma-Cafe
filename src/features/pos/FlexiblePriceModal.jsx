import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Modal, MoneyInput } from "../../components/ui";
import { formatCurrency } from "../../lib/format";

const QUICK = [1000, 2000, 3000, 5000, 10000];

/** Precio para productos de precio libre ("Otro"). Enter confirma. */
export default function FlexiblePriceModal({ product, onClose, onConfirm }) {
    const [value, setValue] = useState("");
    const confirm = (v = value) => {
        const n = parseInt(v, 10);
        if (n > 0) onConfirm(n);
    };

    return (
        <Modal
            title={`Precio de "${product.name}"`}
            icon={Pencil}
            onClose={onClose}
            size="sm"
            footer={
                <>
                    <button className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary btn--lg" onClick={() => confirm()} disabled={!(parseInt(value, 10) > 0)}>
                        <Plus size={18} /> Agregar
                    </button>
                </>
            }
        >
            <MoneyInput value={value} onChange={setValue} autoFocus className="money--xl" onKeyDown={(e) => e.key === "Enter" && confirm()} />
            <div className="quick-amounts">
                {QUICK.map((q) => (
                    <button key={q} className="btn btn--soft" onClick={() => confirm(String(q))}>
                        {formatCurrency(q)}
                    </button>
                ))}
            </div>
        </Modal>
    );
}
