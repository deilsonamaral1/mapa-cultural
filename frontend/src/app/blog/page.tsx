import PostList from "@/components/PostList";
import SiteHeader from "@/components/SiteHeader";

export const metadata = { title: "Blog | Mapa Cultural de Aquiraz" };

export default function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-4xl font-extrabold">Blog</h1>
        <p className="mt-2 mb-8 max-w-xl text-slate-600">Textos, notícias e histórias da cultura de Aquiraz.</p>
        <PostList kind="blog" />
      </main>
    </div>
  );
}
