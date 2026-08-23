import Header from './components/Header'
import Hero from './components/Hero'
import PopularLinks from './components/PopularLinks'
import { useLinks } from './lib/store'

export default function App() {
  const { links, addLink } = useLinks()

  return (
    <div className="min-h-dvh">
      <Header />
      <main>
        <Hero onAddLink={addLink} />
        <PopularLinks links={links} />
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
        Built with React + TailwindCSS · wlink © 2026
      </footer>
    </div>
  )
}
