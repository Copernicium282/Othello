import './Footer.css'

interface FooterLink {
  label: string
  href?: string
  navTo?: string
}

const linkSections: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Play',
    links: [
      { label: 'New Game', navTo: 'play' },
      { label: 'Join Game', navTo: 'play' },
      { label: 'Rules', href: 'https://www.worldothello.org/about/about-othello/othello-rules/official-rules/english' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'How To Play', navTo: 'howtoplay' },
      { label: 'Changelog', href: 'https://github.com/Copernicium282/Othello/commit/c19fbc051c04b1a8fd41da5b0aac105bfedc6848' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Team', navTo: 'team' },
      { label: 'License', href: 'https://github.com/Copernicium282/Othello/blob/master/LICENSE' },
    ],
  },
]

export function Footer({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {linkSections.map((section) => (
            <div key={section.title} className="footer-col">
              <h4 className="footer-col-title">{section.title}</h4>
              <ul className="footer-col-links">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.navTo ? (
                      <button
                        type="button"
                        className="footer-link"
                        onClick={() => onNavigate(link.navTo!)}
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-link"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span className="footer-chain-info">
            Somnia Shannon · chainId 50312
          </span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
