import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Mail, CheckCircle2, Menu, X, ArrowUpRight } from "lucide-react";

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

const btnPrimary = "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnOutline = "inline-flex items-center justify-center rounded-full border border-primary/30 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-plum";

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

/** Bento tile: rounded, soft, one idea each. */
function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`reveal relative overflow-hidden rounded-[2rem] ${className}`}>{children}</div>;
}

/** Muted line-drawing clip: plays once when it scrolls into view and holds the last frame. */
function Clip({ name, alt, className = "" }: { name: string; alt: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          v.play().catch(() => {});
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      muted
      playsInline
      preload="metadata"
      poster={`/clips/${name}.jpg`}
      aria-label={alt}
      className={`w-full rounded-2xl border border-border bg-paper ${className}`}
    >
      <source src={`/clips/${name}.mp4`} type="video/mp4" />
    </video>
  );
}

function Photo({ name, alt, className = "", eager = false }: { name: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <img
      src={`/photos/${name}.jpg`}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** The truffle dot from the brand sheet: an ember ball with cracked veins. */
function TruffleDot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs><clipPath id="td"><circle cx="50" cy="50" r="48" /></clipPath></defs>
      <circle cx="50" cy="50" r="48" fill="var(--ember)" />
      <g clipPath="url(#td)" stroke="var(--paper)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M4 36 L30 30 L46 8 M30 30 L38 54 L14 70 M38 54 L66 46 L96 22 M66 46 L74 76 L52 98 M14 70 L22 98 M74 76 L98 80 M46 8 L68 4" />
      </g>
    </svg>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <a href="#top" className="inline-flex items-baseline gap-1.5 leading-none" aria-label="truffle metrics">
      <span className="wordmark text-[1.7rem]">truffle</span>
      <TruffleDot className="-mx-0.5 h-[0.65rem] w-[0.65rem] self-end" />
      <span className={`text-sm font-medium ${light ? "opacity-70" : "text-muted-foreground"}`}>metrics</span>
    </a>
  );
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

  const scrim = "absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent p-6 pt-20 text-paper";

  return (
    <div id="top" className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Wordmark />
          <div className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition hover:text-foreground">{l.label}</a>
            ))}
            <a href="#contact" className={btnPrimary + " py-2"}>Say hello</a>
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
            <a href="#contact" onClick={() => setOpen(false)} className={btnPrimary}>Say hello</a>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-5 sm:py-5 md:space-y-5">
        {/* Hero */}
        <section className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="bg-card p-8 sm:p-12 md:col-span-7 md:row-span-2">
            <p className={label}>Invoices, checked for you</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1] text-foreground sm:text-6xl lg:text-7xl">
              Know where your margin <span className="text-ember">really</span> goes.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Hand us your supplier invoices. You get back a short message with what to check and what it is worth. No login, no dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className={btnPrimary}>Talk to us</a>
              <a href="#how" className={btnOutline}>See how it works</a>
            </div>
          </Tile>
          <Tile className="min-h-[22rem] md:col-span-5 md:row-span-3 md:min-h-0">
            <Photo eager name="chef" alt="A chef plating food in a busy restaurant kitchen" className="absolute inset-0 object-[40%_50%]" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-border bg-card/95 p-4 shadow-card backdrop-blur sm:inset-x-6 sm:bottom-6">
              <p className={label}>Example message</p>
              <p className="mt-2 text-sm font-medium">One price line moved this month. Worth a call before you pay.</p>
              <span className="mt-3 block h-1.5 w-2/3 rounded-full bg-ember" />
            </div>
          </Tile>
          <Tile className="grain flex flex-col justify-between gap-6 p-8 md:col-span-4">
            <p className={label}>The idea</p>
            <p className="text-3xl font-semibold leading-tight">We check. You get the message.</p>
          </Tile>
          <Tile className="flex items-center justify-between gap-4 bg-primary p-8 text-primary-foreground md:col-span-3">
            <p className="text-lg font-medium leading-snug">Built for newer independent restaurants.</p>
            <TruffleDot className="h-14 w-14 shrink-0" />
          </Tile>
        </section>

        {/* Problem */}
        <section id="problem" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="bg-card p-8 sm:p-12 md:col-span-5">
            <p className={label}>The problem</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Running a restaurant is hard enough without the spreadsheet chaos.</h2>
          </Tile>
          {[
            { img: "paper-stack", alt: "A tall stack of paper invoices", t: "Invoices everywhere", d: "Dozens of suppliers, paper and PDF. Nobody has the full picture.", c: "md:col-span-7" },
            { img: "counter-pay", alt: "A guest paying at a restaurant bar", t: "Sales split across systems", d: "POS, delivery apps and bar sales all report differently.", c: "md:col-span-6" },
            { img: "crates", alt: "Stacked drinks crates in a storeroom", t: "Margins you can't see", d: "Prices drift and waste adds up. By the time you notice, the month is over.", c: "md:col-span-6" },
          ].map(({ img, alt, t, d, c }) => (
            <Tile key={t} className={`min-h-[18rem] md:min-h-[20rem] ${c}`}>
              <Photo name={img} alt={alt} className="absolute inset-0" />
              <div className={scrim}>
                <h3 className="text-2xl font-semibold">{t}</h3>
                <p className="mt-1 max-w-md text-sm text-paper/85">{d}</p>
              </div>
            </Tile>
          ))}
        </section>

        {/* Solution */}
        <section id="solution" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="grain p-8 sm:p-12 md:col-span-7">
            <p className={label}>Our solution</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">One clear view of costs, sales and margins.</h2>
            <ol className="mt-8 space-y-5">
              {[
                { t: "Structured data", d: "Invoices and sales cleaned into one consistent set." },
                { t: "Insights that matter", d: "Cost trends, supplier price changes and outliers." },
                { t: "Advice you can act on", d: "Plain language, with next steps for your venue." },
              ].map(({ t, d }, i) => (
                <li key={t} className="flex gap-4">
                  <span className="wordmark text-2xl text-plum">{i + 1}</span>
                  <p><span className="font-semibold">{t}.</span> <span className="text-foreground/75">{d}</span></p>
                </li>
              ))}
            </ol>
          </Tile>
          <Tile className="bg-card p-4 md:col-span-5">
            <Clip name="price-alert" alt="A supplier price list is checked and a price rise becomes an alert" className="border-0" />
          </Tile>
        </section>

        {/* How */}
        <section id="how" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="flex flex-col justify-end bg-primary p-8 text-primary-foreground sm:p-12 md:col-span-12">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-butter">How it works</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-5xl">Simple to start, useful from week one.</h2>
          </Tile>
          {[
            { clip: "three-sources", alt: "Invoices and sales data flow into one place", n: "1", t: "Share your invoices", d: "Forward them as they arrive. Sales exports are a bonus.", bg: "bg-card" },
            { clip: "messy-to-clear", alt: "A messy pile of documents becomes a clear table", n: "2", t: "We check every line", d: "Locally, privacy first. Then we turn it into a clear overview.", bg: "bg-secondary" },
            { clip: "email-brief", alt: "A short brief arrives in an inbox", n: "3", t: "You get the message", d: "A short list of actions by email, and a walk-through if you want one.", bg: "bg-card" },
          ].map(({ clip, alt, n, t, d, bg }) => (
            <Tile key={n} className={`${bg} p-4 pb-8 md:col-span-4`}>
              <Clip name={clip} alt={alt} className="border-0" />
              <div className="px-4 pt-6">
                <span className="wordmark text-3xl text-plum">{n}</span>
                <h3 className="mt-1 text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </div>
            </Tile>
          ))}
        </section>

        {/* Who and contact */}
        <section id="contact" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="min-h-[16rem] md:col-span-4 md:min-h-0">
            <Photo name="lantern" alt="A warm lantern in a dim restaurant" className="absolute inset-0" />
          </Tile>
          <Tile className="flex flex-col justify-between gap-8 bg-primary p-8 text-primary-foreground sm:p-10 md:col-span-8">
            <p className="text-2xl font-medium leading-snug sm:text-3xl">
              Tell us about your venue. We read every message and reply within two working days.
            </p>
            <a href="mailto:info@trufflemetrics.com" className="inline-flex items-center gap-2 self-start rounded-full bg-butter px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-95">
              <Mail className="h-4 w-4" /> info@trufflemetrics.com <ArrowUpRight className="h-4 w-4" />
            </a>
          </Tile>
          <Tile className="bg-card md:col-span-12"><ContactForm /></Tile>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-sm text-muted-foreground">Clarity for hospitality.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            {links.map((l) => <a key={l.href} href={l.href} className="hover:text-foreground">{l.label}</a>)}
          </div>
          <div className="text-sm text-muted-foreground md:text-right">
            <p>© {new Date().getFullYear()} Truffle Metrics</p>
            <p className="mt-1 text-xs">Photos: Unsplash</p>
          </div>
        </div>
      </footer>
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
      <div className="p-10 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-plum" />
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
    <form noValidate onSubmit={onSubmit} className="space-y-5 p-7 sm:p-10">
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
