"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { getUserDisplayName } from "@/lib/names";

export function UserNav({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <div
        className={cn(className ?? "ml-auto", "h-5 w-24 animate-pulse rounded bg-foreground/10")}
        aria-hidden
      />
    );
  }

  if (!session?.user) {
    return (
      <div className={cn(className ?? "ml-auto")}>
        <Button asChild variant="outline" size="sm" className="px-3">
          <Link href="/login">Login</Link>
        </Button>
      </div>
    );
  }

  const name = getUserDisplayName(
    {
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      name: session.user.name,
      email: session.user.email,
    },
    "",
  );
  const role = session.user.role;
  async function onLogout() {
    try {
      await signOut({ callbackUrl: "/" });
      toast.success("Abgemeldet");
    } catch {
      toast.error("Abmelden fehlgeschlagen");
    }
  }

  return (
    <div className={cn(className ?? "ml-auto", "relative")} aria-label="Benutzer-Navigation">
      <button
        ref={btnRef}
        type="button"
        className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar
          userId={session.user.id}
          email={session.user.email}
          firstName={session.user.firstName}
          lastName={session.user.lastName}
          name={name}
          size={28}
          className="h-7 w-7 select-none"
          avatarSource={session.user.avatarSource}
          avatarUpdatedAt={session.user.avatarUpdatedAt}
          loading="eager"
        />
        <span className="hidden sm:inline text-foreground/90">
          {name}
          {role ? ` (${role})` : ""}
        </span>
        <svg aria-hidden className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Benutzermenü"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border/60 bg-card/95 backdrop-blur shadow-md"
        >
          <div className="px-3 py-2 text-xs text-foreground/70">
            Angemeldet als
            <div className="truncate text-foreground">{name}</div>
            {role && <div className="truncate">Rolle: {role}</div>}
          </div>
          <div className="h-px bg-border/60" />
          <div className="py-1">
            <Link
              role="menuitem"
              href="/mitglieder"
              className="block px-3 py-2 text-sm hover:bg-accent/30 focus:bg-accent/30 focus:outline-none"
              onClick={() => setOpen(false)}
            >
              Mitgliederbereich
            </Link>
            <Link
              role="menuitem"
              href="/mitglieder/profil"
              className="block px-3 py-2 text-sm hover:bg-accent/30 focus:bg-accent/30 focus:outline-none"
              onClick={() => setOpen(false)}
            >
              Profil
            </Link>
            <button
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent/30 focus:bg-accent/30"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
