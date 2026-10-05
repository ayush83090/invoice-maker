# Invoice Maker

A lightweight React + Vite invoice generator. No login, database, authentication, or user accounts.

## Features

- Minimal premium branded A4 invoice design
- Business details and logo upload
- Bill To section (no Ship To section)
- Dynamic invoice items and GST/IGST calculations
- Payment details and terms
- Classic / Modern / Minimal templates
- Live preview
- Vector PDF generation
- Print-ready A4 output
- Optional SMTP email with PDF attachment
- Save invoices locally in browser storage
- **Create Similar Invoice**: keeps business/branding, logo, payment details, template and item structure while clearing customer details and generating the next invoice number
- Load/delete saved invoices

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Optional email

Copy `.env.example` to `.env`, fill in SMTP values, then run:

```bash
npm run start
```

Email sending is optional. The main invoice maker works without the email server.
