"use client"

import { useState } from "react"
import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react"

const navItems = [
  { icon: Home, label: "Home" },
  { icon: Search, label: "Discover" },
  { icon: PlusSquare, label: "Create" },
  { icon: MessageCircle, label: "Inbox" },
  { icon: User, label: "Profile" },
]

export function BottomNav() {
  const [active, setActive] = useState(0)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background"
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="flex items-center justify-around h-14">
        {navItems.map((item, index) => {
          const isActive = active === index
          const isCreate = item.label === "Create"
          return (
            <li key={item.label} className="flex-1">
              <button
                onClick={() => setActive(index)}
                className={`flex flex-col items-center justify-center w-full gap-0.5 py-1 transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon
                  className={isCreate ? "h-7 w-7" : "h-6 w-6"}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className="text-[10px] leading-tight font-medium">
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Safe area spacing for devices with home indicators */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
