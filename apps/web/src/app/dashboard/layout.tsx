"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Mic, FileText, Calendar, BookOpen, BarChart2 } from "lucide-react";

const nav = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/record", icon: Mic, label: "Record" },
  { href: "/dashboard/summaries", icon: FileText, label: "Summaries" },
  { href: "/dashboard/calendar", icon: Calendar, label: "Calendar" },
  { href: "/dashboard/quizzes", icon: BookOpen, label: "Quizzes" },
  { href: "/dashboard/progress", icon: BarChart2, label: "Progress" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <aside className="w-56 border-r border-[#1a1a1a] flex flex-col py-6 px-4 shrink-0">
        <div className="font-serif italic text-xl mb-8 px-2">StudyAgent</div>
        <nav className="flex-1 flex flex-col gap-1">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active ? "bg-white text-black font-medium" : "text-[#555] hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2">
          <UserButton
            appearance={{ elements: { avatarBox: "w-8 h-8" } }}
            showName
          />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
