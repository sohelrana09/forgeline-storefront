import Link from "next/link";
import type { ReactNode } from "react";
import type { MessageLink, MessageType } from "@/lib/messages";

// A message box (tinted background, icon on the left), for page messages and for notices on a page.
export function Message({
  type,
  link,
  children,
  onDismiss,
}: {
  type: MessageType;
  link?: MessageLink;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const style = STYLE[type];
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`relative flex items-start gap-3 py-3 pl-3 pr-4 text-[13px] leading-5 ${style.box}`}
    >
      <span aria-hidden="true" className={`flex h-5 w-6 flex-none items-center justify-center ${style.icon}`}>
        {ICONS[type]}
      </span>
      <div className="m-0 min-w-0 flex-1">
        {children}
        {link && (
          <>
            {" "}
            <Link href={link.href} className="font-semibold text-[#1979c3] hover:underline">
              {link.label}
            </Link>
          </>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-my-1 flex h-7 w-7 flex-none items-center justify-center text-base opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

const STYLE: Record<MessageType, { box: string; icon: string }> = {
  success: { box: "bg-[#e5efe5] text-[#006400]", icon: "text-[#006400]" },
  error: { box: "bg-[#fae5e5] text-[#e02b27]", icon: "text-[#b30000]" },
  warning: { box: "bg-[#fdf0d5] text-[#6f4400]", icon: "text-[#c07600]" },
};

const ICONS: Record<MessageType, ReactNode> = {
  success: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2 1 21h22L12 2Zm-1 7h2v6h-2V9Zm0 8h2v2h-2v-2Z" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" />
    </svg>
  ),
};
