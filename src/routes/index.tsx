import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Mail, CheckCircle2, Menu, X } from "lucide-react";

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

function Wordmark() {
  return (
    <a href="#top" className="text-xl font-semibold leading-none tracking-tight text-foreground">
      truffle<span className="ml-1.5 font-normal text-muted-foreground">metrics</span>
    </a>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
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

function Photo({ name, alt, className = "" }: { name: string; alt: string; className?: string }) {
  return <img src={`/photos/${name}.jpg`} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <Reveal>
            <p className={label}>Invoices, checked for you</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Know where your margin <span className="text-ember">really</span> goes.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Truffle Metrics turns your scattered invoices and sales data into clear insights, and practical advice you can act on this week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className={btnPrimary}>Talk to us</a>
              <a href="#how" className={btnOutline}>See how it works</a>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-3xl shadow-card sm:aspect-[3/2] md:aspect-[4/5]">
                <Photo name="chef" alt="A chef plating food in a busy restaurant kitchen" className="object-[40%_50%]" />
              </div>
              <div className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:left-auto sm:right-6 sm:w-72">
                <p className={label}>Example alert</p>
                <p className="mt-2 text-sm font-medium">One price line moved. Check it before you pay.</p>
                <span className="mt-3 block h-1.5 w-2/3 rounded-full bg-ember" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* Problem */}
        <section id="problem" className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className={label}>The problem</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-5xl">Running a restaurant is hard enough without the spreadsheet chaos.</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { img: "paper-stack", alt: "A tall stack of paper invoices", t: "Invoices everywhere", d: "Dozens of suppliers, different formats, paper and PDF. Nobody has the full picture." },
              { img: "counter-pay", alt: "A guest paying at a restaurant bar", t: "Sales split across systems", d: "POS, delivery apps, events and bar sales all report differently, so comparing them takes hours." },
              { img: "crates", alt: "Stacked drinks crates in a storeroom", t: "Margins you can't see", d: "Prices change, portions drift and waste adds up. By the time you notice, the month is over." },
            ].map(({ img, alt, t, d }) => (
              <Reveal key={t}>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl"><Photo name={img} alt={alt} /></div>
                <h3 className="mt-5 text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className="grain py-20 text-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
            <Reveal>
              <p className={label}>Our solution</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">We check. You get the message.</h2>
              <p className="mt-4 max-w-xl text-foreground/75">We bring your invoices and POS data together, structure them, and tell you what is actually driving your profit.</p>
              <ol className="mt-10 space-y-6">
                {[
                  { t: "Structured data", d: "We clean and organize invoices and sales into one consistent dataset." },
                  { t: "Insights that matter", d: "Cost trends, margin per category, supplier price changes and outliers." },
                  { t: "Advice you can act on", d: "A short message in plain language, with clear next steps for your venue." },
                ].map(({ t, d }, i) => (
                  <li key={t} className="flex gap-5">
                    <span className="text-2xl font-semibold text-plum">0{i + 1}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{t}</h3>
                      <p className="mt-1 text-foreground/75">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal><Clip name="price-alert" alt="A supplier price list is checked and a price rise becomes an alert" /></Reveal>
          </div>
        </section>

        {/* How */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <Reveal>
            <p className={label}>How it works</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Simple to start, useful from week one.</h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { clip: "three-sources", alt: "Invoices and sales data flow into one place", n: "01", t: "Share your invoices and POS exports", d: "Forward invoices as they arrive. Sales exports are a bonus where you have them." },
              { clip: "messy-to-clear", alt: "A messy pile of documents becomes a clear table", n: "02", t: "We structure and check every line", d: "Locally, privacy first. You get an easy-to-read overview of costs and margins." },
              { clip: "email-brief", alt: "A short brief arrives in an inbox", n: "03", t: "You get a short list of actions", d: "By email, in plain language. Then we walk you through the recommendations." },
            ].map(({ clip, alt, n, t, d }) => (
              <Reveal key={n}>
                <Clip name={clip} alt={alt} />
                <p className="mt-5 text-sm font-semibold text-plum">{n}</p>
                <h3 className="mt-1 text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Who */}
        <section className="px-5">
          <Reveal className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-primary text-primary-foreground md:grid-cols-[2fr_3fr]">
            <div className="h-64 md:h-auto"><Photo name="lantern" alt="A warm lantern in a dim restaurant" /></div>
            <div className="flex flex-col justify-center px-8 py-12 md:px-14">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-butter">Who it is for</p>
              <p className="mt-4 text-2xl font-medium leading-snug sm:text-3xl">
                Built for owners of newer independent restaurants, cafes and bars who want clarity on invoices and sales.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Contact */}
        <section id="contact" className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-5">
          <Reveal className="md:col-span-2">
            <p className={label}>Contact</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Let's look at your numbers together.</h2>
            <p className="mt-4 text-muted-foreground">Tell us a bit about your venue and we'll get back to you within two working days.</p>
            <a href="mailto:info@trufflemetrics.com" className="mt-8 inline-flex items-center gap-3 font-medium text-foreground underline-offset-4 hover:underline">
              <Mail className="h-5 w-5" /> info@trufflemetrics.com
            </a>
          </Reveal>
          <Reveal className="md:col-span-3"><ContactForm /></Reveal>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <a href="#top" className="text-xl font-semibold tracking-tight">truffle<span className="ml-1.5 font-normal opacity-60">metrics</span></a>
            <p className="mt-1 text-sm opacity-70">Clarity for hospitality.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm opacity-80">
            {links.map((l) => <a key={l.href} href={l.href} className="hover:opacity-100">{l.label}</a>)}
          </div>
          <p className="text-sm opacity-70">© {new Date().getFullYear()} Truffle Metrics</p>
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
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft" role="status">
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
