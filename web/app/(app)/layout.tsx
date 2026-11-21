import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#e0e7ff_0%,_transparent_45%),radial-gradient(ellipse_at_top_right,_#fae8ff_0%,_transparent_40%)] bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
