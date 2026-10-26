import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mail, CheckCircle2, Menu, X, ArrowUpRight, AlertCircle } from "lucide-react";
import { submitContact, contactSchema } from "@/lib/contact.functions";

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

function Wordmark() {
  return (
    <a href="#top" className="inline-flex items-baseline gap-1 leading-none" aria-label="truffle metrics">
      <span className="wordmark text-[1.7rem]">truffle</span>
      <span className="h-[0.6rem] w-[0.6rem] rounded-full bg-ember" aria-hidden />
      <span className="ml-1 text-sm font-medium text-muted-foreground">metrics</span>
    </a>
  );
}

/** A little rotated label stuck on a photo or tile. */
function Sticker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full bg-butter px-4 py-2 text-sm font-semibold text-ink shadow-soft ${className}`}>
      {children}
    </span>
  );
}

/** Two chat bubbles: the owner forwards an invoice, we push the answer back. */
function ChatMock() {
  return (
    <div className="flex flex-col gap-3" role="img" aria-label="Example chat: an owner forwards an invoice and gets a short alert back">
      <div className="self-end rounded-2xl rounded-br-sm bg-card px-4 py-3 text-sm font-medium shadow-soft">invoice.pdf</div>
      <div className="max-w-[17rem] self-start rounded-2xl rounded-bl-sm bg-ink px-4 py-3 text-sm text-paper shadow-soft">
        One line moved this month. Worth a call before you pay.
        <span className="mt-2 block h-1.5 w-1/2 rounded-full bg-ember" />
      </div>
    </div>
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

  const photoTile = "min-h-[16rem] md:min-h-[19rem]";
  const cap = "absolute bottom-4 left-4";

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
            <h1 className="text-5xl font-semibold leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
              Know where your margin{" "}
              <span className="relative inline-block text-ember">
                really
                <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="pointer-events-none absolute -left-[2%] -bottom-[0.14em] h-[0.2em] w-[104%]" aria-hidden>
                  <path d="M3 10 C 50 4, 120 3, 197 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>{" "}
              goes.
            </h1>
            <p className="mt-6 max-w-sm text-lg text-muted-foreground">Forward us your invoices. We message you what to check, on WhatsApp or email.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className={btnPrimary}>Talk to us</a>
              <a href="#how" className={btnOutline}>See how it works</a>
            </div>
          </Tile>
          <Tile className="min-h-[24rem] md:col-span-5 md:row-span-3 md:min-h-0">
            <Photo eager name="chef" alt="A chef plating food in a busy restaurant kitchen" className="absolute inset-0 object-[40%_50%]" />
            <Sticker className="absolute right-5 top-5 rotate-3">invoice in, WhatsApp out</Sticker>
          </Tile>
          <Tile className="grain flex min-h-[11rem] flex-col justify-end p-8 md:col-span-3">
            <p className="text-2xl font-semibold leading-tight">We come to you. No login, no dashboard.</p>
          </Tile>
          <Tile className="min-h-[11rem] md:col-span-4">
            <Photo name="receipt-pile" alt="A pile of crumpled receipts" className="absolute inset-0" />
            <Sticker className={`${cap} -rotate-3`}>the pile we love to read</Sticker>
          </Tile>
        </section>

        {/* Problem */}
        <section id="problem" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="grain-flip flex flex-col justify-between gap-6 p-8 sm:p-10 md:col-span-4">
            <p className={label}>The problem</p>
            <h2 className="text-4xl font-semibold leading-none sm:text-5xl">Sound familiar?</h2>
          </Tile>
          <Tile className={`${photoTile} md:col-span-8`}>
            <Photo name="paper-stack" alt="A tall stack of paper invoices" className="absolute inset-0" />
            <Sticker className={`${cap} rotate-2`}>invoices, everywhere</Sticker>
          </Tile>
          <Tile className="flex flex-col justify-between gap-8 bg-primary p-8 text-primary-foreground sm:p-12 md:col-span-12">
            <blockquote className="max-w-3xl font-display [font-variation-settings:'SOFT'_100,'opsz'_96] text-4xl font-semibold leading-[1.05] sm:text-6xl">
              “You run on <span className="text-butter">feeling</span>, not <span className="text-butter">facts</span>.”
            </blockquote>
            <p className="text-sm text-paper/70">A head of procurement in horeca, in one of our 60 restaurant visits</p>
          </Tile>
          <Tile className={`${photoTile} md:col-span-4`}>
            <Photo name="counter-pay" alt="A guest paying at a restaurant bar" className="absolute inset-0" />
            <Sticker className={`${cap} -rotate-2`}>sales in five places</Sticker>
          </Tile>
          <Tile className={`${photoTile} md:col-span-4`}>
            <Photo name="crates" alt="Stacked drinks crates in a storeroom" className="absolute inset-0" />
            <Sticker className={`${cap} rotate-2`}>margins you can't see</Sticker>
          </Tile>
          <Tile className={`${photoTile} md:col-span-4`}>
            <Photo name="receipts-dispenser" alt="Order tickets hanging on a rail" className="absolute inset-0 object-[50%_30%]" />
            <Sticker className={`${cap} -rotate-3`}>month over before you notice</Sticker>
          </Tile>
        </section>

        {/* Solution */}
        <section id="solution" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="grain flex flex-col justify-between gap-8 p-8 sm:p-10 md:col-span-5">
            <p className={label}>Our solution</p>
            <h2 className="text-4xl font-semibold leading-[1.05] sm:text-5xl">
              We check.<br />You get the message.
            </h2>
          </Tile>
          <Tile className="bg-card p-4 md:col-span-7">
            <Clip name="price-alert" alt="A supplier price list is checked and a price rise becomes an alert" className="border-0" />
          </Tile>
          <Tile className="grain-deep flex flex-col justify-between gap-6 p-8 md:col-span-4">
            <p className="text-3xl font-semibold leading-tight">We push it to you. You never log in.</p>
            <ChatMock />
          </Tile>
          <Tile className={`${photoTile} md:col-span-4`}>
            <Photo name="phone-pay" alt="A guest paying with a phone at a restaurant counter" className="absolute inset-0" />
          </Tile>
          <Tile className={`${photoTile} md:col-span-4`}>
            <Photo name="prep" alt="A cook prepping in a restaurant kitchen" className="absolute inset-0" />
            <Sticker className={`${cap} rotate-2`}>WhatsApp or email</Sticker>
          </Tile>
        </section>

        {/* How */}
        <section id="how" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="flex flex-col justify-between gap-8 bg-primary p-8 text-primary-foreground sm:p-10 md:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-butter">How it works</p>
            <h2 className="text-4xl font-semibold leading-[1.05] sm:text-5xl">Three steps. That's it.</h2>
          </Tile>
          <Tile className="min-h-[14rem] md:col-span-7 md:min-h-0">
            <Photo name="busy" alt="A busy restaurant dining room at lunch" className="absolute inset-0" />
          </Tile>
          {[
            { clip: "three-sources", alt: "Invoices and sales data flow into one place", n: "1", t: "Send us your invoices", bg: "bg-card" },
            { clip: "messy-to-clear", alt: "A messy pile of documents becomes a clear table", n: "2", t: "We check every line", bg: "grain-flip" },
            { clip: "email-brief", alt: "A short brief arrives in an inbox", n: "3", t: "It lands in WhatsApp or email", bg: "bg-card" },
          ].map(({ clip, alt, n, t, bg }) => (
            <Tile key={n} className={`${bg} p-4 pb-7 md:col-span-4`}>
              <Clip name={clip} alt={alt} className="border-0" />
              <div className="flex items-center gap-3 px-3 pt-5">
                <span className="wordmark text-3xl text-plum">{n}</span>
                <h3 className="text-xl font-semibold">{t}</h3>
              </div>
            </Tile>
          ))}
        </section>

        {/* Contact */}
        <section id="contact" className="grid gap-4 md:grid-cols-12 md:gap-5">
          <Tile className="min-h-[18rem] md:col-span-4 md:row-span-2 md:min-h-0">
            <Photo name="kitchen" alt="A cook working in a dim, warm kitchen" className="absolute inset-0" />
            <Sticker className="absolute left-5 top-5 -rotate-3">open for new pilots</Sticker>
          </Tile>
          <Tile className="flex flex-col justify-between gap-6 bg-primary p-8 text-primary-foreground sm:p-10 md:col-span-8">
            <h2 className="text-4xl font-semibold leading-[1.05] sm:text-5xl">Say hello.</h2>
            <a href="mailto:info@trufflemetrics.com" className="inline-flex items-center gap-2 self-start rounded-full bg-butter px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-95">
              <Mail className="h-4 w-4" /> info@trufflemetrics.com <ArrowUpRight className="h-4 w-4" />
            </a>
          </Tile>
          <Tile className="bg-card md:col-span-8"><ContactForm /></Tile>
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

type Errors = Partial<Record<keyof import("zod").infer<typeof contactSchema>, string>>;

function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitFn = useServerFn(submitContact);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = contactSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      const errs: Errors = {};
      r.error.issues.forEach((i) => (errs[i.path[0] as keyof Errors] ??= i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setFailed(false);
    setSending(true);
    try {
      await submitFn({ data: r.data });
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
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
