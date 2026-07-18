/**
 * Sign-in / sign-up keep the original light design in BOTH themes (the
 * user's explicit choice): `.theme-light` re-pins every themed token to its
 * light value, and the `dark:` variant is defined to skip this subtree —
 * see globals.css.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-light theme-light-page flex flex-1 flex-col text-ink">{children}</div>;
}
