"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { IconLayoutNavbarCollapse } from "@tabler/icons-react"
import {
  AnimatePresence,
  motion,
} from "motion/react"

import { cn } from "@/lib/utils"

type FloatingDockItem = {
  title: string
  icon: ReactNode
  href?: string
  onClick?: () => void
  active?: boolean
}

export function FloatingDock({
  items,
  desktopClassName,
  mobileClassName,
  showMobile = true,
}: {
  items: FloatingDockItem[]
  desktopClassName?: string
  mobileClassName?: string
  showMobile?: boolean
}) {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      {showMobile ? <FloatingDockMobile items={items} className={mobileClassName} /> : null}
    </>
  )
}

function DockAction({
  className,
  title,
  href,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  className: string
  title: string
  href?: string
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: ReactNode
}) {
  if (href) {
    return (
      <a
        href={href}
        aria-label={title}
        className={className}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      aria-label={title}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={className}
    >
      {children}
    </button>
  )
}

function FloatingDockMobile({
  items,
  className,
}: {
  items: FloatingDockItem[]
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open ? (
          <motion.div
            layoutId="dock-mobile"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: { delay: idx * 0.04 },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.04 }}
              >
                <DockAction
                  title={item.title}
                  href={item.href}
                  onClick={() => {
                    item.onClick?.()
                    setOpen(false)
                  }}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border border-border bg-card/92 text-muted-foreground shadow-sm backdrop-blur",
                    item.active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <div className="size-4">{item.icon}</div>
                </DockAction>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur"
      >
        <IconLayoutNavbarCollapse className="size-5 text-muted-foreground" />
      </button>
    </div>
  )
}

function FloatingDockDesktop({
  items,
  className,
}: {
  items: FloatingDockItem[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto hidden items-end gap-1 rounded-full border border-border bg-card/88 px-2 py-2 shadow-[0_16px_40px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] backdrop-blur-2xl md:flex",
        className,
      )}
    >
      {items.map((item) => (
        <DockIcon key={item.title} {...item} />
      ))}
    </div>
  )
}

function DockIcon({
  title,
  icon,
  href,
  onClick,
  active,
}: FloatingDockItem) {
  const [hovered, setHovered] = useState(false)

  return (
    <DockAction
      title={title}
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex size-12 items-end justify-center"
    >
      <motion.div
        animate={
          hovered
            ? { scale: 1.09, y: -5 }
            : { scale: 1, y: 0 }
        }
        transition={{
          duration: 0.24,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn(
          "relative flex size-11 transform-gpu items-center justify-center rounded-full border border-border/70 bg-secondary text-secondary-foreground shadow-sm backdrop-blur transition-[background-color,color,border-color,box-shadow] duration-200 will-change-transform",
          active
            ? "border-transparent bg-primary text-primary-foreground shadow-[0_10px_26px_color-mix(in_oklab,var(--color-primary)_32%,transparent)]"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <AnimatePresence>
          {hovered ? (
            <motion.div
              initial={{ opacity: 0, y: 8, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 4, x: "-50%" }}
              className="pointer-events-none absolute -top-9 left-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
            >
              {title}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          animate={hovered ? { scale: 1.04 } : { scale: 1 }}
          transition={{
            duration: 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex size-5 items-center justify-center"
        >
          {icon}
        </motion.div>

        {active ? (
          <span className="absolute -bottom-2 size-1 rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]" />
        ) : null}
      </motion.div>
    </DockAction>
  )
}
