import * as React from "react";
import { Input } from "@/components/ui/input";

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCents(cents: number) {
  return formatter.format(cents / 100);
}

export type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const cents = Math.round((Number.isFinite(value) ? value : 0) * 100);
  const [display, setDisplay] = React.useState(() => formatCents(cents));
  const [digits, setDigits] = React.useState(() => String(cents));

  // keep in sync with external value changes (edição, auto-preenchimento)
  React.useEffect(() => {
    const currentFromDigits = Math.round(Number(digits || "0"));
    if (currentFromDigits !== cents) {
      setDigits(String(cents));
      setDisplay(formatCents(cents));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);

  const apply = (nextDigits: string) => {
    const clean = nextDigits.replace(/^0+(?=\d)/, "");
    const nextCents = Number(clean || "0");
    setDigits(clean);
    setDisplay(formatCents(nextCents));
    onValueChange(nextCents / 100);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const onlyDigits = e.target.value.replace(/\D/g, "");
        apply(onlyDigits);
      }}
    />
  );
}

export default CurrencyInput;
