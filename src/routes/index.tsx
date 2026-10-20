import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  FileStack, Split, EyeOff, Database, LineChart, MessageCircleHeart, Mail, CheckCircle2, Menu, X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Truffle Metrics — Know where your margin really goes" },
      { name: "description", content: "Truffle Metrics turns scattered supplier invoices and POS sales data into clear cost and margin insights, plus practical advice for restaurants." },
      { property: "og:title", content: "Truffle Metrics — Know where your margin really goes" },
      { property: "og:description", content: "Clear cost and margin insights and practical advice for restaurants and hospitality businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const links = [
  { href: "#problem", label: "The problem" },
  { href: "#solution", label: "Our solution" },
  { href: "#how", label: "How it works" },
  { href: "#contact", label: "Contact" },
];

const btnPrimary = "inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnOutline = "inline-flex items-center justify-center rounded-full border border-primary/30 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5";

function Wordmark() {
  return (
    <a href="#top" className="font-display text-xl font-semibold text-foreground">
      Truffle Metrics<span className="ml-0.5 inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
    </a>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

function Index() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("is-visible"), io.unobserve(e.target))),
      { threshold: 0.15 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div id="top" className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Wordmark />
          <div className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition hover:text-foreground">{l.label}</a>
            ))}
            <a href="#contact" className={btnPrimary + " py-2"}>Get in touch</a>
          </div>
          <button className="md:hidden" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </nav>
        {open && (
          <div className="flex flex-col gap-4 border-t border-border px-5 py-5 md:hidden">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-foreground">{l.label}</a>
            ))}
            <a href="#contact" onClick={() => setOpen(false)} className={btnPrimary}>Get in touch</a>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 md:grid-cols-2 md:py-28">
          <Reveal>
            <h1 className="text-4xl font-semibold leading-[1.1] text-foreground sm:text-5xl lg:text-6xl">
              Know where your margin <span className="text-primary">really</span> goes.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Truffle Metrics turns your scattered invoices and sales data into clear insights, and practical advice you can act on this week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className={btnPrimary}>Talk to us</a>
              <a href="#how" className={btnOutline}>See how it works</a>
            </div>
          </Reveal>
          <Reveal><DashboardCard /></Reveal>
        </section>

        {/* Problem */}
        <section id="problem" className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">Running a restaurant is hard enough without the spreadsheet chaos.</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: FileStack, t: "Invoices everywhere", d: "Dozens of suppliers, different formats, paper and PDF. Nobody has the full picture." },
              { icon: Split, t: "Sales split across systems", d: "POS, delivery apps, events and bar sales all report differently, so comparing them takes hours." },
              { icon: EyeOff, t: "Margins you can't see", d: "Prices change, portions drift and waste adds up. By the time you notice, the month is over." },
            ].map(({ icon: I, t, d }) => (
              <Reveal key={t} className="rounded-2xl border border-border bg-card p-7 shadow-soft">
                <I className="h-6 w-6 text-primary" />
                <h3 className="mt-5 text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className="bg-primary py-20 text-primary-foreground">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">One clear view of costs, sales and margins.</h2>
              <p className="mt-4 max-w-xl text-primary-foreground/80">We bring your invoices and POS data together, structure them, and show you what's actually driving your profit.</p>
            </Reveal>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                { icon: Database, t: "Structured data", d: "We clean and organize invoices and sales into one consistent dataset." },
                { icon: LineChart, t: "Insights that matter", d: "See cost trends, margin per dish or category, supplier price changes and outliers." },
                { icon: MessageCircleHeart, t: "Advice you can act on", d: "Personalized follow-up consulting in plain language, with clear next steps for your venue." },
              ].map(({ icon: I, t, d }) => (
                <Reveal key={t}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground"><I className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-xl font-semibold">{t}</h3>
                  <p className="mt-2 text-primary-foreground/80">{d}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><h2 className="text-3xl font-semibold sm:text-4xl">Simple to start, useful from week one.</h2></Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Share your invoices and POS exports",
              "We structure and analyze your data",
              "You receive an easy-to-read overview of costs and margins",
              "We walk you through personalized, actionable recommendations",
            ].map((s, i) => (
              <li key={s} className="contents">
                <Reveal className="rounded-2xl border border-border bg-card p-7 shadow-soft">
                  <span className="font-display text-4xl font-semibold text-primary">0{i + 1}</span>
                  <p className="mt-4 font-medium">{s}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Who */}
        <section className="px-5">
          <Reveal className="mx-auto max-w-4xl rounded-3xl bg-secondary px-8 py-12 text-center">
            <p className="font-display text-2xl leading-snug sm:text-3xl">
              Built for owners of small and mid-sized restaurants, cafes, bars and hospitality groups who want clarity on invoice and sales.
            </p>
          </Reveal>
        </section>

        {/* Contact */}
        <section id="contact" className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-5">
          <Reveal className="md:col-span-2">
            <h2 className="text-3xl font-semibold sm:text-4xl">Let's look at your numbers together.</h2>
            <p className="mt-4 text-muted-foreground">Tell us a bit about your venue and we'll get back to you within two working days.</p>
            <a href="mailto:info@trufflemetrics.com" className="mt-8 inline-flex items-center gap-3 font-medium text-primary hover:underline">
              <Mail className="h-5 w-5" /> info@trufflemetrics.com
            </a>
          </Reveal>
          <Reveal className="md:col-span-3"><ContactForm /></Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-1 text-sm text-muted-foreground">Clarity for hospitality.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            {links.map((l) => <a key={l.href} href={l.href} className="hover:text-foreground">{l.label}</a>)}
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Truffle Metrics</p>
        </div>
      </footer>
    </div>
  );
}

function DashboardCard() {
  const bars = [62, 48, 74, 55, 80, 68, 90];
  return (
    <div className="relative mx-auto max-w-md" aria-label="Example dashboard with placeholder data" role="img">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10 rotate-2" />
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">This month · example</p>
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground">Food cost</p>
            <p className="mt-1 font-display text-3xl font-semibold">29%</p>
          </div>
          <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-xs opacity-80">Gross margin</p>
            <p className="mt-1 font-display text-3xl font-semibold">71%</p>
          </div>
        </div>
        <div className="mt-6 flex h-32 items-end gap-2.5">
          {bars.map((h, i) => (
            <div key={i} className={`flex-1 rounded-t-md ${i === bars.length - 1 ? "bg-accent" : "bg-primary/70"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="flex-1 text-center">{d}</span>)}
        </div>
      </div>
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  venue: z.string().trim().min(1, "Please enter your venue name").max(150),
  message: z.string().trim().min(1, "Please write a short message").max(1000),
});
type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;

function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      const errs: Errors = {};
      r.error.issues.forEach((i) => (errs[i.path[0] as keyof Errors] ??= i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-4 text-2xl font-semibold">Thanks, message received!</h3>
        <p className="mt-2 text-muted-foreground">We'll get back to you within two working days.</p>
      </div>
    );
  }

  const field = (name: keyof Errors, label: string, type = "text") => (
    <div>
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      {type === "textarea" ? (
        <textarea id={name} name={name} rows={5} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" aria-invalid={!!errors[name]} />
      ) : (
        <input id={name} name={name} type={type} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring" aria-invalid={!!errors[name]} />
      )}
      {errors[name] && <p className="mt-1 text-sm text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Name")}
        {field("email", "Email", "email")}
      </div>
      {field("venue", "Venue name")}
      {field("message", "Message", "textarea")}
      <button type="submit" className={btnPrimary}>Send message</button>
    </form>
  );
}
