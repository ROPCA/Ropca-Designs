"use client";

import StoreShell from "@/components/store-shell";
import Image from "next/image";
import { saveCustomRequestCode } from "@/lib/cart-store";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowRight, Upload, X } from "lucide-react";

const models = [
  "Talaria Sting R / MX4",
  "Talaria Sting / MX3",
  "Sur-Ron Light Bee X",
  "Sur-Ron Ultra Bee",
  "E Ride Pro SS",
  "Other / not listed",
];
const styles = ["Race / number plate", "Full wrap", "Minimal / clean", "Retro / vintage", "I will share a reference"];
const colors = ["Volt lime", "Crimson red", "Ice blue", "Stealth black", "Surprise me"];

function CustomForm() {
  const [values, setValues] = useState({ name: "", email: "", model: models[0], style: styles[0], color: colors[0], riderName: "", number: "", instructions: "" });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : "");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => body.set(key, value));
    if (file) body.set("reference", file);
    try {
      const response = await fetch("/api/custom-requests", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't submit your design brief.");
      saveCustomRequestCode(result.reference);
      setMessage(`Brief received. Reference ${result.reference}. Add a product to your cart, then enter this code and your submission email to include the specs with that order. The design brief is a separate quote request and has no added charge at checkout.`);
      setValues({ name: "", email: "", model: models[0], style: styles[0], color: colors[0], riderName: "", number: "", instructions: "" });
      setFile(null);
      setPreviewUrl("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't submit your design brief.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="custom-layout">
    <form className="form-grid" onSubmit={submit}>
      <label className="field-label">Your name<input className="field-input" required maxLength={100} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label>
      <label className="field-label">Email address<input className="field-input" type="email" required maxLength={254} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
      <label className="field-label full">Your bike<select className="field-select" value={values.model} onChange={(e) => setValues({ ...values, model: e.target.value })}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
      <label className="field-label">Graphics style<select className="field-select" value={values.style} onChange={(e) => setValues({ ...values, style: e.target.value })}>{styles.map((style) => <option key={style}>{style}</option>)}</select></label>
      <label className="field-label">Color direction<select className="field-select" value={values.color} onChange={(e) => setValues({ ...values, color: e.target.value })}>{colors.map((color) => <option key={color}>{color}</option>)}</select></label>
      <label className="field-label">Rider name / team<input className="field-input" maxLength={80} value={values.riderName} onChange={(e) => setValues({ ...values, riderName: e.target.value })} placeholder="Optional" /></label>
      <label className="field-label">Race number<input className="field-input" maxLength={8} value={values.number} onChange={(e) => setValues({ ...values, number: e.target.value })} placeholder="Optional" /></label>
      <label className="field-label full">Design notes<textarea className="field-textarea" maxLength={2000} value={values.instructions} onChange={(e) => setValues({ ...values, instructions: e.target.value })} placeholder="Tell us what you have in mind—colors, inspiration, must-haves…" /></label>
      <label className="field-label full">Reference image <span style={{ color: "var(--muted)", fontSize: 9, fontWeight: 400 }}>Optional · JPG, PNG, or WebP up to 5 MB</span>
        <input className="field-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} style={{ padding: 11 }} />
      </label>
      <div className="full" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "Sending brief…" : <>Send design brief <ArrowRight size={14} /></>}</button>
        {file && <button type="button" className="button-secondary" onClick={() => { setFile(null); setPreviewUrl(""); }}><X size={14} />Remove image</button>}
      </div>
      {message && <div className={`notice full ${message.startsWith("Brief received") ? "" : "error"}`} role={message.startsWith("Brief received") ? "status" : "alert"}>{message}</div>}
    </form>
    <aside className="builder-preview">
      {previewUrl ? <Image src={previewUrl} alt="Your uploaded reference preview" fill unoptimized sizes="(max-width: 680px) 100vw, 40vw" style={{ objectFit: "cover" }} /> : <Image src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1100&q=85" alt="" fill sizes="(max-width: 680px) 100vw, 40vw" style={{ objectFit: "cover" }} />}
      <div className="preview-overlay"><div className="eyebrow">{values.model}</div><div className="preview-name">{values.riderName || values.color}</div><div className="preview-number">{values.number || "00"}</div><span style={{ color: "#d0d2cf", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase" }}>{values.style} · concept preview</span></div>
    </aside>
  </section>;
}

export default function CustomDesignPage() {
  return <StoreShell><div className="wrap">
    <section className="page-hero"><div className="eyebrow">One of one / custom studio</div><h1 className="display">Bring your<br />vision.</h1><p>Choose your bike and direction, then tell our design crew the details. This brief is a request for a custom quote, not a finished design or purchase.</p></section>
    <div className="notice" role="note"><Upload size={14} style={{ display: "inline", marginRight: 7 }} />Add your bike, color direction, and race details. We&apos;ll review the brief and follow up with next steps.</div>
    <CustomForm />
  </div></StoreShell>;
}
