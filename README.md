# Truffle Margin Insights

Build a single-page, responsive marketing landing page for a start-up called "Truffle Metrics". Do not add login, database, or extra pages. Keep it a clean static page with smooth-scroll navigation.

ABOUT THE COMPANY
Truffle Metrics helps owners of mid-sized restaurants and hospitality businesses make sense of fragmented supplier invoices and POS sales data. We turn that data into clear, structured analysis of costs and margins, followed by personalized, actionable consulting.

BRAND & STYLE
- Fresh, warm, modern, premium but approachable. Lots of white space, rounded corners, subtle shadows.
- Colors: background cream #FAF6EF, text dark truffle brown #2B1D16, primary forest green #1F4D3A, accent saffron #F2A93B (use for buttons and small highlights only).
- Fonts: Fraunces for headings, Inter for body (Google Fonts).
- Logo: text wordmark "Truffle Metrics" with a small saffron dot, no image.
- Tone: plain-spoken, warm, confident, no jargon.
- Do not use stock photos. Use simple icons (lucide) and clean CSS-drawn illustrations, e.g. a mock dashboard card with a few bars and a margin percentage in the hero.

SECTIONS (in this order)

1. Sticky navbar: wordmark left; links: The problem, Our solution, How it works, Contact; saffron button "Get in touch" scrolling to contact.

2. Hero
Headline: "Know where your margin really goes."
Subheadline: "Truffle Metrics turns your scattered invoices and sales data into clear insights, and practical advice you can act on this week."
Buttons: "Talk to us" (saffron, scrolls to contact) and "See how it works" (outline).
Right side: a stylized dashboard card (placeholder data) showing food cost %, gross margin, and a small bar chart.

3. The problem (id: problem)
Heading: "Running a restaurant is hard enough without the spreadsheet chaos."
Three cards:
- "Invoices everywhere": Dozens of suppliers, different formats, paper and PDF. Nobody has the full picture.
- "Sales split across systems": POS, delivery apps, events and bar sales all report differently, so comparing them takes hours.
- "Margins you can't see": Prices change, portions drift and waste adds up. By the time you notice, the month is over.

4. Our solution (id: solution)
Heading: "One clear view of costs, sales and margins."
Short intro: "We bring your invoices and POS data together, structure them, and show you what's actually driving your profit."
Three feature blocks with icons:
- "Structured data": We clean and organize invoices and sales into one consistent dataset.
- "Insights that matter": See cost trends, margin per dish or category, supplier price changes and outliers.
- "Advice you can act on": Personalized follow-up consulting in plain language, with clear next steps for your venue.

5. How it works (id: how)
Heading: "Simple to start, useful from week one."
Four numbered steps:
1. Share your invoices and POS exports
2. We structure and analyze your data
3. You receive an easy-to-read overview of costs and margins
4. We walk you through personalized, actionable recommendations

6. Who it's for
A short band: "Built for owners of small and mid-sized restaurants, cafes, bars and hospitality groups who want clarity on invoice and sales."

7. Contact (id: contact)
Heading: "Let's look at your numbers together."
Text: "Tell us a bit about your venue and we'll get back to you within two working days."
Form fields: Name, Email, Venue name, Message, and a submit button "Send message". For now, validate the fields and show a friendly success message on submit (no backend yet). Next to the form show the placeholder email info@trufflemetrics.com.

8. Footer: wordmark, short tagline "Clarity for hospitality.", copyright, anchor links.

RULES
- Do not invent testimonials, statistics, client logos or pricing.
- Fully responsive (mobile first), accessible contrast, subtle fade-in on scroll only.
- Keep the code simple and in as few components as reasonable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bc04dce4-46b0-4252-9ac0-7ae4e2d71cd3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
