export default function BackgroundBlobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <svg className="blobs__svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="blobBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" />
          </filter>
          <filter id="blobBlurSmall">
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
          </filter>
        </defs>

        {/* Large coral blob — top right */}
        <ellipse
          className="blob blob--coral"
          cx="780"
          cy="180"
          rx="220"
          ry="180"
          fill="#F2B5A5"
          filter="url(#blobBlur)"
          opacity="0.5"
        />

        {/* Lavender blob — top left */}
        <ellipse
          className="blob blob--lavender"
          cx="150"
          cy="250"
          rx="180"
          ry="200"
          fill="#D4CCE8"
          filter="url(#blobBlur)"
          opacity="0.45"
        />

        {/* Sage blob — bottom center */}
        <ellipse
          className="blob blob--sage"
          cx="500"
          cy="820"
          rx="260"
          ry="180"
          fill="#B5D1B6"
          filter="url(#blobBlur)"
          opacity="0.4"
        />

        {/* Marigold blob — center right */}
        <ellipse
          className="blob blob--marigold"
          cx="850"
          cy="550"
          rx="160"
          ry="140"
          fill="#F2DFA0"
          filter="url(#blobBlur)"
          opacity="0.4"
        />

        {/* Sky blob — bottom left */}
        <ellipse
          className="blob blob--sky"
          cx="120"
          cy="700"
          rx="180"
          ry="160"
          fill="#C2DDE8"
          filter="url(#blobBlur)"
          opacity="0.35"
        />

        {/* Peach accent — center */}
        <circle
          className="blob blob--peach"
          cx="500"
          cy="400"
          r="100"
          fill="#FAE0CC"
          filter="url(#blobBlurSmall)"
          opacity="0.3"
        />
      </svg>

      {/* Small decorative floating shapes */}
      <div className="floater floater--1">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#E8927C" opacity="0.25" />
        </svg>
      </div>
      <div className="floater floater--2">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" fill="#B8A9D4" opacity="0.3" />
        </svg>
      </div>
      <div className="floater floater--3">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 2L20 12L30 16L20 20L16 30L12 20L2 16L12 12Z" fill="#E8C86A" opacity="0.2" />
        </svg>
      </div>
      <div className="floater floater--4">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" fill="#8DB48E" opacity="0.3" />
        </svg>
      </div>
      <div className="floater floater--5">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 1L12.5 7.5L19 10L12.5 12.5L10 19L7.5 12.5L1 10L7.5 7.5Z" fill="#D4889E" opacity="0.2" />
        </svg>
      </div>
      <div className="floater floater--6">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" fill="#9DC4D8" opacity="0.25" />
        </svg>
      </div>
    </div>
  )
}
