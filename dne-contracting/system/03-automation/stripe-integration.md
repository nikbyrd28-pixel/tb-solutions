# Stripe Integration for D N E Contracting

## Setup Overview
- **Stripe Account**: Create at stripe.com (use mom's email)
- **API Keys**: Live & Test modes
- **Products**: Kitchen/Bathroom/Basement project types
- **Webhooks**: Payment events → n8n → Supabase

---

## 1. DATABASE SCHEMA (Add to Supabase)

```sql
-- Invoices Table
CREATE TABLE invoices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT UNIQUE NOT NULL, -- DNE-2024-001
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  project_type TEXT,
  scope_of_work TEXT,
  line_items JSONB, -- [{item: 'Labor', qty: 40, rate: 75, total: 3000}, ...]
  subtotal INT,
  tax INT DEFAULT 0,
  total_amount INT NOT NULL,
  deposit_required INT, -- typically 50% of total
  deposit_paid BOOLEAN DEFAULT false,
  final_balance INT,
  final_paid BOOLEAN DEFAULT false,
  payment_terms TEXT DEFAULT '50% deposit, 50% on completion',
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, partial, paid
  stripe_payment_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'mom'
);

-- Payments Table
CREATE TABLE payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  stripe_payment_id TEXT UNIQUE,
  amount INT NOT NULL,
  payment_method TEXT, -- 'card', 'bank_transfer', 'check'
  status TEXT DEFAULT 'pending', -- pending, processing, succeeded, failed
  paid_at TIMESTAMP WITH TIME ZONE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contracts/Project Agreements
CREATE TABLE contracts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lead_id BIGINT NOT NULL REFERENCES plumbing_leads(id),
  invoice_id BIGINT REFERENCES invoices(id),
  contract_number TEXT UNIQUE NOT NULL,
  project_name TEXT,
  scope_of_work TEXT,
  start_date DATE,
  estimated_completion DATE,
  project_phases JSONB, -- [{phase: 'Design', start: '2024-01-01', end: '2024-01-10', status: 'completed'}]
  milestones JSONB, -- [{name: 'Demolition Complete', date: '2024-01-15', payment_due: 5000}]
  warranty_months INT DEFAULT 12,
  contract_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  contract_url TEXT, -- PDF storage URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_invoice_lead ON invoices(lead_id);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_paid_date ON invoices(paid_at DESC);
CREATE INDEX idx_payment_invoice ON payments(invoice_id);
CREATE INDEX idx_contract_lead ON contracts(lead_id);
```

---

## 2. STRIPE PRODUCTS (Create in Dashboard)

### Kitchen Remodel
- Product ID: `prod_kitchen`
- Type: Service
- Taxable: Yes (PA sales tax 6%)
- Tax code: Service

### Bathroom Remodel
- Product ID: `prod_bathroom`
- Type: Service
- Taxable: Yes
- Tax code: Service

### Basement Project
- Product ID: `prod_basement`
- Type: Service
- Taxable: Yes
- Tax code: Service

---

## 3. N8N WORKFLOW: Invoice Generation & Payment Link

```json
{
  "name": "Invoice Generator & Payment Link",
  "nodes": [
    {
      "name": "Trigger: Quote Accepted",
      "type": "Webhook",
      "trigger": "quote_accepted",
      "inputs": {
        "lead_id": "{{trigger.lead_id}}",
        "quote_amount": "{{trigger.quote_amount}}",
        "project_type": "{{trigger.project_type}}",
        "scope": "{{trigger.scope}}"
      }
    },
    {
      "name": "Get Lead Details",
      "type": "Supabase",
      "operation": "query",
      "query": "SELECT * FROM plumbing_leads WHERE id = {{trigger.lead_id}}"
    },
    {
      "name": "Generate Invoice Number",
      "type": "Function",
      "script": "return 'DNE-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*10000)).padStart(4, '0');"
    },
    {
      "name": "Create Stripe Invoice",
      "type": "Stripe",
      "operation": "createInvoice",
      "inputs": {
        "customer_name": "{{node[1].data.full_name}}",
        "customer_email": "{{node[1].data.email}}",
        "invoice_number": "{{node[2].result}}",
        "line_items": [
          {
            "description": "{{trigger.project_type}} - {{trigger.scope}}",
            "amount": "{{trigger.quote_amount}}",
            "tax_rates": ["txr_pa_sales_tax"]
          }
        ],
        "due_date": "{{Date.now() + 30*24*60*60*1000}}",
        "memo": "50% deposit due upon signature, 50% upon completion"
      }
    },
    {
      "name": "Create Stripe Payment Link",
      "type": "Stripe",
      "operation": "createPaymentLink",
      "inputs": {
        "invoice_id": "{{node[3].id}}",
        "after_completion": {
          "type": "redirect",
          "url": "https://dne-contracting.com/thank-you?invoice={{node[3].id}}"
        }
      }
    },
    {
      "name": "Save to Supabase",
      "type": "Supabase",
      "operation": "insert",
      "table": "invoices",
      "data": {
        "lead_id": "{{trigger.lead_id}}",
        "stripe_invoice_id": "{{node[3].id}}",
        "invoice_number": "{{node[2].result}}",
        "customer_name": "{{node[1].data.full_name}}",
        "customer_email": "{{node[1].data.email}}",
        "customer_phone": "{{node[1].data.phone}}",
        "project_type": "{{trigger.project_type}}",
        "scope_of_work": "{{trigger.scope}}",
        "total_amount": "{{trigger.quote_amount}}",
        "deposit_required": "{{Math.round(trigger.quote_amount * 0.5)}}",
        "stripe_payment_link": "{{node[4].url}}",
        "status": "draft"
      }
    },
    {
      "name": "Send Invoice Email",
      "type": "Email",
      "to": "{{node[1].data.email}}",
      "subject": "Your D N E Contracting Invoice - {{node[2].result}}",
      "body": "Invoice Template (see below)",
      "attachments": ["{{node[3].pdf_url}}"]
    },
    {
      "name": "WhatsApp: Alert Mom",
      "type": "WhatsApp",
      "to": "{{env.MOM_PHONE}}",
      "message": "📄 Invoice {{node[2].result}} sent to {{node[1].data.full_name}}. Payment link: {{node[4].url}}"
    },
    {
      "name": "Webhook: Stripe Event Handler",
      "type": "Webhook",
      "trigger": "charge.succeeded",
      "inputs": {
        "invoice_id": "{{event.invoice}}",
        "amount": "{{event.amount}}"
      }
    },
    {
      "name": "Update Payment Status",
      "type": "Supabase",
      "operation": "update",
      "table": "payments",
      "data": {
        "status": "succeeded",
        "paid_at": "{{Date.now()}}",
        "receipt_url": "{{event.receipt_url}}"
      }
    },
    {
      "name": "Update Invoice",
      "type": "Supabase",
      "operation": "update",
      "table": "invoices",
      "data": {
        "deposit_paid": true,
        "status": "partial"
      }
    },
    {
      "name": "Payment Confirmation Email",
      "type": "Email",
      "to": "{{node[1].data.email}}",
      "subject": "Payment Received - {{node[2].result}}",
      "body": "Payment Confirmation Template"
    },
    {
      "name": "Project Start Notification",
      "type": "WhatsApp",
      "to": "{{env.MOM_PHONE}}",
      "message": "💰 Deposit received from {{node[1].data.full_name}}! Ready to start {{trigger.project_type}}."
    }
  ]
}
```

---

## 4. INVOICE EMAIL TEMPLATE

```html
<div style="font-family: Arial; max-width: 700px; margin: 0 auto; background: #f9fafb; padding: 40px 20px;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">INVOICE</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">{{invoiceNumber}}</p>
  </div>

  <!-- Details -->
  <div style="background: white; padding: 30px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
      <div>
        <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Bill To</p>
        <p style="margin: 0; font-weight: 600; font-size: 16px;">{{customerName}}</p>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">{{customerEmail}}</p>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">{{customerPhone}}</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Invoice Details</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Issue Date:</strong> {{issueDate}}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Due Date:</strong> {{dueDate}}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 3px;">UNPAID</span></p>
      </div>
    </div>

    <!-- Line Items -->
    <table style="width: 100%; margin: 30px 0; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #e2e8f0;">
          <th style="text-align: left; padding: 12px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Description</th>
          <th style="text-align: right; padding: 12px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 16px 0; color: #1e293b;">{{projectType}} - {{scope}}</td>
          <td style="text-align: right; padding: 16px 0; color: #1e293b; font-weight: 600;">{{subtotal | currency}}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; color: #64748b; text-align: right;">PA Sales Tax (6%)</td>
          <td style="text-align: right; padding: 12px 0; color: #64748b;">{{tax | currency}}</td>
        </tr>
      </tbody>
    </table>

    <!-- Total -->
    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #166534;">Subtotal</span>
        <span style="color: #166534; font-weight: 600;">{{subtotal | currency}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #166534;">Tax</span>
        <span style="color: #166534; font-weight: 600;">{{tax | currency}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 2px solid #dcfce7; padding-top: 12px;">
        <span style="color: #166534; font-weight: 700; font-size: 16px;">Total Due</span>
        <span style="color: #166534; font-weight: 700; font-size: 18px;">{{totalAmount | currency}}</span>
      </div>
    </div>

    <!-- Payment Info -->
    <div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 20px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0 0 12px; color: #0c447c; font-weight: 600;">💳 Payment Terms</p>
      <p style="margin: 0 0 8px; color: #0c447c; font-size: 14px;">50% deposit (${{depositRequired | currency}}) due to begin work</p>
      <p style="margin: 0; color: #0c447c; font-size: 14px;">50% balance (${{finalBalance | currency}}) due upon project completion</p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{paymentLink}}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px;">
        💰 Pay Deposit Now
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">D N E Contracting | Pottstown, PA</p>
      <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Questions? Reply to this email or call {{momPhone}}</p>
    </div>
  </div>
</div>
```

---

## 5. ENVIRONMENT VARIABLES

```
# .env
STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxx

MOM_PHONE=+15551234567
MOM_EMAIL=mom@dne-contracting.com
```

---

## 6. WEBHOOK HANDLING (n8n)

Stripe automatically POSTs events to n8n webhook:
- `invoice.created`
- `invoice.sent`
- `charge.succeeded`
- `charge.failed`
- `invoice.payment_action_required`

Each event triggers Supabase updates + notifications to mom.

---

## 7. MOM'S REVENUE DASHBOARD QUERY

```sql
SELECT
  DATE_TRUNC('week', paid_at)::DATE as week,
  COUNT(*) as payments_received,
  SUM(amount) as total_collected,
  AVG(amount) as avg_payment,
  COUNT(*) FILTER (WHERE status = 'partial') as deposits_only,
  COUNT(*) FILTER (WHERE status = 'paid') as full_payments
FROM payments
WHERE paid_at IS NOT NULL
  AND paid_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', paid_at)
ORDER BY week DESC;
```

---

## Implementation Checklist

- [ ] Create Stripe account & API keys
- [ ] Add invoice/payment tables to Supabase
- [ ] Create Stripe products (Kitchen, Bathroom, Basement)
- [ ] Build invoice email template
- [ ] Set up n8n workflows (invoice generation, payment events)
- [ ] Configure Stripe webhook in n8n
- [ ] Test end-to-end (quote → invoice → payment)
- [ ] Set environment variables
- [ ] Enable PA sales tax
- [ ] Create payment confirmation page
