"use client";

import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";
import { Big, Notice, money } from "./ui";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(pk: string) {
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

type Props = {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  returnUrl: string;
  onPaid: () => void;
  onCancel?: () => void;
};

// One tap with Apple Pay / Google Pay when the phone has it, a card form when it doesn't.
export function PayBox(props: Props) {
  const stripe = useMemo(() => getStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "night",
          variables: { colorPrimary: "#4f8cff", colorBackground: "#1c2233", colorText: "#f4f6fb", borderRadius: "14px", fontSizeBase: "18px", spacingUnit: "5px" },
        },
      }}
    >
      <Inner {...props} />
    </Elements>
  );
}

function Inner({ amountCents, returnUrl, onPaid, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: returnUrl } });
    setBusy(false);
    if (error) {
      setErr(error.message || "Card didn't go through. Try again.");
      return;
    }
    onPaid();
  };

  return (
    <div className="flex flex-col gap-4">
      <ExpressCheckoutElement
        onConfirm={async () => {
          await confirm();
        }}
        options={{ buttonHeight: 55, buttonType: { applePay: "plain", googlePay: "plain" } }}
      />
      <div className="muted text-center text-base font-bold">or pay with a card</div>
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />
      {err && <Notice kind="bad">{err}</Notice>}
      <Big kind="primary" onClick={confirm} busy={busy} disabled={!stripe || !elements}>
        Pay {money(amountCents)}
      </Big>
      {onCancel && (
        <Big kind="ghost" onClick={onCancel}>
          Never mind
        </Big>
      )}
    </div>
  );
}
