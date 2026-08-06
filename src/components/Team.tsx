import './Team.css'

export function Team() {
  return (
    <div className="team-page">
      <div className="team-card">
        <img
          src="https://avatars.githubusercontent.com/u/100067922?v=4"
          alt="Copernicium282"
          className="team-avatar"
        />
        <h2 className="team-name">Copernicium282</h2>
        <p className="team-role">Main Developer</p>
        <a
          href="https://github.com/Copernicium282"
          target="_blank"
          rel="noopener noreferrer"
          className="team-github"
        >
          github.com/Copernicium282
        </a>
      </div>
    </div>
  )
}
