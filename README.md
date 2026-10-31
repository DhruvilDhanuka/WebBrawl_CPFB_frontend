# SplitSmart

SplitSmart is a client-side web application that turns receipt photos into fair, itemized splits and computes exact member balances. Built for hostel life, canteen runs, grocery trips, and shared expenses.

- **Live Deployment**: [https://web-brawl-cpfb-frontend.vercel.app/](https://web-brawl-cpfb-frontend.vercel.app/)

---

## Setup Steps

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### Local Development
1. Navigate to the project directory:
   ```bash
   cd webBrawlFrontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

### Production Build
```bash
cd webBrawlFrontend
npm run build
npm run preview
```

---

## Models Used

- **Receipt Text Extraction (OCR)**: `Tesseract.js` (English language pack)
  - Runs 100% client-side in the browser.
  - Image preprocessing pipeline using HTML5 Canvas (grayscale and contrast adjustments) to handle faded thermal receipts.
  - Dynamic progress indicator tracking download, initialization, and recognition phases.
- **Item Categorization**: *Not implemented.* Zero-shot classification (`Transformers.js`) was deliberately omitted to maintain instant first-page load times, minimize client-side bundle size, and keep memory footprint low on mobile devices.

---

## Features Implemented by Tier

### Tier 1: Core Requirements
- **Groups & Members**: Create, rename, and delete groups from a centralized dashboard. Add and remove members with customizable color badges.
- **Receipt Capture & Preprocessing**: Upload receipt images (PNG/JPG) or use the camera. Interactive image preview with rotation and zoom controls.
- **Line-Item Parsing**: Client-side parser extracts item names, quantities, unit prices, and line totals while filtering out noise lines (GSTIN, headers, phone numbers, addresses). Detects subtotal, CGST, SGST, service charges, discounts, and grand totals.
- **Review & Correction**: Side-by-side receipt image and editable table. Users can add, edit, or delete items. Low-confidence OCR words are visually highlighted in yellow for quick correction.
- **Total Validation**: Real-time validation warning comparing sum of line items + taxes against detected grand total, highlighting any discrepancy.
- **Manual Expenses**: Add non-receipt expenses with description, amount, payer, participants, and date.
- **Balances View**: Real-time net balances for each group member, updating automatically after every added or deleted expense.

### Tier 2: Advanced Requirements
- **Itemized Assignment**: Interactive participant pills on each item row. Tap to assign items to one or multiple members in real time. Items split evenly among their assigned consumers.
- **Proportional Tax & Charges**: Distributes CGST, SGST, service charges, and discounts proportionally based on each person's consumed subtotal rather than splitting them equally. Includes a transparent breakdown card showing individual tax shares.
- **Rounding Reconciliation**: Exact paisa arithmetic preventing floating-point discrepancies (see Rounding Rule below).
- **Balances & Net Debt Tracking**: Real-time ledger tracking credits for payers and debits for consumers to identify who owes and who is owed.
- **Data Persistence**: All groups, members, expenses, and item assignments persist in `localStorage` (`splitsmart_groups_v1`) across page refreshes.
- *(Note: Item auto-categorization model was not implemented).*

### Tier 3: Brownie Points
- **Serverless URL State Sharing**: Serializes and compresses the entire group state using `lz-string` into a shareable URL (`/#/join?data=...`). Other members can open the link in any browser to instantly import the group and all its expenses without a backend or database.
- **Live Deployment**: Hosted and deployed on Vercel.

---

## Rounding Rule

To eliminate JavaScript floating-point errors, all currency calculations are performed in integer paise (`1 INR = 100 paise`):

1. Given an amount $A$ in paise and $N$ assigned participants:
   - Base share: `sharePaise = Math.floor(A / N)`
   - Remainder: `extraPaise = A - (sharePaise * N)`
2. The remainder paise are allocated to the first participant (`memberIds[0]`):
   - Participant 0 pays: `sharePaise + extraPaise`
   - Remaining participants pay: `sharePaise`
3. Result: The sum of individual shares always matches the total bill exact to the paisa.

---

## Debt & Balance Approach

1. Each group member maintains a net balance initialized to `0`.
2. When an expense is recorded:
   - The payer is credited with the total amount paid (`+amount`).
   - Each participating member is debited with their exact share (`-share`), derived either from itemized shares plus proportional tax, or an even split.
3. Balance status:
   - **Positive balance**: The member paid more than they consumed and is owed money by the group.
   - **Negative balance**: The member consumed more than they paid and owes money to the group.
   - **Zero balance**: The member is settled up.

---

## Tech Stack

- **Framework**: React 19, Vite
- **Styling**: Tailwind CSS (dark mode theme)
- **Icons**: Lucide React
- **OCR Engine**: Tesseract.js (client-side)
- **Compression**: lz-string (for URL state sharing)
