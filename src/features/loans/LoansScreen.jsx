import { useEffect, useMemo, useState } from "react";
import { Wallet, FileSpreadsheet, CheckSquare, Square, Trash2, Minus, Plus, Split, HandMetal, Users, ListChecks, Coins, MessageCircle, Save } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, EmptyState, Field, Modal, MoneyInput, PageHeader, SearchInput, Toggle } from "../../components/ui";
import { isValidPhone, reminderMessage, whatsappLink } from "../../lib/whatsapp";
import { MethodPicker, SplitEditor, newSplitRow, splitRowsToPayments } from "../../components/PaymentMethods";
import { formatCurrency, formatDateLong, formatTime, initials, toDate } from "../../lib/format";
import { exportWorkbook, today } from "../../lib/excel";
import { DEFAULT_PAYMENT_METHODS } from "../../lib/paymentIcons";
import { itemOutstanding, loanOutstanding, pickCost, planFromAmount, planFromPicks, planTotal } from "../../lib/loans";

const PAY_MODES = [
    { value: "items", label: "Por productos", icon: <ListChecks size={15} /> },
    { value: "amount", label: "Por monto", icon: <Coins size={15} /> },
];
const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const loanDate = (loan) => toDate(loan.date || loan.lastUpdated || loan.createdAt);

export default function LoansScreen() {
    const { loans, vendedores, paymentMethods, customers, actions } = useData();
    const [phoneAsk, setPhoneAsk] = useState(null); // cliente al que le falta el teléfono
    const { showToast, showConfirm } = useUi();
    const { can } = useAuth();
    const methods = paymentMethods.length ? paymentMethods : DEFAULT_PAYMENT_METHODS;

    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [picks, setPicks] = useState({}); // { loanId: { itemIndex: qty } }
    const [vendedor, setVendedor] = useState("");
    const [method, setMethod] = useState(methods[0]?.name || "Efectivo");
    const [split, setSplit] = useState(false);
    const [splitRows, setSplitRows] = useState(() => [newSplitRow(methods[0]?.name)]);
    const [payMode, setPayMode] = useState("items");
    const [amount, setAmount] = useState("");

    const debtors = useMemo(() => {
        const groups = {};
        for (const loan of loans) {
            const id = loan.customerId || "sin-cliente";
            const g = (groups[id] ||= { id, name: loan.customerName || "Sin nombre", total: 0, loans: [], last: new Date(0) });
            const d = loanDate(loan);
            g.total += loanOutstanding(loan);
            g.loans.push({ ...loan, total: loanOutstanding(loan), dateObj: d });
            if (d > g.last) g.last = d;
        }
        const list = Object.values(groups);
        list.forEach((g) => g.loans.sort((a, b) => b.dateObj - a.dateObj));
        return list.sort((a, b) => b.last - a.last);
    }, [loans]);

    const filtered = debtors.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()));
    const selected = debtors.find((d) => d.id === selectedId) || null;
    const totalDebt = debtors.reduce((s, d) => s + d.total, 0);

    // Selecciona el primero automáticamente: un clic menos.
    useEffect(() => {
        if (!selected && filtered[0]) setSelectedId(filtered[0].id);
    }, [selected, filtered]);

    useEffect(() => {
        setPicks({});
        setPayMode("items");
        setAmount("");
        setSplitRows([newSplitRow(methods[0]?.name)]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    // Cómo quedan los créditos con el abono actual (por productos o por monto).
    const plans = useMemo(() => {
        if (!selected) return [];
        if (payMode === "amount") return planFromAmount(selected.loans, Math.min(parseFloat(amount) || 0, selected.total));
        return selected.loans.filter((l) => Object.keys(picks[l.id] || {}).length).map((loan) => planFromPicks(loan, picks[loan.id]));
    }, [selected, picks, payMode, amount]);
    const selectedTotal = planTotal(plans);
    const typedAmount = parseFloat(amount) || 0;

    const setPick = (loanId, idx, qty) => {
        setPayMode("items");
        setPicks((prev) => {
            const forLoan = { ...(prev[loanId] || {}) };
            if (qty > 0) forLoan[idx] = qty;
            else delete forLoan[idx];
            return { ...prev, [loanId]: forLoan };
        });
    };

    const allPicked = selected && selected.loans.every((l) => l.items.every((it, idx) => picks[l.id]?.[idx] === it.cartQuantity));
    const toggleAll = () => {
        if (!selected) return;
        setPayMode("items");
        if (allPicked) return setPicks({});
        const next = {};
        selected.loans.forEach((l) => {
            next[l.id] = Object.fromEntries(l.items.map((it, idx) => [idx, it.cartQuantity]));
        });
        setPicks(next);
    };

    // Recordatorio por WhatsApp con el detalle de la deuda (abre WhatsApp con el mensaje listo).
    const remind = (debtor, phone) => {
        const customer = customers.find((c) => c.id === debtor.id);
        const number = phone || customer?.phone;
        if (!isValidPhone(number)) return setPhoneAsk({ debtor, phone: number || "" });
        const text = reminderMessage(debtor.name, debtor.loans);
        window.open(whatsappLink(number, text), "_blank");
        // Respaldo: el mensaje queda copiado por si hay que pegarlo a mano (Ctrl+V).
        navigator.clipboard
            ?.writeText(text)
            .then(() => showToast("Abriendo WhatsApp. El mensaje también quedó copiado (Ctrl+V)", "success"))
            .catch(() => {});
    };
    const savePhoneAndRemind = (e) => {
        e.preventDefault();
        if (!isValidPhone(phoneAsk.phone)) return showToast("Escribe un celular válido (10 dígitos)", "warning");
        if (customers.some((c) => c.id === phoneAsk.debtor.id)) actions.updateCustomer(phoneAsk.debtor.id, { phone: phoneAsk.phone.trim() });
        const { debtor, phone } = phoneAsk;
        setPhoneAsk(null);
        remind(debtor, phone);
    };

    const pay = () => {
        if (!selected || selectedTotal <= 0) return;
        if (!vendedor) return showToast("Elige quién recibe el abono", "warning");
        const payments = split ? splitRowsToPayments(splitRows, selectedTotal) : [{ method, amount: selectedTotal }];
        const paid = payments.reduce((s, p) => s + p.amount, 0);
        if (split && paid !== selectedTotal) return showToast(`El pago dividido debe sumar ${formatCurrency(selectedTotal)}`, "error");
        const total = actions.payLoans({ plans, payments, vendedorName: vendedor });
        setPicks({});
        setAmount("");
        showToast(`Abono de ${formatCurrency(total)} registrado para ${selected.name}`, "success");
    };

    const exportExcel = async () => {
        try {
            const rows = [];
            loans.forEach((loan) => {
                const d = loanDate(loan);
                (loan.items || []).forEach((item) =>
                    rows.push({
                        cliente: loan.customerName,
                        fecha: d.toLocaleDateString("es-CO"),
                        hora: formatTime(d),
                        producto: item.name,
                        cantidad: item.cartQuantity,
                        precio: item.price,
                        subtotal: item.price * item.cartQuantity,
                        abonado: item.paid || 0,
                        debe: itemOutstanding(item),
                        notas: loan.notes || "",
                    })
                );
            });
            await exportWorkbook(`Creditos_${today()}.xlsx`, [
                {
                    name: "Créditos",
                    columns: [
                        { header: "Cliente", key: "cliente", width: 25 },
                        { header: "Fecha", key: "fecha", width: 14 },
                        { header: "Hora", key: "hora", width: 10 },
                        { header: "Producto", key: "producto", width: 30 },
                        { header: "Cantidad", key: "cantidad", width: 10 },
                        { header: "Precio unit.", key: "precio", money: true },
                        { header: "Subtotal", key: "subtotal", money: true },
                        { header: "Abonado", key: "abonado", money: true },
                        { header: "Debe", key: "debe", money: true },
                        { header: "Notas", key: "notas", width: 30 },
                    ],
                    rows,
                },
            ]);
            showToast("Excel de créditos descargado", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo exportar el Excel", "error");
        }
    };

    return (
        <div className="page">
            <PageHeader icon={Wallet} title="Créditos" subtitle={`${debtors.length} clientes deben ${formatCurrency(totalDebt)}`}>
                {can("exportData") && (
                    <button className="btn btn--ghost" onClick={exportExcel} disabled={!loans.length}>
                        <FileSpreadsheet size={18} /> Exportar Excel
                    </button>
                )}
            </PageHeader>

            {debtors.length === 0 ? (
                <div className="card">
                    <EmptyState icon={HandMetal} title="¡Nadie debe nada!">
                        Los créditos se crean desde la Caja con el botón «Fiar».
                    </EmptyState>
                </div>
            ) : (
                <div className="split-view">
                    <div className="card split-view__list">
                        <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente…" />
                        <div className="debtors">
                            {filtered.map((d) => (
                                <button key={d.id} className={`debtor ${d.id === selectedId ? "is-active" : ""}`} onClick={() => setSelectedId(d.id)}>
                                    <span className="avatar">{initials(d.name)}</span>
                                    <span className="debtor__info">
                                        <span className="debtor__name">{d.name}</span>
                                        <span className="debtor__meta">
                                            {d.loans.length} compra{d.loans.length > 1 ? "s" : ""} · {formatDateLong(d.last)}
                                        </span>
                                    </span>
                                    <span className="debtor__amount">{formatCurrency(d.total)}</span>
                                </button>
                            ))}
                            {filtered.length === 0 && <EmptyState icon={Users} title="Sin resultados" />}
                        </div>
                    </div>

                    {selected && (
                        <div className="split-view__detail">
                            <div className="card">
                                <div className="detail-head">
                                    <div>
                                        <h2>{selected.name}</h2>
                                        <span className="muted">Debe {formatCurrency(selected.total)}</span>
                                    </div>
                                    {selected.id !== "sin-cliente" && (
                                        <button className="btn btn--ghost" onClick={() => remind(selected)} title="Enviar el detalle de la deuda por WhatsApp">
                                            <MessageCircle size={18} /> WhatsApp
                                        </button>
                                    )}
                                    <button className="btn btn--soft" onClick={toggleAll}>
                                        {allPicked ? <CheckSquare size={18} /> : <Square size={18} />} {allPicked ? "Quitar selección" : "Pagar todo"}
                                    </button>
                                </div>

                                <div className="timeline">
                                    {selected.loans.map((loan) => (
                                        <div className="timeline__item" key={loan.id}>
                                            <div className="timeline__head">
                                                <span>
                                                    <b>{formatDateLong(loan.dateObj)}</b> <span className="muted">{formatTime(loan.dateObj)}</span>
                                                    {loan.vendedorName && <span className="muted"> · {loan.vendedorName}</span>}
                                                </span>
                                                <b className="text-danger">{formatCurrency(loan.total)}</b>
                                            </div>
                                            {loan.notes && <div className="note">{loan.notes}</div>}
                                            {loan.items.map((item, idx) => {
                                                const q = picks[loan.id]?.[idx] || 0;
                                                return (
                                                    <div key={idx} className={`debt-line ${q ? "is-picked" : ""}`}>
                                                        <button className="debt-line__check" onClick={() => setPick(loan.id, idx, q ? 0 : item.cartQuantity)}>
                                                            {q ? <CheckSquare size={20} /> : <Square size={20} />}
                                                            <span className="debt-line__name">{item.name}</span>
                                                            <span className="muted">
                                                                {item.cartQuantity} × {formatCurrency(item.price)}
                                                                {item.paid > 0 && <span className="debt-line__paid"> · abonado {formatCurrency(item.paid)}</span>}
                                                            </span>
                                                        </button>
                                                        {q > 0 && item.cartQuantity > 1 && (
                                                            <div className="stepper stepper--sm">
                                                                <button onClick={() => setPick(loan.id, idx, q - 1)} aria-label="Menos">
                                                                    <Minus size={14} />
                                                                </button>
                                                                <span>{q}</span>
                                                                <button onClick={() => setPick(loan.id, idx, Math.min(item.cartQuantity, q + 1))} aria-label="Más">
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <span className="debt-line__total">{formatCurrency(q ? pickCost(item, q) : itemOutstanding(item))}</span>
                                                        {can("removeLoanItems") && (
                                                        <button
                                                            className="icon-btn icon-btn--danger"
                                                            title="Quitar del crédito (sin cobrar)"
                                                            onClick={() =>
                                                                showConfirm(`¿Quitar "${item.name}" del crédito de ${selected.name} sin cobrarlo?`, { confirmLabel: "Quitar" }).then(
                                                                    (ok) => ok && actions.removeLoanItem(loan, idx)
                                                                )
                                                            }
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card pay-box">
                                <ChipGroup options={PAY_MODES} value={payMode} onChange={setPayMode} className="chips--fill" />
                                {payMode === "amount" ? (
                                    <>
                                        <div className="cart__label">¿Cuánto entrega el cliente?</div>
                                        <MoneyInput value={amount} onChange={setAmount} />
                                        <div className="quick-amounts">
                                            {QUICK_AMOUNTS.filter((a) => a < selected.total).map((a) => (
                                                <button key={a} className={`btn btn--soft btn--sm ${typedAmount === a ? "is-active" : ""}`} onClick={() => setAmount(String(a))}>
                                                    {formatCurrency(a)}
                                                </button>
                                            ))}
                                            <button className={`btn btn--soft btn--sm ${typedAmount === selected.total ? "is-active" : ""}`} onClick={() => setAmount(String(selected.total))}>
                                                Todo {formatCurrency(selected.total)}
                                            </button>
                                        </div>
                                        {typedAmount > selected.total && <div className="note">Solo debe {formatCurrency(selected.total)}: se registra ese valor.</div>}
                                        {selectedTotal > 0 && (
                                            <div className="abono-preview">
                                                <div className="cart__label">Se aplica primero a lo más antiguo</div>
                                                {plans.flatMap((p) => p.paidItems).map((i, k) => (
                                                    <div key={k} className={`abono-preview__line ${i.partial ? "is-partial" : ""}`}>
                                                        <span>{i.partial ? i.name : `${i.cartQuantity} × ${i.name}`}</span>
                                                        <b>{formatCurrency(i.subtotal)}</b>
                                                    </div>
                                                ))}
                                                <div className="abono-preview__left">
                                                    Queda debiendo <b>{formatCurrency(selected.total - selectedTotal)}</b>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="muted small">Marca los productos que paga, o usa «Por monto» si entrega un valor suelto.</p>
                                )}
                                <div className="pay-box__total">
                                    <span>{payMode === "amount" ? "Abono" : "Abono seleccionado"}</span>
                                    <strong>{formatCurrency(selectedTotal)}</strong>
                                </div>
                                <div className="cart__label">Recibe</div>
                                <div className="people">
                                    {vendedores.map((v) => (
                                        <button key={v.id} className={`person ${vendedor === v.name ? "is-active" : ""}`} onClick={() => setVendedor(v.name)}>
                                            <span className="person__avatar">{initials(v.name)}</span>
                                            <span className="person__name">{v.name.split(" ")[0]}</span>
                                        </button>
                                    ))}
                                </div>
                                <Toggle icon={Split} label="Dividir pago" checked={split} onChange={setSplit} />
                                {split ? (
                                    <SplitEditor methods={methods} rows={splitRows} onChange={setSplitRows} total={selectedTotal} />
                                ) : (
                                    <MethodPicker methods={methods} value={method} onChange={setMethod} compact />
                                )}
                                <button className="btn btn--primary btn--xl btn--block" disabled={selectedTotal <= 0} onClick={pay}>
                                    Registrar abono {selectedTotal > 0 && formatCurrency(selectedTotal)}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {phoneAsk && (
                <Modal title={`Celular de ${phoneAsk.debtor.name}`} icon={MessageCircle} onClose={() => setPhoneAsk(null)} size="sm">
                    <form className="stack" onSubmit={savePhoneAndRemind}>
                        <Field label="Número de WhatsApp" hint="Se guarda en el cliente para la próxima vez">
                            <input
                                className="input input--lg"
                                inputMode="tel"
                                autoFocus
                                value={phoneAsk.phone}
                                onChange={(e) => setPhoneAsk((p) => ({ ...p, phone: e.target.value }))}
                                placeholder="Ej: 300 123 4567"
                            />
                        </Field>
                        <div className="modal__actions">
                            <button type="button" className="btn btn--ghost btn--lg" onClick={() => setPhoneAsk(null)}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn--primary btn--lg">
                                <Save size={18} /> Guardar y abrir WhatsApp
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
