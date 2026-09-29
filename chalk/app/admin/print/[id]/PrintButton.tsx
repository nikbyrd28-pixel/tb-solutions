"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ fontSize: 18, padding: "10px 18px", borderRadius: 10, border: 0, background: "#4f8cff", color: "#fff", fontWeight: 800 }}
    >
      Print
    </button>
  );
}
