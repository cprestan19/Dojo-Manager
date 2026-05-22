"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { User, CreditCard, Clock, ClipboardList, LogOut, Video, Calendar, Radio } from "lucide-react";
import { getBeltInfo } from "@/lib/utils";
import Image from "next/image";

interface Props {
  student: {
    id: string;
    fullName: string;
    photo: string | null;
    dojo: { name: string; logo: string | null } | null;
    beltHistory: { beltColor: string }[];
  };
}

const BASE_TABS = [
  { href: "/portal",            label: "Perfil",      icon: User          },
  { href: "/portal/payments",   label: "Pagos",       icon: CreditCard    },
  { href: "/portal/schedules",  label: "Horarios",    icon: Clock         },
  { href: "/portal/attendance", label: "Asistencia",  icon: ClipboardList },
  { href: "/portal/videos",     label: "Videos",      icon: Video         },
  { href: "/portal/events",     label: "Eventos",     icon: Calendar      },
];

export default function PortalNav({ student }: Props) {
  const pathname  = usePathname();
  const belt      = student.beltHistory[0]?.beltColor;
  const beltInfo  = belt ? getBeltInfo(belt) : null;
  const initials  = student.fullName.split(" ").slice(0, 2).map(w => w[0]).join("");

  const [hasLive, setHasLive] = useState(false);

  useEffect(() => {
    fetch("/api/portal/live-tatamis")
      .then(r => r.ok ? r.json() : { tatamis: [] })
      .then(d => setHasLive((d.tatamis?.length ?? 0) > 0))
      .catch(() => null);
    const iv = setInterval(() => {
      fetch("/api/portal/live-tatamis")
        .then(r => r.ok ? r.json() : { tatamis: [] })
        .then(d => setHasLive((d.tatamis?.length ?? 0) > 0))
        .catch(() => null);
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const tabs = [
    ...BASE_TABS,
    { href: "/portal/live", label: "En Vivo", icon: Radio, badge: hasLive },
  ];

  return (
    <>
      <header className="bg-dojo-dark border-b border-dojo-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-dojo-border overflow-hidden flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
            {student.photo
              ? <Image src={student.photo} alt="" width={36} height={36} className="object-cover w-full h-full" unoptimized />
              : initials
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-dojo-white leading-tight">{student.fullName}</p>
            <p className="text-xs text-dojo-muted leading-tight">{student.dojo?.name ?? "Dojo Master"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {beltInfo && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex, border: `1px solid ${beltInfo.hex}40` }}
            >
              {beltInfo.label}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-dojo-muted hover:text-dojo-white transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <nav className="bg-dojo-dark border-b border-dojo-border shrink-0">
        <div className="flex">
          {tabs.map(t => {
            const Icon   = t.icon;
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            const badge  = "badge" in t ? t.badge : false;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2 relative ${
                  active
                    ? "border-dojo-red text-dojo-red"
                    : "border-transparent text-dojo-muted hover:text-dojo-white"
                }`}
              >
                <span className="relative">
                  <Icon size={18} />
                  {badge && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
