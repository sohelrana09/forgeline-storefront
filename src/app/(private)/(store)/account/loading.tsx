import { AccountSkeleton } from "@/components/ui/Skeletons";

// Shown inside the account layout while a section loads: the sidebar stays put and answers clicks at once.
export default function AccountLoading() {
  return <AccountSkeleton />;
}
