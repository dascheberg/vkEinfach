import { requireAuth } from "@/lib/auth/session";
import Navigation from "@/components/ui/Navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const user = session.user as { name: string; role?: string };

  return (
    <div className="drawer lg:drawer-open">
      <input id="main-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Mobile-Header */}
        <div className="navbar bg-base-300 lg:hidden sticky top-0 z-20">
          <label htmlFor="main-drawer" className="btn btn-ghost btn-square">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-5 w-5 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </label>
          <span className="text-xl font-bold ml-2">vkEinfach</span>
        </div>
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
      <Navigation userName={user.name} userRole={user.role ?? "member"} />
    </div>
  );
}
