import { BuSwitcher } from "@/features/business-units/components/BuSwitcher";

// Header area that says who you're buying for: a unit switcher when the buyer belongs to several units,
// a "Buying for" label for one unit, and a sign-in hint for guests.
export function BuyingContextBadge({
  guest,
  consumer = false,
  businessUnitName,
  storeName,
  selectedKey,
  options,
}: {
  guest: boolean;
  consumer?: boolean;
  businessUnitName: string;
  storeName: string;
  selectedKey: string;
  options: { key: string; label: string }[];
}) {
  if (guest) {
    return (
      <span className="text-sm text-gray-300">Welcome to Ironline Supply</span>
    );
  }
  if (consumer) {
    return (
      <span className="text-sm text-gray-300">
        Personal account · <strong className="text-gray-50">{storeName}</strong> · prices incl. VAT
      </span>
    );
  }
  if (options.length > 1) return <BuSwitcher options={options} selected={selectedKey} />;
  return (
    <span className="text-sm text-gray-300">
      Buying for <strong className="text-gray-50">{businessUnitName}</strong> · {storeName}
    </span>
  );
}
