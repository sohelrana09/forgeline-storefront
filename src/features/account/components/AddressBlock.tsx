import type { BaseAddress } from "@commercetools/platform-sdk";
import { addressLines } from "@/features/account/utils";

export function AddressBlock({ address }: { address?: BaseAddress }) {
  if (!address) return <p className="m-0 text-gray-600">None</p>;
  return (
    <address className="not-italic leading-relaxed">
      {addressLines(address).map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </address>
  );
}
