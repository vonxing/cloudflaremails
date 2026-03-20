import { lazy, Suspense, useEffect } from "react"
import { AppStateProvider, useAppState } from "@/lib/app-state"
import { navigate, usePathname } from "@/lib/navigation"

const AdminPage = lazy(() =>
  import("@/pages/admin-page").then((module) => ({ default: module.AdminPage })),
)
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })),
)
const LoginPage = lazy(() =>
  import("@/pages/login-page").then((module) => ({ default: module.LoginPage })),
)
const MailboxesPage = lazy(() =>
  import("@/pages/mailboxes-page").then((module) => ({ default: module.MailboxesPage })),
)

function AppFallback() {
  return (
    <div className="flex h-svh items-center justify-center bg-[linear-gradient(180deg,#efefef_0%,#e3e3e3_100%)] dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)]">
      <div className="rounded-2xl border border-black/5 bg-white/90 px-5 py-3 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-400">
        页面加载中...
      </div>
    </div>
  )
}

function ForbiddenPage() {
  return (
    <div className="flex h-svh items-center justify-center bg-[linear-gradient(180deg,#efefef_0%,#e3e3e3_100%)] dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-slate-950/95">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Access</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
          无权访问管理页
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          当前账号没有管理员权限，无法访问用户管理和严格管理员操作。
        </p>
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          返回控制台
        </button>
      </div>
    </div>
  )
}

function AppRouter() {
  const pathname = usePathname()
  const { session, sessionReady } = useAppState()

  useEffect(() => {
    if (!sessionReady) {
      return
    }

    if (!session && pathname !== "/login") {
      navigate("/login")
      return
    }

    if (session && (pathname === "/login" || pathname === "/")) {
      navigate("/app")
    }
  }, [pathname, session, sessionReady])

  if (!sessionReady) {
    return null
  }

  if (!session && pathname !== "/login") {
    return null
  }

  if (session && (pathname === "/login" || pathname === "/")) {
    return null
  }

  if (pathname === "/admin" && session?.role !== "admin") {
    return <ForbiddenPage />
  }

  switch (pathname) {
    case "/":
    case "/app":
      return (
        <Suspense fallback={<AppFallback />}>
          <DashboardPage />
        </Suspense>
      )
    case "/mailboxes":
      return (
        <Suspense fallback={<AppFallback />}>
          <MailboxesPage />
        </Suspense>
      )
    case "/admin":
      return (
        <Suspense fallback={<AppFallback />}>
          <AdminPage />
        </Suspense>
      )
    case "/login":
    default:
      return (
        <Suspense fallback={<AppFallback />}>
          <LoginPage />
        </Suspense>
      )
  }
}

export function App() {
  return (
    <AppStateProvider>
      <AppRouter />
    </AppStateProvider>
  )
}

export default App
