import Header from './components/Header'
import Hero from './components/Hero'
import PopularLinks from './components/PopularLinks'
import AllLinks from './components/AllLinks'
import MyLinks from './components/MyLinks'
import Redirector from './components/Redirector'

export default function App() {
  const path =
    typeof window !== 'undefined' ? window.location.pathname : '/'

  const appPage =
    path === '/all' ? AllLinks : path === '/my' ? MyLinks : null

  if (appPage) {
    const Page = appPage
    return (
      <div className="min-h-dvh">
        <Header />
        <main>
          <Page />
        </main>
        <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
          Built with React + TailwindCSS · wlink © 2026
        </footer>
      </div>
    )
  }

  const slug = path.match(/^\/([a-zA-Z0-9-]+)$/)?.[1] ?? null

  if (slug) {
    return <Redirector slug={slug} />
  }

  return (
    <div className="min-h-dvh">
      <Header />
      <main>
        <Hero />
        <PopularLinks />
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
        Built with React + TailwindCSS · wlink © 2026
      </footer>
    </div>
  )
}
