"use client";
import {
  Home,
  Image as ImageIcon,
  Music2,
  Plus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="album-nav glass" aria-label="音乐相册主导航">
      <Link
        href="/"
        aria-label="首页"
        aria-current={pathname === "/" ? "page" : undefined}
        className={pathname === "/" ? "nav-active" : ""}
      >
        <Home />
      </Link>
      <button type="button" aria-label="探索／推荐（暂未开放）" disabled>
        <Music2 />
      </button>
      <Link href="/create?new=1" className="nav-create" aria-label="开始创建">
        <Plus />
      </Link>
      <Link
        href="/memories"
        aria-label="音乐记忆"
        aria-current={pathname.startsWith("/memories") ? "page" : undefined}
        className={pathname.startsWith("/memories") ? "nav-active" : ""}
      >
        <ImageIcon />
      </Link>
      <button type="button" aria-label="个人中心（暂未开放）" disabled>
        <UserRound />
      </button>
    </nav>
  );
}
