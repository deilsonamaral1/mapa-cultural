import PostList from "@/components/PostList";
import SiteHeader from "@/components/SiteHeader";

export const metadata = { title: "Podcast | Mapa Cultural de Aquiraz" };

export default function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-4xl font-extrabold">Podcast</h1>
        <p className="mt-2 mb-8 max-w-xl text-slate-600">Conversas e episódios sobre a cultura de Aquiraz e do Ceará.</p>
        <PostList kind="podcast" />
      </main>
    </div>
  );
}
